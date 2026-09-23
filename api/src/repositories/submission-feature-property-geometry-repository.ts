import SQL, { SQLStatement } from 'sql-template-strings';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import {
  CreateSubmissionFeaturePropertyGeometry,
  GeometryBoundingBox,
  SubmissionFeatureGeometryExtentSchema,
  SubmissionFeaturePropertyGeometry,
  SubmissionFeaturePropertyGeometrySchema
} from '../models/submission-feature-property-geometry';
import { BaseRepository } from './base-repository';
import { isSubmissionFeatureActive, isSubmissionFeaturePublished } from './sql-fragments';

export class SubmissionFeaturePropertyGeometryRepository extends BaseRepository {
  /**
   * Insert a submission_feature_property_geometry row.
   *
   * @param {CreateSubmissionFeaturePropertyGeometry} payload
   * @return {Promise<SubmissionFeaturePropertyGeometry>}
   * @memberof SubmissionFeaturePropertyGeometryRepository
   */
  async insertSubmissionFeaturePropertyGeometry(
    payload: CreateSubmissionFeaturePropertyGeometry
  ): Promise<SubmissionFeaturePropertyGeometry> {
    const sqlStatement = SQL`
      INSERT INTO submission_feature_property_geometry (
        submission_feature_id,
        blueprint_feature_type_property_id,
        value
      ) VALUES (
        ${payload.submission_feature_id},
        ${payload.blueprint_feature_type_property_id},
        ST_GeomFromGeoJSON(${JSON.stringify(payload.value)})
      )
      RETURNING
        submission_feature_property_geometry_id,
        submission_feature_id,
        blueprint_feature_type_property_id,
        ST_AsGeoJSON(value)::json AS value;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionFeaturePropertyGeometrySchema);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission_feature_property_geometry', [
        'SubmissionFeaturePropertyGeometryRepository->insertSubmissionFeaturePropertyGeometry',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a submission_feature_property_geometry row by id.
   *
   * @param {number} submissionFeaturePropertyGeometryId
   * @return {Promise<SubmissionFeaturePropertyGeometry>}
   * @memberof SubmissionFeaturePropertyGeometryRepository
   */
  async getSubmissionFeaturePropertyGeometryById(
    submissionFeaturePropertyGeometryId: number
  ): Promise<SubmissionFeaturePropertyGeometry> {
    const sqlStatement = SQL`
      SELECT
        submission_feature_property_geometry_id,
        submission_feature_id,
        blueprint_feature_type_property_id,
        ST_AsGeoJSON(value)::json AS value
      FROM submission_feature_property_geometry
      WHERE submission_feature_property_geometry_id = ${submissionFeaturePropertyGeometryId};
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionFeaturePropertyGeometrySchema);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('submission_feature_property_geometry not found', [
        'SubmissionFeaturePropertyGeometryRepository->getSubmissionFeaturePropertyGeometryById',
        { submissionFeaturePropertyGeometryId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SubmissionFeaturePropertyGeometryRepository->getSubmissionFeaturePropertyGeometryById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get submission_feature_property_geometry rows by submission feature id.
   *
   * @param {number} submissionFeatureId
   * @return {Promise<SubmissionFeaturePropertyGeometry[]>}
   * @memberof SubmissionFeaturePropertyGeometryRepository
   */
  async getSubmissionFeaturePropertyGeometryBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyGeometry[]> {
    const sqlStatement = SQL`
      SELECT
        submission_feature_property_geometry_id,
        submission_feature_id,
        blueprint_feature_type_property_id,
        ST_AsGeoJSON(value)::json AS value
      FROM submission_feature_property_geometry
      WHERE submission_feature_id = ${submissionFeatureId};
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionFeaturePropertyGeometrySchema);

    return response.rows;
  }

  /**
   * Get the combined extent and count of a submission feature's published spatial properties.
   *
   * The joins here must stay aligned with `biohub.martin_feature`
   * (`database/src/procedures/04_martin_feature.ts`): this decides whether a map is offered and where
   * it opens, while that decides what the map actually draws. If they disagree the map either frames
   * empty space or claims a feature has no spatial properties while tiles still render.
   *
   * The geometry values themselves are deliberately not selected. They travel to the browser as
   * vector tiles from the gateway, never through this API.
   *
   * @param {number} submissionId
   * @param {number} submissionFeatureId
   * @return {Promise<{ bbox: GeometryBoundingBox | null; geometry_count: number }>}
   * @memberof SubmissionFeaturePropertyGeometryRepository
   */
  async getActiveGeometryExtent(
    submissionId: number,
    submissionFeatureId: number
  ): Promise<{ bbox: GeometryBoundingBox | null; geometry_count: number }> {
    const scope = SQL`
        FROM submission_feature_property_geometry g
        JOIN submission_feature sf
          ON sf.submission_feature_id = g.submission_feature_id
         AND sf.submission_id = ${submissionId}
    `;

    scope.append(`
         AND ${isSubmissionFeaturePublished('sf')}
        JOIN blueprint_feature_type_property bftp
          ON bftp.blueprint_feature_type_property_id = g.blueprint_feature_type_property_id
        JOIN feature_property fp
          ON fp.feature_property_id = bftp.feature_property_id
         AND fp.record_end_date IS NULL
    `);

    scope.append(SQL`
        WHERE g.submission_feature_id = ${submissionFeatureId}
    `);

    return this.queryGeometryExtent(scope);
  }

  /**
   * Get the combined extent and count of the spatial properties of every ACTIVE submission feature
   * belonging to one submission upload.
   *
   * Active means not ended (`record_end_date IS NULL`), and deliberately NOT published: an upload
   * under review has never been approved, so every one of its features has a null effective date
   * and a published predicate would report no spatial properties for the whole upload. See
   * {@link isSubmissionFeatureActive} for why the literal form matters to the planner.
   *
   * The joins here must stay aligned with `biohub.martin_upload`
   * (`database/src/procedures/05_martin_upload.ts`): this decides whether a map is offered and where
   * it opens, while that decides what the map actually draws. If they disagree the map either
   * frames empty space or claims the upload has no spatial properties while tiles still render.
   *
   * The geometry values themselves are deliberately not selected. They travel to the browser as
   * vector tiles from the gateway, never through this API.
   *
   * @param {number} submissionId
   * @param {string} submissionUploadId
   * @return {Promise<{ bbox: GeometryBoundingBox | null; geometry_count: number }>}
   * @memberof SubmissionFeaturePropertyGeometryRepository
   */
  async getSubmissionUploadGeometryExtent(
    submissionId: number,
    submissionUploadId: string
  ): Promise<{ bbox: GeometryBoundingBox | null; geometry_count: number }> {
    const scope = SQL`
        FROM submission_feature sf
        JOIN submission_feature_property_geometry g
          ON g.submission_feature_id = sf.submission_feature_id
        JOIN blueprint_feature_type_property bftp
          ON bftp.blueprint_feature_type_property_id = g.blueprint_feature_type_property_id
        JOIN feature_property fp
          ON fp.feature_property_id = bftp.feature_property_id
         AND fp.record_end_date IS NULL
        WHERE sf.submission_upload_id = ${submissionUploadId}::uuid
          AND sf.submission_id = ${submissionId}
    `;

    scope.append(`
          AND ${isSubmissionFeatureActive('sf')}
    `);

    return this.queryGeometryExtent(scope);
  }

  /**
   * Run an extent query over a set of geometry rows and normalise the result.
   *
   * The scope supplies everything from `FROM` onward, with the geometry table aliased `g`; this wraps it in the
   * aggregate and projects the bounds as four coordinates.
   *
   * @private
   * @param {SQLStatement} scope - `FROM ... JOIN ... WHERE ...` selecting the geometry rows to aggregate.
   * @return {Promise<{ bbox: GeometryBoundingBox | null; geometry_count: number }>}
   * @memberof SubmissionFeaturePropertyGeometryRepository
   */
  private async queryGeometryExtent(
    scope: SQLStatement
  ): Promise<{ bbox: GeometryBoundingBox | null; geometry_count: number }> {
    const sqlStatement = SQL`
      SELECT
        public.ST_XMin(extent.bounds) AS min_x,
        public.ST_YMin(extent.bounds) AS min_y,
        public.ST_XMax(extent.bounds) AS max_x,
        public.ST_YMax(extent.bounds) AS max_y,
        extent.geometry_count
      FROM (
        SELECT
          public.ST_Extent(g.value)::public.geometry AS bounds,
          count(*)::integer AS geometry_count
    `;

    sqlStatement.append(scope);
    sqlStatement.append(`
      ) extent;
    `);

    const response = await this.connection.sql(sqlStatement, SubmissionFeatureGeometryExtentSchema);

    const row = response.rows[0];

    // The aggregate always returns a row, with null bounds and a zero count when nothing matched.
    if (
      !row ||
      row.geometry_count === 0 ||
      row.min_x === null ||
      row.min_y === null ||
      row.max_x === null ||
      row.max_y === null
    ) {
      return { bbox: null, geometry_count: 0 };
    }

    return {
      bbox: [row.min_x, row.min_y, row.max_x, row.max_y],
      geometry_count: row.geometry_count
    };
  }
}
