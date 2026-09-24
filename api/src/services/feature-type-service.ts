import { IDBConnection } from '../database/db';
import { CreateFeatureType, FeatureType, UpdateFeatureType } from '../models/feature-type';
import { FeatureTypeRepository } from '../repositories/feature-type-repository';
import { makePaginationResponse } from '../utils/pagination';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';
import { FeatureTypeFilters } from './feature-type-service.interface';

/**
 * Service for feature type admin CRUD operations.
 *
 * @export
 * @class FeatureTypeService
 * @extends {DBService}
 */
export class FeatureTypeService extends DBService {
  featureTypeRepository: FeatureTypeRepository;

  /**
   * Creates a FeatureTypeService instance.
   *
   * @param {IDBConnection} connection - The active database connection.
   * @memberof FeatureTypeService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.featureTypeRepository = new FeatureTypeRepository(connection);
  }

  /**
   * Create a feature type record.
   *
   * @param {CreateFeatureType} data - Feature type fields required to create the record.
   * @return {Promise<FeatureType>} The created feature type.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof FeatureTypeService
   */
  async createFeatureType(data: CreateFeatureType): Promise<FeatureType> {
    return this.featureTypeRepository.insertFeatureType(data);
  }

  /**
   * Get a single active feature type by ID.
   *
   * @param {number} featureTypeId - Feature type identifier.
   * @return {Promise<FeatureType>} Feature type record.
   * @throws {ApiNotFoundError} If no active feature type exists for the id.
   * @throws {ApiExecuteSQLError} If an unexpected row count is returned.
   * @memberof FeatureTypeService
   */
  getFeatureType(featureTypeId: number): Promise<FeatureType> {
    return this.featureTypeRepository.getFeatureType(featureTypeId);
  }

  /**
   * Get active and retired feature types with optional search and pagination.
   *
   * @param {FeatureTypeFilters} [filters] - Optional filter set.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<FeatureType[]>} Feature type list.
   * @memberof FeatureTypeService
   */
  getFeatureTypes(filters?: FeatureTypeFilters, pagination?: ApiPaginationOptions): Promise<FeatureType[]> {
    return this.featureTypeRepository.getFeatureTypes(filters, pagination);
  }

  /**
   * Get total count of active and retired feature types matching optional filters.
   *
   * @param {FeatureTypeFilters} [filters] - Optional filter set.
   * @return {Promise<number>} Count of matching feature types.
   * @memberof FeatureTypeService
   */
  getFeatureTypesCount(filters?: FeatureTypeFilters): Promise<number> {
    return this.featureTypeRepository.getFeatureTypesCount(filters);
  }

  /**
   * Update descriptive metadata on an active or retired feature type record by ID.
   *
   * @param {number} featureTypeId - Feature type identifier.
   * @param {UpdateFeatureType} data - Partial feature type fields to update.
   * @return {Promise<FeatureType>} Updated feature type.
   * @throws {ApiExecuteSQLError} If the update does not affect exactly one row.
   * @throws {ApiNotFoundError} If no feature type exists for the id.
   * @memberof FeatureTypeService
   */
  async updateFeatureType(featureTypeId: number, data: UpdateFeatureType): Promise<FeatureType> {
    await this.featureTypeRepository.updateFeatureType(featureTypeId, data);
    return this.featureTypeRepository.getAdminFeatureType(featureTypeId);
  }

  /**
   * Soft-delete a feature type by ID.
   *
   * @param {number} featureTypeId - Feature type identifier.
   * @return {Promise<void>}
   * @throws {ApiExecuteSQLError} If the delete does not affect exactly one row.
   * @memberof FeatureTypeService
   */
  async deleteFeatureType(featureTypeId: number): Promise<void> {
    await this.featureTypeRepository.deleteFeatureType(featureTypeId);
  }

  /**
   * Search reusable definitions excluding active memberships before pagination.
   *
   * @param blueprintId Validated membership scope.
   * @param keyword Name or display-name search.
   * @param pagination Page and ordering.
   * @returns Matching options and total count.
   */
  async getAvailableFeatureTypesForBlueprint(
    blueprintId: number,
    keyword: string | undefined,
    pagination: ApiPaginationOptions
  ) {
    const options = await this.featureTypeRepository.getAvailableFeatureTypesForBlueprint(
      blueprintId,
      keyword,
      pagination
    );
    const count = await this.featureTypeRepository.getAvailableFeatureTypesForBlueprintCount(blueprintId, keyword);
    return { options, pagination: makePaginationResponse(count.count, pagination) };
  }

  /**
   * Read global definition metadata for administration, including retired records.
   *
   * @param featureTypeId Global definition identifier.
   * @returns Existing definition metadata regardless of lifecycle.
   */
  getAdminFeatureType(featureTypeId: number): Promise<FeatureType> {
    return this.featureTypeRepository.getAdminFeatureType(featureTypeId);
  }
}
