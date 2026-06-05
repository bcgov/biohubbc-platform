import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import {
  AdminFeatureTypeProperty,
  CreateFeatureTypePropertyRecord,
  FeatureTypeProperty,
  UpdateFeatureTypePropertyRecord
} from '../models/feature-type-property';
import { FeaturePropertyRepository } from '../repositories/feature-property-repository';
import { FeatureTypePropertyRepository } from '../repositories/feature-type-property-repository';
import { FeatureTypeRepository } from '../repositories/feature-type-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';

/**
 * Service for feature type property reads and admin CRUD operations.
 *
 * @export
 * @class FeatureTypePropertyService
 * @extends {DBService}
 */
export class FeatureTypePropertyService extends DBService {
  featureTypePropertyRepository: FeatureTypePropertyRepository;
  featureTypeRepository: FeatureTypeRepository;
  featurePropertyRepository: FeaturePropertyRepository;

  /**
   * Build a feature-type-property service.
   *
   * @param {IDBConnection} connection - Active database connection.
   * @memberof FeatureTypePropertyService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.featureTypePropertyRepository = new FeatureTypePropertyRepository(connection);
    this.featureTypeRepository = new FeatureTypeRepository(connection);
    this.featurePropertyRepository = new FeaturePropertyRepository(connection);
  }

  /**
   * Get a feature property record by canonical feature-property name.
   *
   * @param {string} featurePropertyName - Canonical feature-property name.
   * @return {Promise<FeatureTypeProperty>} Matched feature-type-property row.
   * @throws {ApiNotFoundError} If no active feature property matches the name.
   * @throws {ApiExecuteSQLError} If an unexpected row count is returned.
   * @memberof FeatureTypePropertyService
   */
  async getFeaturePropertyByName(featurePropertyName: string): Promise<FeatureTypeProperty> {
    return this.featureTypePropertyRepository.getFeaturePropertyByName(featurePropertyName);
  }

  /**
   * Get a feature property record by feature_type_property_id.
   *
   * @param {number} featureTypePropertyId - Feature type property identifier.
   * @return {Promise<FeatureTypeProperty>} Matched feature-type-property row.
   * @throws {ApiNotFoundError} If no active row exists for the id.
   * @throws {ApiExecuteSQLError} If an unexpected row count is returned.
   * @memberof FeatureTypePropertyService
   */
  async getFeaturePropertyByFeatureTypePropertyId(featureTypePropertyId: number): Promise<FeatureTypeProperty> {
    return this.featureTypePropertyRepository.getFeaturePropertyByFeatureTypePropertyId(featureTypePropertyId);
  }

  // ---------------------------------------------------------------------------
  // Admin CRUD methods
  // ---------------------------------------------------------------------------

  /**
   * Create a feature type property record after validating parent FK references.
   *
   * @param {CreateFeatureTypePropertyRecord} data - Fields to insert.
   * @return {Promise<AdminFeatureTypeProperty>} The created record.
   * @throws {ApiNotFoundError} If the parent feature type or feature property does not exist.
   * @throws {ApiConflictError} If the feature property is already assigned to the feature type.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof FeatureTypePropertyService
   */
  async createFeatureTypeProperty(data: CreateFeatureTypePropertyRecord): Promise<AdminFeatureTypeProperty> {
    await Promise.all([
      this.featureTypeRepository.getFeatureType(data.feature_type_id),
      this.featurePropertyRepository.getFeatureProperty(data.feature_property_id)
    ]);

    const existing = await this.featureTypePropertyRepository.findActiveFeatureTypePropertyByFeatureTypeAndProperty(
      data.feature_type_id,
      data.feature_property_id
    );

    if (existing) {
      throw new ApiConflictError('Feature property is already assigned to this feature type', [
        'FeatureTypePropertyService->createFeatureTypeProperty',
        { feature_type_id: data.feature_type_id, feature_property_id: data.feature_property_id }
      ]);
    }

    const featureTypePropertyId = await this.featureTypePropertyRepository.insertFeatureTypeProperty(data);
    return this.featureTypePropertyRepository.getAdminFeatureTypeProperty(featureTypePropertyId, data.feature_type_id);
  }

  /**
   * Get a single active feature type property record by ID, scoped to a parent feature type.
   *
   * @param {number} featureTypePropertyId - Feature type property identifier.
   * @param {number} featureTypeId - Parent feature type identifier.
   * @return {Promise<AdminFeatureTypeProperty>} The raw record.
   * @throws {ApiNotFoundError} If no active record exists for the id within the parent feature type.
   * @throws {ApiExecuteSQLError} If an unexpected row count is returned.
   * @memberof FeatureTypePropertyService
   */
  getAdminFeatureTypeProperty(featureTypePropertyId: number, featureTypeId: number): Promise<AdminFeatureTypeProperty> {
    return this.featureTypePropertyRepository.getAdminFeatureTypeProperty(featureTypePropertyId, featureTypeId);
  }

  /**
   * Get active feature type property records for a feature type, with optional pagination.
   *
   * @param {number} featureTypeId - Feature type identifier to scope results.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<AdminFeatureTypeProperty[]>}
   * @memberof FeatureTypePropertyService
   */
  getAdminFeatureTypeProperties(
    featureTypeId: number,
    pagination?: ApiPaginationOptions
  ): Promise<AdminFeatureTypeProperty[]> {
    return this.featureTypePropertyRepository.getAdminFeatureTypeProperties(featureTypeId, pagination);
  }

  /**
   * Get count of active feature type property records for a feature type.
   *
   * @param {number} featureTypeId - Feature type identifier.
   * @return {Promise<number>}
   * @memberof FeatureTypePropertyService
   */
  getAdminFeatureTypePropertiesCount(featureTypeId: number): Promise<number> {
    return this.featureTypePropertyRepository.getAdminFeatureTypePropertiesCount(featureTypeId);
  }

  /**
   * Update a feature type property record by ID, scoped to a parent feature type.
   *
   * @param {number} featureTypePropertyId - Feature type property identifier.
   * @param {number} featureTypeId - Parent feature type identifier.
   * @param {UpdateFeatureTypePropertyRecord} data - Partial fields to update.
   * @return {Promise<AdminFeatureTypeProperty>} The updated record.
   * @throws {ApiNotFoundError} If no active record exists for the id within the parent feature type.
   * @throws {ApiExecuteSQLError} If an unexpected row count is returned.
   * @memberof FeatureTypePropertyService
   */
  async updateFeatureTypeProperty(
    featureTypePropertyId: number,
    featureTypeId: number,
    data: UpdateFeatureTypePropertyRecord
  ): Promise<AdminFeatureTypeProperty> {
    await this.featureTypePropertyRepository.updateFeatureTypeProperty(featureTypePropertyId, featureTypeId, data);
    return this.featureTypePropertyRepository.getAdminFeatureTypeProperty(featureTypePropertyId, featureTypeId);
  }

  /**
   * Soft-delete a feature type property scoped to a parent feature type.
   *
   * @param {number} featureTypePropertyId - Feature type property identifier.
   * @param {number} featureTypeId - Parent feature type identifier.
   * @return {Promise<void>}
   * @throws {ApiNotFoundError} If no active record exists for the id within the parent feature type.
   * @memberof FeatureTypePropertyService
   */
  async deleteFeatureTypeProperty(featureTypePropertyId: number, featureTypeId: number): Promise<void> {
    await this.featureTypePropertyRepository.deleteFeatureTypeProperty(featureTypePropertyId, featureTypeId);
  }
}
