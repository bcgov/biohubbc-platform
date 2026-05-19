import SQL from 'sql-template-strings';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { ExpressionPredicatePropertyMetadata, FeatureTypeProperty } from '../models/feature-type-property';
import { BaseRepository } from './base-repository';

export class FeatureTypePropertyRepository extends BaseRepository {
  /**
   * Get a feature property record by canonical feature-property name.
   *
   * @param {string} featurePropertyName - Canonical feature-property name.
   * @return {Promise<FeatureTypeProperty>} Matching feature-type-property row.
   * @throws {ApiNotFoundError} If no active feature property matches the name.
   * @throws {ApiExecuteSQLError} If more than one active row is returned.
   */
  async getFeaturePropertyByName(featurePropertyName: string): Promise<FeatureTypeProperty> {
    const sqlStatement = SQL`
    SELECT
      ftp.feature_type_property_id,
      fp.feature_property_id,
      fpt.feature_property_type_id,
      fp.name,
      fp.display_name,
      fp.description,
      fpt.name as type_name,
      ftp.required_value,
      fp.calculated_value
    FROM
      feature_type_property ftp
    INNER JOIN
      feature_property fp
      ON fp.feature_property_id = ftp.feature_property_id
      AND fp.record_end_date IS NULL
    INNER JOIN
      feature_property_type fpt ON fpt.feature_property_type_id = fp.feature_property_type_id
      AND fpt.record_end_date IS NULL
    WHERE
      fp.name = ${featurePropertyName}
      AND ftp.record_end_date IS NULL
    ORDER BY
      ftp.feature_type_property_id;
  `;

    const response = await this.connection.sql(sqlStatement, FeatureTypeProperty);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Feature property not found', [
        'FeatureTypePropertyRepository->getFeaturePropertyByName',
        { featurePropertyName }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'FeatureTypePropertyRepository->getFeaturePropertyByName',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a feature property record by feature_type_property_id.
   *
   * @param {number} featureTypePropertyId - Feature type property identifier.
   * @return {Promise<FeatureTypeProperty>} Matching feature-type-property row.
   * @throws {ApiNotFoundError} If no active row exists for the id.
   * @throws {ApiExecuteSQLError} If more than one active row is returned.
   */
  async getFeaturePropertyByFeatureTypePropertyId(featureTypePropertyId: number): Promise<FeatureTypeProperty> {
    const sqlStatement = SQL`
    SELECT
      ftp.feature_type_property_id,
      fp.feature_property_id,
      fpt.feature_property_type_id,
      fp.name,
      fp.display_name,
      fp.description,
      fpt.name as type_name,
      ftp.required_value,
      fp.calculated_value
    FROM
      feature_type_property ftp
    INNER JOIN
      feature_property fp
      ON fp.feature_property_id = ftp.feature_property_id
      AND fp.record_end_date IS NULL
    INNER JOIN
      feature_property_type fpt ON fpt.feature_property_type_id = fp.feature_property_type_id
      AND fpt.record_end_date IS NULL
    WHERE
      ftp.feature_type_property_id = ${featureTypePropertyId}
      AND ftp.record_end_date IS NULL;
  `;

    const response = await this.connection.sql(sqlStatement, FeatureTypeProperty);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Feature property not found', [
        'FeatureTypePropertyRepository->getFeaturePropertyByFeatureTypePropertyId',
        { featureTypePropertyId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'FeatureTypePropertyRepository->getFeaturePropertyByFeatureTypePropertyId',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Resolve property metadata for expression predicate semantic validation.
   *
   * When `featureTypePropertyId` is supplied, the row must belong to the
   * supplied `featurePropertyId`. When it is omitted, only shared property
   * metadata is resolved.
   *
   * @param {number} featurePropertyId - Shared feature property id.
   * @param {number | null} featureTypePropertyId - Optional concrete feature type property id.
   * @return {Promise<ExpressionPredicatePropertyMetadata>} Resolved metadata.
   */
  async getExpressionPredicatePropertyMetadata(
    featurePropertyId: number,
    featureTypePropertyId: number | null
  ): Promise<ExpressionPredicatePropertyMetadata> {
    const sqlStatement =
      featureTypePropertyId === null
        ? SQL`
            SELECT
              fp.feature_property_id,
              NULL::integer as feature_type_property_id,
              fpt.feature_property_type_id,
              fpt.name as feature_property_type_name,
              fp.display_name
            FROM feature_property fp
            INNER JOIN feature_property_type fpt
              ON fpt.feature_property_type_id = fp.feature_property_type_id
              AND fpt.record_end_date IS NULL
            WHERE fp.feature_property_id = ${featurePropertyId}
              AND fp.record_end_date IS NULL;
          `
        : SQL`
            SELECT
              fp.feature_property_id,
              ftp.feature_type_property_id,
              fpt.feature_property_type_id,
              fpt.name as feature_property_type_name,
              fp.display_name
            FROM feature_type_property ftp
            INNER JOIN feature_property fp
              ON fp.feature_property_id = ftp.feature_property_id
              AND fp.record_end_date IS NULL
            INNER JOIN feature_property_type fpt
              ON fpt.feature_property_type_id = fp.feature_property_type_id
              AND fpt.record_end_date IS NULL
            WHERE fp.feature_property_id = ${featurePropertyId}
              AND ftp.feature_type_property_id = ${featureTypePropertyId}
              AND ftp.record_end_date IS NULL;
          `;

    const response = await this.connection.sql(sqlStatement, ExpressionPredicatePropertyMetadata);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Feature property metadata not found', [
        'FeatureTypePropertyRepository->getExpressionPredicatePropertyMetadata',
        { featurePropertyId, featureTypePropertyId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'FeatureTypePropertyRepository->getExpressionPredicatePropertyMetadata',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }
}
