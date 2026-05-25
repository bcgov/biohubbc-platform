import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiConflictError, ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { CountResult } from '../models/count';
import {
  AdminFeatureTypeProperty,
  CreateFeatureTypePropertyRecord,
  ExpressionPredicatePropertyMetadata,
  FeatureTypeProperty,
  UpdateFeatureTypePropertyRecord
} from '../models/feature-type-property';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

/** Columns selected for admin CRUD responses (raw feature_type_property row). */
const ADMIN_FEATURE_TYPE_PROPERTY_COLUMNS = [
  'feature_type_property_id',
  'feature_type_id',
  'feature_property_id',
  'required_value',
  'sort'
] as const;

/**
 * A repository class for accessing feature type property data.
 *
 * @export
 * @class FeatureTypePropertyRepository
 * @extends {BaseRepository}
 */
export class FeatureTypePropertyRepository extends BaseRepository {
  /**
   * Get a feature property record by canonical feature-property name.
   *
   * @param {string} featurePropertyName - Canonical feature-property name.
   * @return {Promise<FeatureTypeProperty>} Matching feature-type-property row.
   * @throws {ApiNotFoundError} If no active feature property matches the name.
   * @throws {ApiExecuteSQLError} If more than one active row is returned.
   * @memberof FeatureTypePropertyRepository
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
   * @memberof FeatureTypePropertyRepository
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
   * @throws {ApiNotFoundError} If no matching active property metadata exists.
   * @throws {ApiExecuteSQLError} If an unexpected row count is returned.
   * @memberof FeatureTypePropertyRepository
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

  // ---------------------------------------------------------------------------
  // Admin CRUD methods
  // ---------------------------------------------------------------------------

  /**
   * Insert a new feature type property record.
   *
   * @param {CreateFeatureTypePropertyRecord} data - Data for the record to insert.
   * @return {Promise<number>} The new feature_type_property_id.
   * @throws {ApiConflictError} If the feature property is already assigned to the feature type.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof FeatureTypePropertyRepository
   */
  async insertFeatureTypeProperty(data: CreateFeatureTypePropertyRecord): Promise<number> {
    const knex = getKnex();

    const existingQuery = knex
      .from('feature_type_property')
      .select('feature_type_property_id')
      .whereNull('record_end_date')
      .where({
        feature_type_id: data.feature_type_id,
        feature_property_id: data.feature_property_id
      })
      .first();

    const existingResult = await this.connection.knex(existingQuery);

    if ((existingResult.rowCount ?? 0) > 0) {
      throw new ApiConflictError('Feature property is already assigned to this feature type', [
        'FeatureTypePropertyRepository->insertFeatureTypeProperty',
        { feature_type_id: data.feature_type_id, feature_property_id: data.feature_property_id }
      ]);
    }

    const query = knex
      .table('feature_type_property')
      .insert({
        feature_type_id: data.feature_type_id,
        feature_property_id: data.feature_property_id,
        required_value: data.required_value ?? false,
        sort: data.sort ?? null
      })
      .returning(['feature_type_property_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert feature type property', [
        'FeatureTypePropertyRepository->insertFeatureTypeProperty',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0].feature_type_property_id;
  }

  /**
   * Get a single active feature type property record by ID (admin raw row, no joins).
   *
   * When `featureTypeId` is supplied the query additionally filters by that column,
   * ensuring the record belongs to the expected parent feature type. This enforces
   * the nested route hierarchy and prevents cross-feature-type mutations.
   *
   * @param {number} featureTypePropertyId - Feature type property identifier.
   * @param {number} featureTypeId - Parent feature type identifier used to scope the lookup.
   * @return {Promise<AdminFeatureTypeProperty>} The raw feature type property record.
   * @throws {ApiNotFoundError} If no active record exists for the id within the parent feature type.
   * @throws {ApiExecuteSQLError} If an unexpected row count is returned.
   * @memberof FeatureTypePropertyRepository
   */
  async getAdminFeatureTypeProperty(
    featureTypePropertyId: number,
    featureTypeId: number
  ): Promise<AdminFeatureTypeProperty> {
    const knex = getKnex();
    const query = knex
      .from('feature_type_property')
      .select(ADMIN_FEATURE_TYPE_PROPERTY_COLUMNS)
      .whereNull('record_end_date')
      .where('feature_type_property_id', featureTypePropertyId)
      .where('feature_type_id', featureTypeId);

    const response = await this.connection.knex(query, AdminFeatureTypeProperty);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Feature type property not found', [
        'FeatureTypePropertyRepository->getAdminFeatureTypeProperty',
        { featureTypePropertyId, featureTypeId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'FeatureTypePropertyRepository->getAdminFeatureTypeProperty',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get active feature type property records for a given feature type.
   *
   * @param {number} featureTypeId - Feature type identifier to scope results.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<AdminFeatureTypeProperty[]>}
   * @memberof FeatureTypePropertyRepository
   */
  async getAdminFeatureTypeProperties(
    featureTypeId: number,
    pagination?: ApiPaginationOptions
  ): Promise<AdminFeatureTypeProperty[]> {
    const knex = getKnex();
    const query = knex
      .from('feature_type_property')
      .select(ADMIN_FEATURE_TYPE_PROPERTY_COLUMNS)
      .whereNull('record_end_date')
      .where('feature_type_id', featureTypeId)
      .orderBy('sort', 'asc');

    if (pagination) {
      this.applyPagination(query, pagination);
    }

    const response = await this.connection.knex(query, AdminFeatureTypeProperty);

    return response.rows;
  }

  /**
   * Get count of active feature type property records for a given feature type.
   *
   * @param {number} featureTypeId - Feature type identifier to scope the count.
   * @return {Promise<number>}
   * @memberof FeatureTypePropertyRepository
   */
  async getAdminFeatureTypePropertiesCount(featureTypeId: number): Promise<number> {
    const knex = getKnex();
    const countQuery = knex
      .from('feature_type_property')
      .whereNull('record_end_date')
      .where('feature_type_id', featureTypeId)
      .select(knex.raw('coalesce(count(*), 0)::integer as count'))
      .first();

    const countResult = await this.connection.knex(countQuery, CountResult);
    return countResult.rows[0].count;
  }

  /**
   * Update an existing feature type property record.
   *
   * @param {number} featureTypePropertyId - Feature type property identifier.
   * @param {number} featureTypeId - Parent feature type identifier used to scope the update.
   * @param {UpdateFeatureTypePropertyRecord} data - The data to update.
   * @return {Promise<void>}
   * @throws {ApiNotFoundError} If no active record exists for the id within the parent feature type.
   * @memberof FeatureTypePropertyRepository
   */
  async updateFeatureTypeProperty(
    featureTypePropertyId: number,
    featureTypeId: number,
    data: UpdateFeatureTypePropertyRecord
  ): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('feature_type_property')
      .update({
        required_value: data.required_value,
        sort: data.sort,
        record_end_date: data.record_end_date
      })
      .whereNull('record_end_date')
      .where('feature_type_property_id', featureTypePropertyId)
      .where('feature_type_id', featureTypeId);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiNotFoundError('Feature type property not found', [
        'FeatureTypePropertyRepository->updateFeatureTypeProperty',
        { featureTypePropertyId, featureTypeId }
      ]);
    }
  }

  /**
   * Soft delete a feature type property record scoped to a parent feature type.
   *
   * @param {number} featureTypePropertyId - Feature type property identifier.
   * @param {number} featureTypeId - Parent feature type identifier used to scope the delete.
   * @return {Promise<void>}
   * @throws {ApiNotFoundError} If no active record exists for the id within the parent feature type.
   * @memberof FeatureTypePropertyRepository
   */
  async deleteFeatureTypeProperty(featureTypePropertyId: number, featureTypeId: number): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('feature_type_property')
      .update({ record_end_date: knex.fn.now() })
      .whereNull('record_end_date')
      .where('feature_type_property_id', featureTypePropertyId)
      .where('feature_type_id', featureTypeId)
      .returning(['feature_type_property_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiNotFoundError('Feature type property not found', [
        'FeatureTypePropertyRepository->deleteFeatureTypeProperty',
        { featureTypePropertyId, featureTypeId }
      ]);
    }
  }
}
