import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { CountResult } from '../models/count';
import {
  CreateFeatureProperty,
  ExpressionPredicatePropertyMetadata,
  FeatureProperty,
  UpdateFeatureProperty
} from '../models/feature-property';
import { FeaturePropertyFilters } from '../services/feature-property-service.interface';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

/**
 * A repository class for accessing feature property data.
 *
 * @export
 * @class FeaturePropertyRepository
 * @extends {BaseRepository}
 */
export class FeaturePropertyRepository extends BaseRepository {
  /**
   * Build the base SELECT query that joins feature_property_type for type_name.
   *
   * @returns {Knex.QueryBuilder}
   * @private
   * @memberof FeaturePropertyRepository
   */
  private baseQuery(): Knex.QueryBuilder {
    const knex = getKnex();
    return knex
      .from('feature_property as fp')
      .innerJoin('feature_property_type as fpt', function () {
        this.on('fpt.feature_property_type_id', '=', 'fp.feature_property_type_id').andOnNull('fpt.record_end_date');
      })
      .select([
        'fp.feature_property_id',
        'fp.feature_property_type_id',
        'fp.name',
        'fp.display_name',
        'fp.description',
        knex.ref('fpt.name').as('type_name'),
        'fp.calculated_value',
        'fp.record_effective_date',
        'fp.record_end_date'
      ]);
  }

  /**
   * Get a single active feature property type record by ID.
   *
   * @param {number} featurePropertyTypeId - The ID of the feature property type to retrieve.
   * @return {Promise<{ feature_property_type_id: number }>} The active feature property type record.
   * @throws {ApiNotFoundError} If no active feature property type exists for the given ID.
   * @throws {ApiExecuteSQLError} If an unexpected row count is returned.
   * @memberof FeaturePropertyRepository
   */
  async getFeaturePropertyTypeById(featurePropertyTypeId: number): Promise<{ feature_property_type_id: number }> {
    const knex = getKnex();
    const query = knex
      .from('feature_property_type')
      .select('feature_property_type_id')
      .whereNull('record_end_date')
      .where('feature_property_type_id', featurePropertyTypeId);

    const response = await this.connection.knex(query);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Feature property type not found', [
        'FeaturePropertyRepository->getFeaturePropertyTypeById',
        { featurePropertyTypeId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'FeaturePropertyRepository->getFeaturePropertyTypeById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert a new feature property record.
   *
   * @param {CreateFeatureProperty} data - The data for the feature property to insert.
   * @return {Promise<number>} The new feature_property_id.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof FeaturePropertyRepository
   */
  async insertFeatureProperty(data: CreateFeatureProperty): Promise<number> {
    const knex = getKnex();
    const query = knex
      .table('feature_property')
      .insert({
        feature_property_type_id: data.feature_property_type_id,
        name: data.name,
        display_name: data.display_name,
        description: data.description ?? null,
        calculated_value: data.calculated_value ?? false
      })
      .returning(['feature_property_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert feature property', [
        'FeaturePropertyRepository->insertFeatureProperty',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0].feature_property_id;
  }

  /**
   * Get a single active feature property by ID.
   *
   * @param {number} featurePropertyId - The ID of the feature property to retrieve.
   * @return {Promise<FeatureProperty>} The feature property record.
   * @throws {ApiNotFoundError} If no active feature property exists for the id.
   * @throws {ApiExecuteSQLError} If an unexpected row count is returned.
   * @memberof FeaturePropertyRepository
   */
  async getFeatureProperty(featurePropertyId: number): Promise<FeatureProperty> {
    const query = this.baseQuery().whereNull('fp.record_end_date').where('fp.feature_property_id', featurePropertyId);

    const response = await this.connection.knex(query, FeatureProperty);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Feature property not found', [
        'FeaturePropertyRepository->getFeatureProperty',
        { featurePropertyId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'FeaturePropertyRepository->getFeatureProperty',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get active and retired feature properties with optional search and pagination.
   *
   * @param {FeaturePropertyFilters} [filters] - Optional filter set.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<FeatureProperty[]>}
   * @memberof FeaturePropertyRepository
   */
  async getFeatureProperties(
    filters?: FeaturePropertyFilters,
    pagination?: ApiPaginationOptions
  ): Promise<FeatureProperty[]> {
    const query = this.applyFilters(this.baseQuery(), filters);

    query.orderBy('fp.name', 'asc');

    if (pagination) {
      this.applyPagination(query, pagination);
    }

    const response = await this.connection.knex(query, FeatureProperty);

    return response.rows;
  }

  /**
   * Get count of active and retired feature properties matching optional filters.
   *
   * @param {FeaturePropertyFilters} [filters] - Optional filter set.
   * @return {Promise<number>}
   * @memberof FeaturePropertyRepository
   */
  async getFeaturePropertiesCount(filters?: FeaturePropertyFilters): Promise<number> {
    const knex = getKnex();
    const baseQuery = this.applyFilters(knex.from('feature_property as fp'), filters);

    const countQuery = baseQuery.clone().select(knex.raw('coalesce(count(*), 0)::integer as count')).first();
    const countResult = await this.connection.knex(countQuery, CountResult);
    return countResult.rows[0].count;
  }

  /**
   * Update descriptive metadata on an active or retired feature property record.
   *
   * @param {number} featurePropertyId - The ID of the feature property to update.
   * @param {UpdateFeatureProperty} data - The data to update.
   * @return {Promise<void>}
   * @throws {ApiExecuteSQLError} If the update does not affect exactly one row.
   * @memberof FeaturePropertyRepository
   */
  async updateFeatureProperty(featurePropertyId: number, data: UpdateFeatureProperty): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('feature_property')
      .update({
        display_name: data.display_name,
        description: data.description
      })
      .where('feature_property_id', featurePropertyId);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update feature property', [
        'FeaturePropertyRepository->updateFeatureProperty',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Soft delete a feature property record by ID.
   *
   * @param {number} featurePropertyId - The ID of the feature property to delete.
   * @return {Promise<void>}
   * @throws {ApiExecuteSQLError} If the delete does not affect exactly one row.
   * @memberof FeaturePropertyRepository
   */
  async deleteFeatureProperty(featurePropertyId: number): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('feature_property')
      .update({ record_end_date: knex.fn.now() })
      .whereNull('record_end_date')
      .where('feature_property_id', featurePropertyId)
      .returning(['feature_property_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete feature property', [
        'FeaturePropertyRepository->deleteFeatureProperty',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Apply feature property list filters to the provided query.
   *
   * @param {Knex.QueryBuilder} query - Base query to filter.
   * @param {FeaturePropertyFilters} [filters] - Optional filter set.
   * @return {Knex.QueryBuilder} Filtered query.
   * @private
   * @memberof FeaturePropertyRepository
   */
  private applyFilters(query: Knex.QueryBuilder, filters?: FeaturePropertyFilters): Knex.QueryBuilder {
    if (!filters) {
      return query;
    }

    if (filters.search) {
      query.whereILike('fp.name', `%${filters.search}%`);
    }

    return query;
  }

  /**
   * Get the property metadata a predicate is validated and typed against.
   *
   * Without an assignment, the property is resolved on its own. With one, the assignment must carry the
   * property; it is accepted at any lifecycle, since a predicate may target values stored under a
   * Blueprint version that has since been superseded.
   *
   * @param {number} featurePropertyId - Shared feature property identifier.
   * @param {number | null} blueprintFeatureTypePropertyId - Optional Blueprint assignment the predicate narrows to.
   * @return {Promise<ExpressionPredicatePropertyMetadata>} Resolved metadata.
   * @throws {ApiNotFoundError} If no matching active property, or no such assignment of it, exists.
   * @throws {ApiExecuteSQLError} If an unexpected row count is returned.
   * @memberof FeaturePropertyRepository
   */
  async getExpressionPredicatePropertyMetadata(
    featurePropertyId: number,
    blueprintFeatureTypePropertyId: number | null
  ): Promise<ExpressionPredicatePropertyMetadata> {
    const sqlStatement =
      blueprintFeatureTypePropertyId === null
        ? SQL`
            SELECT
              fp.feature_property_id,
              NULL::integer as blueprint_feature_type_property_id,
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
              bftp.blueprint_feature_type_property_id,
              fpt.feature_property_type_id,
              fpt.name as feature_property_type_name,
              fp.display_name
            FROM blueprint_feature_type_property bftp
            INNER JOIN feature_property fp
              ON fp.feature_property_id = bftp.feature_property_id
              AND fp.record_end_date IS NULL
            INNER JOIN feature_property_type fpt
              ON fpt.feature_property_type_id = fp.feature_property_type_id
              AND fpt.record_end_date IS NULL
            WHERE fp.feature_property_id = ${featurePropertyId}
              AND bftp.blueprint_feature_type_property_id = ${blueprintFeatureTypePropertyId};
          `;

    const response = await this.connection.sql(sqlStatement, ExpressionPredicatePropertyMetadata);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Feature property metadata not found', [
        'FeaturePropertyRepository->getExpressionPredicatePropertyMetadata',
        { featurePropertyId, blueprintFeatureTypePropertyId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'FeaturePropertyRepository->getExpressionPredicatePropertyMetadata',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a single active or retired feature property by ID.
   *
   * @param {number} featurePropertyId - The ID of the feature property to retrieve.
   * @return {Promise<FeatureProperty>} The feature property record.
   * @throws {ApiNotFoundError} If no feature property exists for the id.
   * @throws {ApiExecuteSQLError} If an unexpected row count is returned.
   * @memberof FeaturePropertyRepository
   */
  async getAdminFeatureProperty(featurePropertyId: number): Promise<FeatureProperty> {
    const query = this.baseQuery().where('fp.feature_property_id', featurePropertyId);

    const response = await this.connection.knex(query, FeatureProperty);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Feature property not found', [
        'FeaturePropertyRepository->getAdminFeatureProperty',
        { featurePropertyId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'FeaturePropertyRepository->getAdminFeatureProperty',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }
}
