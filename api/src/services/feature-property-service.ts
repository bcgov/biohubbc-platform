import { IDBConnection } from '../database/db';
import { CreateFeatureProperty, FeatureProperty, UpdateFeatureProperty } from '../models/feature-property';
import { FeaturePropertyRepository } from '../repositories/feature-property-repository';
import { FeaturePropertyTypeRepository } from '../repositories/feature-property-type-repository';
import { makePaginationResponse } from '../utils/pagination';
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
  featurePropertyTypeRepository: FeaturePropertyTypeRepository;

  /**
   * Creates a FeaturePropertyService instance.
   *
   * @param {IDBConnection} connection - The active database connection.
   * @memberof FeaturePropertyService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.featurePropertyTypeRepository = new FeaturePropertyTypeRepository(connection);
    this.featurePropertyRepository = new FeaturePropertyRepository(connection);
  }

  /**
   * Create a feature property record.
   *
   * @param {CreateFeatureProperty} data - Feature property fields required to create the record.
   * @return {Promise<FeatureProperty>} The created feature property (with resolved type_name).
   * @throws {ApiNotFoundError} If the referenced feature_property_type_id does not exist.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof FeaturePropertyService
   */
  async createFeatureProperty(data: CreateFeatureProperty): Promise<FeatureProperty> {
    await this.featurePropertyRepository.getFeaturePropertyTypeById(data.feature_property_type_id);
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
   * Get active and retired feature properties with optional search and pagination.
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
   * Get total count of active and retired feature properties matching optional filters.
   *
   * @param {FeaturePropertyFilters} [filters] - Optional filter set.
   * @return {Promise<number>} Count of matching feature properties.
   * @memberof FeaturePropertyService
   */
  getFeaturePropertiesCount(filters?: FeaturePropertyFilters): Promise<number> {
    return this.featurePropertyRepository.getFeaturePropertiesCount(filters);
  }

  /**
   * Update descriptive metadata on an active or retired feature property record by ID.
   *
   * @param {number} featurePropertyId - Feature property identifier.
   * @param {UpdateFeatureProperty} data - Partial feature property fields to update.
   * @return {Promise<FeatureProperty>} Updated feature property (with resolved type_name).
   * @throws {ApiExecuteSQLError} If the update does not affect exactly one row.
   * @throws {ApiNotFoundError} If no feature property exists for the id.
   * @memberof FeaturePropertyService
   */
  async updateFeatureProperty(featurePropertyId: number, data: UpdateFeatureProperty): Promise<FeatureProperty> {
    await this.featurePropertyRepository.updateFeatureProperty(featurePropertyId, data);
    return this.featurePropertyRepository.getAdminFeatureProperty(featurePropertyId);
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
  /**
   * Retrieve supported property types for administration.
   * @returns Selector response with identifiers and names.
   */
  async getFeaturePropertyTypes() {
    const feature_property_types = await this.featurePropertyTypeRepository.getFeaturePropertyTypes();
    return { feature_property_types };
  }

  /**
   * Search reusable definitions excluding active memberships before pagination.
   *
   * @param blueprintFeatureTypeId Validated membership scope.
   * @param keyword Name or display-name search.
   * @param pagination Page and ordering.
   * @returns Matching options and total count.
   */
  async getAvailableFeaturePropertiesForBlueprintFeatureType(
    blueprintFeatureTypeId: number,
    keyword: string | undefined,
    pagination: ApiPaginationOptions
  ) {
    const options = await this.featurePropertyRepository.getAvailableFeaturePropertiesForBlueprintFeatureType(
      blueprintFeatureTypeId,
      keyword,
      pagination
    );
    const count = await this.featurePropertyRepository.getAvailableFeaturePropertiesForBlueprintFeatureTypeCount(
      blueprintFeatureTypeId,
      keyword
    );
    return { options, pagination: makePaginationResponse(count.count, pagination) };
  }

  /**
   * Read global definition metadata for administration, including retired records.
   *
   * @param featurePropertyId Global definition identifier.
   * @returns Existing definition metadata regardless of lifecycle.
   */
  getAdminFeatureProperty(featurePropertyId: number): Promise<FeatureProperty> {
    return this.featurePropertyRepository.getAdminFeatureProperty(featurePropertyId);
  }
}
