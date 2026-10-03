import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import {
  CreateBlueprintFeaturePropertyAssignment,
  CreateBlueprintFeatureTypeAssignment,
  UpdateBlueprintFeaturePropertyAssignment
} from '../models/blueprint-composition';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BlueprintFeatureTypePropertyService } from './blueprint-feature-type-property-service';
import { BlueprintFeatureTypeService } from './blueprint-feature-type-service';
import { BlueprintService } from './blueprint-service';
import { DBService } from './db-service';
import { FeaturePropertyService } from './feature-property-service';
import { FeatureTypeService } from './feature-type-service';

/**
 * Orchestrates composition operations spanning blueprints, blueprint assignments,
 * and reusable feature definitions. Domain services own reads and persistence;
 * this service coordinates cross-domain lifecycle checks and transactional workflows.
 */
export class BlueprintCompositionService extends DBService {
  blueprintService: BlueprintService;
  blueprintFeatureTypeService: BlueprintFeatureTypeService;
  blueprintFeatureTypePropertyService: BlueprintFeatureTypePropertyService;
  featureTypeService: FeatureTypeService;
  featurePropertyService: FeaturePropertyService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.blueprintService = new BlueprintService(connection);
    this.blueprintFeatureTypeService = new BlueprintFeatureTypeService(connection);
    this.blueprintFeatureTypePropertyService = new BlueprintFeatureTypePropertyService(connection);
    this.featureTypeService = new FeatureTypeService(connection);
    this.featurePropertyService = new FeaturePropertyService(connection);
  }

  /**
   * Search reusable feature types excluding active duplicates before pagination.
   *
   * @param blueprintId Owning blueprint.
   * @param keyword Search term.
   * @param pagination Page options.
   * @returns Paginated options.
   */
  async getAvailableFeatureTypesForBlueprint(
    blueprintId: number,
    keyword: string | undefined,
    pagination: ApiPaginationOptions
  ) {
    await this.blueprintService.getBlueprint(blueprintId);
    return this.featureTypeService.getAvailableFeatureTypesForBlueprint(blueprintId, keyword, pagination);
  }

  /**
   * Search reusable properties for a validated active blueprint type assignment.
   *
   * @param blueprintId Owning blueprint.
   * @param assignmentId Parent assignment.
   * @param keyword Search term.
   * @param pagination Page options.
   * @returns Paginated options.
   */
  async getAvailableFeaturePropertiesForBlueprintFeatureType(
    blueprintId: number,
    assignmentId: number,
    keyword: string | undefined,
    pagination: ApiPaginationOptions
  ) {
    await this.blueprintService.getBlueprint(blueprintId);
    const parent = await this.blueprintFeatureTypeService.getBlueprintFeatureType(blueprintId, assignmentId);
    if (parent.record_end_date !== null) {
      throw new ApiConflictError('Cannot assign properties to a deleted feature type');
    }
    return this.featurePropertyService.getAvailableFeaturePropertiesForBlueprintFeatureType(
      assignmentId,
      keyword,
      pagination
    );
  }

  /**
   * Assign a non-ended global feature type within this blueprint only.
   *
   * @param blueprintId Owning blueprint.
   * @param data Reusable feature-type identifier.
   * @returns Created metadata.
   */
  async createBlueprintFeatureType(blueprintId: number, data: CreateBlueprintFeatureTypeAssignment) {
    await this.blueprintService.lockEditableBlueprint(blueprintId);
    await this.featureTypeService.getFeatureType(data.featureTypeId);
    return this.blueprintFeatureTypeService.createBlueprintFeatureType(blueprintId, data);
  }

  /**
   * Delete active children before their parent using one shared database date.
   *
   * @param blueprintId Owning blueprint.
   * @param assignmentId Assignment identifier.
   * @returns Existing or newly deleted metadata.
   */
  async deleteBlueprintFeatureType(blueprintId: number, assignmentId: number) {
    const date = await this.blueprintService.lockEditableBlueprint(blueprintId);
    const row = await this.blueprintFeatureTypeService.getBlueprintFeatureType(blueprintId, assignmentId);
    if (row.record_end_date !== null) {
      return row;
    }
    await this.blueprintFeatureTypePropertyService.deleteBlueprintFeatureTypePropertiesByBlueprintFeatureTypeId(
      assignmentId,
      date
    );
    return this.blueprintFeatureTypeService.deleteBlueprintFeatureType(blueprintId, assignmentId, date);
  }

  /**
   * Assign a reusable property to a blueprint feature type without changing global definitions.
   *
   * @param blueprintId Owning blueprint.
   * @param data Parent membership, global property and independent settings.
   * @returns Created blueprint property membership.
   */
  async createBlueprintFeatureTypeProperty(blueprintId: number, data: CreateBlueprintFeaturePropertyAssignment) {
    await this.blueprintService.lockEditableBlueprint(blueprintId);
    const parent = await this.blueprintFeatureTypeService.getBlueprintFeatureType(
      blueprintId,
      data.blueprintFeatureTypeId
    );
    if (parent.record_end_date !== null) {
      throw new ApiConflictError('Cannot assign properties to a deleted feature type');
    }
    await this.featurePropertyService.getFeatureProperty(data.featurePropertyId);
    return this.blueprintFeatureTypePropertyService.createBlueprintFeatureTypeProperty(blueprintId, data);
  }

  /**
   * Update independent assignment settings without changing the reusable definition.
   *
   * @param blueprintId Owning blueprint.
   * @param assignmentId Assignment identifier.
   * @param data Supplied settings.
   * @returns Confirmed metadata.
   */
  async updateBlueprintFeatureTypeProperty(
    blueprintId: number,
    assignmentId: number,
    data: UpdateBlueprintFeaturePropertyAssignment
  ) {
    await this.blueprintService.lockEditableBlueprint(blueprintId);
    const row = await this.blueprintFeatureTypePropertyService.getBlueprintFeatureTypeProperty(
      blueprintId,
      assignmentId
    );
    const parent = await this.blueprintFeatureTypeService.getBlueprintFeatureType(
      blueprintId,
      row.blueprint_feature_type_id
    );
    if (row.record_end_date !== null || parent.record_end_date !== null) {
      throw new ApiConflictError('Cannot edit deleted property assignment');
    }
    return this.blueprintFeatureTypePropertyService.updateBlueprintFeatureTypeProperty(blueprintId, assignmentId, data);
  }

  /**
   * Delete membership without deleting history or modifying reusable definitions.
   *
   * @param blueprintId Owning blueprint.
   * @param assignmentId Assignment identifier.
   * @returns Existing or newly deleted metadata.
   */
  async deleteBlueprintFeatureTypeProperty(blueprintId: number, assignmentId: number) {
    const date = await this.blueprintService.lockEditableBlueprint(blueprintId);
    const row = await this.blueprintFeatureTypePropertyService.getBlueprintFeatureTypeProperty(
      blueprintId,
      assignmentId
    );
    if (row.record_end_date !== null) {
      return row;
    }
    return this.blueprintFeatureTypePropertyService.deleteBlueprintFeatureTypeProperty(blueprintId, assignmentId, date);
  }
}
