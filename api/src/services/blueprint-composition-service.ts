import { IDBConnection } from '../database/db';
import { CreateBlueprintFeatureTypeAssignment } from '../models/blueprint-composition';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BlueprintFeatureTypePropertyService } from './blueprint-feature-type-property-service';
import { BlueprintFeatureTypeService } from './blueprint-feature-type-service';
import { BlueprintService } from './blueprint-service';
import { DBService } from './db-service';
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

  constructor(connection: IDBConnection) {
    super(connection);
    this.blueprintService = new BlueprintService(connection);
    this.blueprintFeatureTypeService = new BlueprintFeatureTypeService(connection);
    this.blueprintFeatureTypePropertyService = new BlueprintFeatureTypePropertyService(connection);
    this.featureTypeService = new FeatureTypeService(connection);
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
}
