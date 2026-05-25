import { IDBConnection } from '../database/db';
import { CreateFeatureProperty, FeatureProperty, UpdateFeatureProperty } from '../models/feature-property';
import { FeaturePropertyRepository } from '../repositories/feature-property-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';
import { FeaturePropertyFilters } from './feature-property-service.interface';

/**
 * Service for feature property admin CRUD operations.
 *
 * @export
 * @class FeaturePropertyService
 * @extends {DBService}
 */
export class FeaturePropertyService extends DBService {
  featurePropertyRepository: FeaturePropertyRepository;

  /**
   * Creates a FeaturePropertyService instance.
   *
   * @param {IDBConnection} connection - The active database connection.
   * @memberof FeaturePropertyService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.featurePropertyRepository = new FeaturePropertyRepository(connection);
  }

  /**
   * Create a feature property record.
   *
   * @param {CreateFeatureProperty} data - Feature property fields required to create the record.
   * @return {Promise<FeatureProperty>} The created feature property (with resolved type_name).
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof FeaturePropertyService
   */
  async createFeatureProperty(data: CreateFeatureProperty): Promise<FeatureProperty> {
    const featurePropertyId = await this.featurePropertyRepository.insertFeatureProperty(data);
    return this.featurePropertyRepository.getFeatureProperty(featurePropertyId);
  }

  /**
   * Get a single active feature property by ID.
   *
   * @param {number} featurePropertyId - Feature property identifier.
   * @return {Promise<FeatureProperty>} Feature property record (with resolved type_name).
   * @throws {ApiNotFoundError} If no active feature property exists for the id.
   * @throws {ApiExecuteSQLError} If an unexpected row count is returned.
   * @memberof FeaturePropertyService
   */
  getFeatureProperty(featurePropertyId: number): Promise<FeatureProperty> {
    return this.featurePropertyRepository.getFeatureProperty(featurePropertyId);
  }

  /**
   * Get active feature properties with optional search and pagination.
   *
   * @param {FeaturePropertyFilters} [filters] - Optional filter set.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<FeatureProperty[]>} Feature property list.
   * @memberof FeaturePropertyService
   */
  getFeatureProperties(
    filters?: FeaturePropertyFilters,
    pagination?: ApiPaginationOptions
  ): Promise<FeatureProperty[]> {
    return this.featurePropertyRepository.getFeatureProperties(filters, pagination);
  }

  /**
   * Get total count of active feature properties matching optional filters.
   *
   * @param {FeaturePropertyFilters} [filters] - Optional filter set.
   * @return {Promise<number>} Count of matching feature properties.
   * @memberof FeaturePropertyService
   */
  getFeaturePropertiesCount(filters?: FeaturePropertyFilters): Promise<number> {
    return this.featurePropertyRepository.getFeaturePropertiesCount(filters);
  }

  /**
   * Update a feature property record by ID.
   *
   * @param {number} featurePropertyId - Feature property identifier.
   * @param {UpdateFeatureProperty} data - Partial feature property fields to update.
   * @return {Promise<FeatureProperty>} Updated feature property (with resolved type_name).
   * @throws {ApiExecuteSQLError} If the update does not affect exactly one row.
   * @throws {ApiNotFoundError} If no active feature property exists for the id.
   * @memberof FeaturePropertyService
   */
  async updateFeatureProperty(featurePropertyId: number, data: UpdateFeatureProperty): Promise<FeatureProperty> {
    await this.featurePropertyRepository.updateFeatureProperty(featurePropertyId, data);
    return this.featurePropertyRepository.getFeatureProperty(featurePropertyId);
  }

  /**
   * Soft-delete a feature property by ID.
   *
   * @param {number} featurePropertyId - Feature property identifier.
   * @return {Promise<void>}
   * @throws {ApiExecuteSQLError} If the delete does not affect exactly one row.
   * @memberof FeaturePropertyService
   */
  async deleteFeatureProperty(featurePropertyId: number): Promise<void> {
    await this.featurePropertyRepository.deleteFeatureProperty(featurePropertyId);
  }
}
