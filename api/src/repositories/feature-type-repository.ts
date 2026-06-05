import { Knex } from 'knex';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { CountResult } from '../models/count';
import { CreateFeatureType, FeatureType, UpdateFeatureType } from '../models/feature-type';
import { FeatureTypeFilters } from '../services/feature-type-service.interface';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

/**
 * A repository class for accessing feature type data.
 *
 * @export
 * @class FeatureTypeRepository
 * @extends {BaseRepository}
 */
export class FeatureTypeRepository extends BaseRepository {
  /**
   * Insert a new feature type record.
   *
   * @param {CreateFeatureType} data - The data for the feature type to insert.
   * @return {Promise<FeatureType>} The created feature type record.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof FeatureTypeRepository
   */
  async insertFeatureType(data: CreateFeatureType): Promise<FeatureType> {
    const knex = getKnex();
    const query = knex
      .table('feature_type')
      .insert({
        name: data.name,
        display_name: data.display_name,
        description: data.description ?? null
      })
      .returning(['feature_type_id', 'name', 'display_name', 'description']);

    const response = await this.connection.knex(query, FeatureType);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert feature type', [
        'FeatureTypeRepository->insertFeatureType',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a single active feature type by ID.
   *
   * @param {number} featureTypeId - The ID of the feature type to retrieve.
   * @return {Promise<FeatureType>} The feature type record.
   * @throws {ApiNotFoundError} If no active feature type exists for the id.
   * @throws {ApiExecuteSQLError} If an unexpected row count is returned.
   * @memberof FeatureTypeRepository
   */
  async getFeatureType(featureTypeId: number): Promise<FeatureType> {
    const knex = getKnex();
    const query = knex
      .from('feature_type')
      .select(['feature_type_id', 'name', 'display_name', 'description'])
      .whereNull('record_end_date')
      .where('feature_type_id', featureTypeId);

    const response = await this.connection.knex(query, FeatureType);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Feature type not found', [
        'FeatureTypeRepository->getFeatureType',
        { featureTypeId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'FeatureTypeRepository->getFeatureType',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get active feature types with optional search and pagination.
   *
   * @param {FeatureTypeFilters} [filters] - Optional filter set.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<FeatureType[]>}
   * @memberof FeatureTypeRepository
   */
  async getFeatureTypes(filters?: FeatureTypeFilters, pagination?: ApiPaginationOptions): Promise<FeatureType[]> {
    const knex = getKnex();
    const baseQuery = this.applyFilters(
      knex
        .from('feature_type')
        .select(['feature_type_id', 'name', 'display_name', 'description'])
        .whereNull('record_end_date'),
      filters
    );

    baseQuery.orderBy('sort', 'asc');

    if (pagination) {
      this.applyPagination(baseQuery, pagination);
    }

    const response = await this.connection.knex(baseQuery, FeatureType);

    return response.rows;
  }

  /**
   * Get count of active feature types matching optional filters.
   *
   * @param {FeatureTypeFilters} [filters] - Optional filter set.
   * @return {Promise<number>}
   * @memberof FeatureTypeRepository
   */
  async getFeatureTypesCount(filters?: FeatureTypeFilters): Promise<number> {
    const knex = getKnex();
    const baseQuery = this.applyFilters(knex.from('feature_type').whereNull('record_end_date'), filters);

    const countQuery = baseQuery.clone().select(knex.raw('coalesce(count(*), 0)::integer as count')).first();
    const countResult = await this.connection.knex(countQuery, CountResult);
    return countResult.rows[0].count;
  }

  /**
   * Update an existing feature type record.
   *
   * @param {number} featureTypeId - The ID of the feature type to update.
   * @param {UpdateFeatureType} data - The data to update.
   * @return {Promise<void>}
   * @throws {ApiExecuteSQLError} If the update does not affect exactly one row.
   * @memberof FeatureTypeRepository
   */
  async updateFeatureType(featureTypeId: number, data: UpdateFeatureType): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('feature_type')
      .update({
        name: data.name,
        display_name: data.display_name,
        description: data.description,
        record_end_date: data.record_end_date
      })
      .whereNull('record_end_date')
      .where('feature_type_id', featureTypeId);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update feature type', [
        'FeatureTypeRepository->updateFeatureType',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Soft delete a feature type record by ID.
   *
   * @param {number} featureTypeId - The ID of the feature type to delete.
   * @return {Promise<void>}
   * @throws {ApiExecuteSQLError} If the delete does not affect exactly one row.
   * @memberof FeatureTypeRepository
   */
  async deleteFeatureType(featureTypeId: number): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('feature_type')
      .update({ record_end_date: knex.fn.now() })
      .whereNull('record_end_date')
      .where('feature_type_id', featureTypeId)
      .returning(['feature_type_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete feature type', [
        'FeatureTypeRepository->deleteFeatureType',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Apply feature type list filters to the provided query.
   *
   * @param {Knex.QueryBuilder} query - Base query to filter.
   * @param {FeatureTypeFilters} [filters] - Optional filter set.
   * @return {Knex.QueryBuilder} Filtered query.
   * @private
   * @memberof FeatureTypeRepository
   */
  private applyFilters(query: Knex.QueryBuilder, filters?: FeatureTypeFilters): Knex.QueryBuilder {
    if (!filters) {
      return query;
    }

    if (filters.search) {
      query.whereILike('name', `%${filters.search}%`);
    }

    return query;
  }
}
