import { Knex } from 'knex';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { CountResult } from '../models/count';
import { CreateFeatureProperty, FeatureProperty, UpdateFeatureProperty } from '../models/feature-property';
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
        'fp.calculated_value'
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
   * Get active feature properties with optional search and pagination.
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
    const query = this.applyFilters(this.baseQuery().whereNull('fp.record_end_date'), filters);

    query.orderBy('fp.name', 'asc');

    if (pagination) {
      this.applyPagination(query, pagination);
    }

    const response = await this.connection.knex(query, FeatureProperty);

    return response.rows;
  }

  /**
   * Get count of active feature properties matching optional filters.
   *
   * @param {FeaturePropertyFilters} [filters] - Optional filter set.
   * @return {Promise<number>}
   * @memberof FeaturePropertyRepository
   */
  async getFeaturePropertiesCount(filters?: FeaturePropertyFilters): Promise<number> {
    const knex = getKnex();
    const baseQuery = this.applyFilters(knex.from('feature_property as fp').whereNull('fp.record_end_date'), filters);

    const countQuery = baseQuery.clone().select(knex.raw('coalesce(count(*), 0)::integer as count')).first();
    const countResult = await this.connection.knex(countQuery, CountResult);
    return countResult.rows[0].count;
  }

  /**
   * Update an existing feature property record.
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
        name: data.name,
        display_name: data.display_name,
        description: data.description,
        calculated_value: data.calculated_value,
        record_end_date: data.record_end_date
      })
      .whereNull('record_end_date')
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
}
