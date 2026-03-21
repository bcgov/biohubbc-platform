import SQL from 'sql-template-strings';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import {
  CreateSubmissionFeaturePropertyGeometry,
  SubmissionFeaturePropertyGeometry
} from '../models/submission-feature-property-geometry';
import { BaseRepository } from './base-repository';

export class SubmissionFeaturePropertyGeometryRepository extends BaseRepository {
  /**
   * Insert multiple submission_feature_property_geometry rows.
   *
   * @param {CreateSubmissionFeaturePropertyGeometry[]} payloads
   * @return {Promise<SubmissionFeaturePropertyGeometry[]>}
   * @memberof SubmissionFeaturePropertyGeometryRepository
   */
  async insertSubmissionFeaturePropertyGeometries(
    payloads: CreateSubmissionFeaturePropertyGeometry[]
  ): Promise<SubmissionFeaturePropertyGeometry[]> {
    if (!payloads.length) {
      return [];
    }

    const submissionFeatureIds = payloads.map((payload) => payload.submission_feature_id);
    const featureTypePropertyIds = payloads.map((payload) => payload.feature_type_property_id);
    const geometryValues = payloads.map((payload) => JSON.stringify(payload.value.geometry));

    const sqlStatement = SQL`
      INSERT INTO submission_feature_property_geometry (
        submission_feature_id,
        feature_type_property_id,
        value
      )
      SELECT
        staged.submission_feature_id,
        staged.feature_type_property_id,
        public.ST_Force2D(public.ST_GeomFromGeoJSON(staged.geometry_geojson))
      FROM unnest(
        ${submissionFeatureIds}::integer[],
        ${featureTypePropertyIds}::integer[],
        ${geometryValues}::text[]
      ) AS staged(
        submission_feature_id,
        feature_type_property_id,
        geometry_geojson
      )
      RETURNING
        submission_feature_property_geometry_id,
        submission_feature_id,
        feature_type_property_id,
        ST_AsGeoJSON(value)::json AS value;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionFeaturePropertyGeometry);

    if (response.rowCount !== payloads.length) {
      throw new ApiExecuteSQLError('Failed to insert submission_feature_property_geometry rows', [
        'SubmissionFeaturePropertyGeometryRepository->insertSubmissionFeaturePropertyGeometries',
        `rowCount was ${response.rowCount}, expected ${payloads.length}`
      ]);
    }

    return response.rows;
  }

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

    const response = await this.connection.sql(sqlStatement, SubmissionFeaturePropertyGeometry);

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

    const response = await this.connection.sql(sqlStatement, SubmissionFeaturePropertyGeometry);

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

    const response = await this.connection.sql(sqlStatement, SubmissionFeaturePropertyGeometry);

    return response.rows;
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

    const response = await this.connection.sql(sqlStatement, SubmissionFeaturePropertyGeometry);

    return response.rows;
  }

  /**
   * Delete submission_feature_property_geometry rows for a submission.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyGeometryRepository
   */
  async deleteSubmissionFeaturePropertyGeometriesBySubmissionId(submissionId: number): Promise<void> {
    const sqlStatement = SQL`
      DELETE FROM submission_feature_property_geometry
      WHERE submission_feature_id IN (
        SELECT submission_feature_id
        FROM submission_feature
        WHERE submission_id = ${submissionId}
      );
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Delete submission_feature_property_geometry rows for a submission upload.
   *
   * @param {string} submissionUploadId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyGeometryRepository
   */
  async deleteSubmissionFeaturePropertyGeometriesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      DELETE FROM submission_feature_property_geometry
      WHERE submission_feature_id IN (
        SELECT submission_feature_id
        FROM submission_feature
        WHERE submission_upload_id = ${submissionUploadId}
      );
    `;

    await this.connection.sql(sqlStatement);
  }
}
