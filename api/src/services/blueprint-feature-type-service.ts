import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import { BlueprintCompositionFilters, CreateBlueprintFeatureTypeAssignment } from '../models/blueprint-composition';
import { BlueprintFeatureTypeRepository } from '../repositories/blueprint-feature-type-repository';
import { makePaginationResponse } from '../utils/pagination';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BlueprintService } from './blueprint-service';
import { DBService } from './db-service';

/**
 * Own blueprint feature-type membership reads, uniqueness, and persistence.
 */
export class BlueprintFeatureTypeService extends DBService {
  blueprintFeatureTypeRepository: BlueprintFeatureTypeRepository;
  blueprintService: BlueprintService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.blueprintFeatureTypeRepository = new BlueprintFeatureTypeRepository(connection);
    this.blueprintService = new BlueprintService(connection);
  }

  /**
   * Read one assignment within its owning blueprint, including deleted assignments.
   *
   * @param blueprintId Owning blueprint.
   * @param blueprintFeatureTypeId Assignment identifier.
   * @returns Assignment metadata.
   */
  async getBlueprintFeatureType(blueprintId: number, blueprintFeatureTypeId: number) {
    return this.blueprintFeatureTypeRepository.getBlueprintFeatureTypeById(blueprintId, blueprintFeatureTypeId);
  }

  /**
   * List non-deleted type memberships and their filtered count.
   *
   * @param blueprintId Owning blueprint.
   * @param filters Search and active selector filters.
   * @param pagination Page and sort.
   * @returns Paginated assignments.
   */
  async getBlueprintFeatureTypes(
    blueprintId: number,
    filters: BlueprintCompositionFilters,
    pagination: ApiPaginationOptions
  ) {
    await this.blueprintService.getBlueprint(blueprintId);
    const rows = await this.blueprintFeatureTypeRepository.getBlueprintFeatureTypes(blueprintId, filters, pagination);
    const count = await this.blueprintFeatureTypeRepository.getBlueprintFeatureTypesCount(blueprintId, filters);
    return { types: rows, pagination: makePaginationResponse(count.count, pagination) };
  }

  /**
   * Create a unique active membership after cross-domain validation.
   *
   * @param blueprintId Owning blueprint.
   * @param data Reusable feature-type identifier.
   * @returns Confirmed assignment metadata.
   */
  async createBlueprintFeatureType(blueprintId: number, data: CreateBlueprintFeatureTypeAssignment) {
    const count = await this.blueprintFeatureTypeRepository.getActiveBlueprintFeatureTypeCount(
      blueprintId,
      data.featureTypeId
    );
    if (count.count) {
      throw new ApiConflictError('Feature type is already assigned to this blueprint');
    }
    const blueprintFeatureTypeId = await this.blueprintFeatureTypeRepository.insertBlueprintFeatureType(
      blueprintId,
      data.featureTypeId
    );
    return this.getBlueprintFeatureType(blueprintId, blueprintFeatureTypeId);
  }

  /**
   * Delete a validated membership after its children have been deleted.
   *
   * @param blueprintId Owning blueprint.
   * @param blueprintFeatureTypeId Assignment identifier.
   * @param date Database lifecycle date.
   * @returns Confirmed assignment metadata.
   */
  async deleteBlueprintFeatureType(blueprintId: number, blueprintFeatureTypeId: number, date: string) {
    await this.blueprintFeatureTypeRepository.deleteBlueprintFeatureType(blueprintId, blueprintFeatureTypeId, date);
    return this.getBlueprintFeatureType(blueprintId, blueprintFeatureTypeId);
  }

  /**
   * Copy non-deleted memberships into a new blueprint using independent assignment identities.
   *
   * @param sourceBlueprintId Source blueprint.
   * @param blueprintId New blueprint receiving the memberships.
   * @returns Resolves after the memberships are copied.
   */
  async copyBlueprintFeatureTypes(sourceBlueprintId: number, blueprintId: number): Promise<void> {
    await this.blueprintFeatureTypeRepository.copyBlueprintFeatureTypes(sourceBlueprintId, blueprintId);
  }
}
