import SQL from 'sql-template-strings';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import {
  CreateSubmissionFeaturePropertyGeometry,
  GeometryBoundingBox,
  SubmissionFeatureGeometryExtentSchema,
  SubmissionFeaturePropertyGeometry,
  SubmissionFeaturePropertyGeometrySchema
} from '../models/submission-feature-property-geometry';
import { BaseRepository } from './base-repository';
import { isSubmissionFeaturePublished } from './sql-fragments';

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
        feature_type_property_id,
        value
      ) VALUES (
        ${payload.submission_feature_id},
        ${payload.feature_type_property_id},
        ST_GeomFromGeoJSON(${JSON.stringify(payload.value)})
      )
      RETURNING
        submission_feature_property_geometry_id,
        submission_feature_id,
        feature_type_property_id,
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
        feature_type_property_id,
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
        feature_type_property_id,
        ST_AsGeoJSON(value)::json AS value
      FROM submission_feature_property_geometry
      WHERE submission_feature_id = ${submissionFeatureId};
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionFeaturePropertyGeometrySchema);

    return response.rows;
  }

  /**
   * Get the combined extent and count of a submission feature's active spatial properties.
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
        FROM submission_feature_property_geometry g
        JOIN submission_feature sf
          ON sf.submission_feature_id = g.submission_feature_id
         AND sf.submission_id = ${submissionId}
    `;

    sqlStatement.append(`
         AND ${isSubmissionFeaturePublished('sf')}
        JOIN feature_type_property ftp
          ON ftp.feature_type_property_id = g.feature_type_property_id
         AND ftp.feature_type_id = sf.feature_type_id
         AND ftp.record_end_date IS NULL
        JOIN feature_property fp
          ON fp.feature_property_id = ftp.feature_property_id
         AND fp.record_end_date IS NULL
    `);

    sqlStatement.append(SQL`
        WHERE g.submission_feature_id = ${submissionFeatureId}
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

  /**
   * Get submission_feature_property_geometry rows by feature type property id.
   *
   * @param {number} featureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyGeometry[]>}
   * @memberof SubmissionFeaturePropertyGeometryRepository
   */
  async getSubmissionFeaturePropertyGeometryByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyGeometry[]> {
    const sqlStatement = SQL`
      SELECT
        submission_feature_property_geometry_id,
        submission_feature_id,
        feature_type_property_id,
        ST_AsGeoJSON(value)::json AS value
      FROM submission_feature_property_geometry
      WHERE feature_type_property_id = ${featureTypePropertyId};
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionFeaturePropertyGeometrySchema);

    return response.rows;
  }
}
