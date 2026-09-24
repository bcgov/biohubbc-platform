import { IDBConnection } from '../database/db';
import { AdminBlueprint, Blueprint, CreateBlueprint, CreateBlueprintVersionRecord } from '../models/blueprint';
import { BlueprintFeatureTypePropertyService } from './blueprint-feature-type-property-service';
import { BlueprintFeatureTypeService } from './blueprint-feature-type-service';
import { BlueprintService } from './blueprint-service';
import { DBService } from './db-service';
import { FeatureTypePropertyFeatureService } from './feature-type-property-feature-service';

/**
 * Orchestrates blueprint creation with independent copies of composition and reference targets.
 *
 * Domain services share the caller's transaction. Blueprint metadata creation acquires the
 * administration lock before any reads or writes, and the endpoint owns commit and rollback.
 */
export class BlueprintVersionService extends DBService {
  blueprintService: BlueprintService;
  blueprintFeatureTypeService: BlueprintFeatureTypeService;
  blueprintFeatureTypePropertyService: BlueprintFeatureTypePropertyService;
  featureTypePropertyFeatureService: FeatureTypePropertyFeatureService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.blueprintService = new BlueprintService(connection);
    this.blueprintFeatureTypeService = new BlueprintFeatureTypeService(connection);
    this.blueprintFeatureTypePropertyService = new BlueprintFeatureTypePropertyService(connection);
    this.featureTypePropertyFeatureService = new FeatureTypePropertyFeatureService(connection);
  }

  /**
   * Create blueprint metadata and optionally initialize composition from its parent, including a retired parent.
   *
   * @param data New blueprint metadata and optional parent.
   * @returns Created blueprint metadata after all copies succeed.
   */
  async createBlueprint(data: CreateBlueprint): Promise<Blueprint> {
    const blueprint = await this.blueprintService.createBlueprint(data);
    if (data.parentBlueprintId != null) {
      await this.copyBlueprintComposition(data.parentBlueprintId, blueprint.blueprint_id);
    }
    return blueprint;
  }

  /**
   * Create a draft version from an active source, inheriting metadata unless overridden.
   *
   * @param sourceBlueprintId Active source blueprint.
   * @param overrides Optional name and description overrides.
   * @returns New draft with independent assignment identities and reference targets.
   */
  async createBlueprintVersion(
    sourceBlueprintId: number,
    overrides: CreateBlueprintVersionRecord
  ): Promise<AdminBlueprint> {
    const blueprint = await this.blueprintService.createBlueprintVersionMetadata(sourceBlueprintId, overrides);
    await this.copyBlueprintComposition(sourceBlueprintId, blueprint.blueprint_id);
    return blueprint;
  }

  /**
   * Copy memberships before reference targets so every copied target points to a new assignment.
   *
   * @param sourceBlueprintId Source blueprint.
   * @param blueprintId New blueprint receiving the composition.
   * @returns Resolves when all domain copies have completed in the shared transaction.
   */
  private async copyBlueprintComposition(sourceBlueprintId: number, blueprintId: number): Promise<void> {
    await this.blueprintFeatureTypeService.copyBlueprintFeatureTypes(sourceBlueprintId, blueprintId);
    await this.blueprintFeatureTypePropertyService.copyBlueprintFeatureTypeProperties(sourceBlueprintId, blueprintId);
    await this.featureTypePropertyFeatureService.copyBlueprintReferenceTargets(sourceBlueprintId, blueprintId);
  }
}
