import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import {
  BlueprintFeaturePropertyFilters,
  CreateBlueprintFeaturePropertyAssignment,
  UpdateBlueprintFeaturePropertyAssignment
} from '../models/blueprint-composition';
import { BlueprintFeatureTypePropertyRepository } from '../repositories/blueprint-feature-type-property-repository';
import { makePaginationResponse } from '../utils/pagination';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BlueprintFeatureTypeService } from './blueprint-feature-type-service';
import { BlueprintService } from './blueprint-service';
import { DBService } from './db-service';

/**
 * Own blueprint property membership reads, settings, and persistence.
 */
export class BlueprintFeatureTypePropertyService extends DBService {
  blueprintFeatureTypePropertyRepository: BlueprintFeatureTypePropertyRepository;
  blueprintFeatureTypeService: BlueprintFeatureTypeService;
  blueprintService: BlueprintService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.blueprintFeatureTypePropertyRepository = new BlueprintFeatureTypePropertyRepository(connection);
    this.blueprintFeatureTypeService = new BlueprintFeatureTypeService(connection);
    this.blueprintService = new BlueprintService(connection);
  }

  /**
   * List non-deleted property memberships without suppressing ended global definitions.
   *
   * @param blueprintId Owning blueprint.
   * @param filters Search filters.
   * @param pagination Page and sort.
   * @returns Paginated assignments.
   */
  async getBlueprintFeatureTypeProperties(
    blueprintId: number,
    filters: BlueprintFeaturePropertyFilters,
    pagination: ApiPaginationOptions
  ) {
    await this.blueprintService.getBlueprint(blueprintId);
    if (filters.blueprintFeatureTypeId !== undefined) {
      await this.blueprintFeatureTypeService.getBlueprintFeatureType(blueprintId, filters.blueprintFeatureTypeId);
    }
    const rows = await this.blueprintFeatureTypePropertyRepository.getBlueprintFeatureTypeProperties(
      blueprintId,
      filters,
      pagination
    );
    const count = await this.blueprintFeatureTypePropertyRepository.getBlueprintFeatureTypePropertiesCount(
      blueprintId,
      filters
    );
    return { properties: rows, pagination: makePaginationResponse(count.count, pagination) };
  }

  /**
   * Read one historical or active property assignment in its owning blueprint.
   *
   * @param blueprintId Owning blueprint.
   * @param blueprintFeatureTypePropertyId Assignment identifier.
   * @returns Scoped assignment metadata.
   */
  async getBlueprintFeatureTypeProperty(blueprintId: number, blueprintFeatureTypePropertyId: number) {
    return this.blueprintFeatureTypePropertyRepository.getBlueprintFeatureTypePropertyById(
      blueprintId,
      blueprintFeatureTypePropertyId
    );
  }

  /**
   * Create a unique property membership after cross-domain validation.
   *
   * @param blueprintId Owning blueprint, validated by the orchestrator.
   * @param data Validated parent assignment and reusable property settings.
   * @returns Confirmed assignment metadata.
   */
  async createBlueprintFeatureTypeProperty(blueprintId: number, data: CreateBlueprintFeaturePropertyAssignment) {
    const count = await this.blueprintFeatureTypePropertyRepository.getActiveBlueprintFeatureTypePropertyCount(
      data.blueprintFeatureTypeId,
      data.featurePropertyId
    );
    if (count.count) {
      throw new ApiConflictError('Property is already assigned to this blueprint feature type');
    }
    const blueprintFeatureTypePropertyId =
      await this.blueprintFeatureTypePropertyRepository.insertBlueprintFeatureTypeProperty({
        blueprint_feature_type_id: data.blueprintFeatureTypeId,
        feature_property_id: data.featurePropertyId,
        required_value: data.requiredValue ?? false,
        allow_multiple: data.allowMultiple ?? false
      });
    return this.getBlueprintFeatureTypeProperty(blueprintId, blueprintFeatureTypePropertyId);
  }

  /**
   * Persist supplied assignment settings without altering membership identity.
   *
   * @param blueprintId Owning blueprint.
   * @param blueprintFeatureTypePropertyId Validated assignment identifier.
   * @param data Supplied settings; omission preserves values.
   * @returns Confirmed metadata.
   */
  async updateBlueprintFeatureTypeProperty(
    blueprintId: number,
    blueprintFeatureTypePropertyId: number,
    data: UpdateBlueprintFeaturePropertyAssignment
  ) {
    if (Object.values(data).some((value) => value !== undefined)) {
      await this.blueprintFeatureTypePropertyRepository.updateBlueprintFeatureTypeProperty(
        blueprintId,
        blueprintFeatureTypePropertyId,
        data
      );
    }
    return this.getBlueprintFeatureTypeProperty(blueprintId, blueprintFeatureTypePropertyId);
  }

  /**
   * Delete a validated property membership while retaining its references.
   *
   * @param blueprintId Owning blueprint.
   * @param blueprintFeatureTypePropertyId Assignment identifier.
   * @param date Database lifecycle date.
   * @returns Confirmed metadata.
   */
  async deleteBlueprintFeatureTypeProperty(blueprintId: number, blueprintFeatureTypePropertyId: number, date: string) {
    await this.blueprintFeatureTypePropertyRepository.deleteBlueprintFeatureTypeProperty(
      blueprintId,
      blueprintFeatureTypePropertyId,
      date
    );
    return this.getBlueprintFeatureTypeProperty(blueprintId, blueprintFeatureTypePropertyId);
  }

  /**
   * Delete active children before deleting their parent in the same transaction.
   *
   * @param blueprintFeatureTypeId Validated parent assignment.
   * @param date Database date shared with parent deletion.
   * @returns Resolves after persistence.
   */
  async deleteBlueprintFeatureTypePropertiesByBlueprintFeatureTypeId(blueprintFeatureTypeId: number, date: string) {
    await this.blueprintFeatureTypePropertyRepository.deleteBlueprintFeatureTypePropertiesByBlueprintFeatureTypeId(
      blueprintFeatureTypeId,
      date
    );
  }

  /**
   * Copy non-deleted memberships into a new blueprint using independent assignment identities.
   *
   * @param sourceBlueprintId Source blueprint.
   * @param blueprintId New blueprint receiving the memberships.
   * @returns Resolves after the memberships are copied.
   */
  async copyBlueprintFeatureTypeProperties(sourceBlueprintId: number, blueprintId: number): Promise<void> {
    await this.blueprintFeatureTypePropertyRepository.copyBlueprintFeatureTypeProperties(
      sourceBlueprintId,
      blueprintId
    );
  }
}
