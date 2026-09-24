import { BLUEPRINT_SORT_FIELDS } from '../constants/blueprint';
import { IDBConnection } from '../database/db';
import { ApiConflictError, ApiNotFoundError, ApiValidationError } from '../errors/api-error';
import {
  AdminBlueprint,
  Blueprint,
  BlueprintFilters,
  CreateBlueprint,
  CreateBlueprintVersionRecord,
  PublishBlueprintRecord,
  UpdateBlueprint
} from '../models/blueprint';
import { BlueprintRepository } from '../repositories/blueprint-repository';
import { makePaginationResponse } from '../utils/pagination';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';

/**
 * Own blueprint metadata, lineage, publication, and lifecycle validation.
 *
 * A blueprint's composition becomes read-only when its effective date arrives. Uploads are pinned to the
 * blueprint they were created with, and stored property values reference its assignments, so a
 * published blueprint is changed by creating a new version from it, editing that draft, and
 * publishing it.
 *
 * @export
 * @class BlueprintService
 * @extends {DBService}
 */
export class BlueprintService extends DBService {
  blueprintRepository: BlueprintRepository;

  /**
   * Build a blueprint service.
   *
   * @param {IDBConnection} connection - Active database connection.
   * @memberof BlueprintService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.blueprintRepository = new BlueprintRepository(connection);
  }

  // ---------------------------------------------------------------------------
  // Blueprints
  // ---------------------------------------------------------------------------

  /**
   * Get active blueprints, newest version first, with optional pagination.
   *
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<AdminBlueprint[]>}
   * @memberof BlueprintService
   */
  getAdminBlueprints(pagination?: ApiPaginationOptions): Promise<AdminBlueprint[]> {
    return this.blueprintRepository.getAdminBlueprints(pagination);
  }

  /**
   * Get count of active blueprints.
   *
   * @return {Promise<number>}
   * @memberof BlueprintService
   */
  getAdminBlueprintsCount(): Promise<number> {
    return this.blueprintRepository.getAdminBlueprintsCount();
  }

  /**
   * Get a single active blueprint by ID.
   *
   * @param {number} blueprintId - Blueprint identifier.
   * @return {Promise<AdminBlueprint>}
   * @throws {ApiNotFoundError} If no active blueprint exists for the id.
   * @memberof BlueprintService
   */
  getAdminBlueprint(blueprintId: number): Promise<AdminBlueprint> {
    return this.blueprintRepository.getAdminBlueprint(blueprintId);
  }

  /**
   * Create draft version metadata inherited from an active blueprint. Composition is copied by the version orchestrator.
   *
   * @param {number} sourceBlueprintId - The blueprint to copy.
   * @param {CreateBlueprintVersionRecord} overrides - Optional name/description for the new version.
   * @return {Promise<AdminBlueprint>} The new draft blueprint.
   * @throws {ApiNotFoundError} If no active source blueprint exists for the id.
   * @memberof BlueprintService
   */
  async createBlueprintVersionMetadata(
    sourceBlueprintId: number,
    overrides: CreateBlueprintVersionRecord
  ): Promise<AdminBlueprint> {
    await this.blueprintRepository.lockBlueprintAdministration();
    const blueprintId = await this.blueprintRepository.createBlueprintVersionFromBlueprint(
      sourceBlueprintId,
      overrides
    );

    return this.blueprintRepository.getAdminBlueprint(blueprintId);
  }

  /**
   * Publish a draft blueprint, making it available for new uploads.
   *
   * When published as the default, the current default is cleared first: at most one active blueprint
   * may be the default.
   *
   * @param {number} blueprintId - Blueprint identifier.
   * @param {PublishBlueprintRecord} data - Publish options.
   * @return {Promise<AdminBlueprint>} The published blueprint.
   * @throws {ApiNotFoundError} If no active blueprint exists for the id.
   * @throws {ApiConflictError} If the blueprint is already published.
   * @memberof BlueprintService
   */
  async publishBlueprint(blueprintId: number, data: PublishBlueprintRecord): Promise<AdminBlueprint> {
    await this.blueprintRepository.lockBlueprintAdministration();
    await this.assertBlueprintIsDraft(blueprintId);

    const isDefault = data.is_default ?? false;

    if (isDefault) {
      await this.blueprintRepository.clearDefaultBlueprint();
    }

    await this.blueprintRepository.publishBlueprint(blueprintId, isDefault);

    return this.blueprintRepository.getAdminBlueprint(blueprintId);
  }

  /**
   * Retrieve metadata, including retired blueprints.
   *
   * @param blueprintId Blueprint identifier.
   * @returns Metadata or a not-found error.
   */
  async getBlueprint(blueprintId: number): Promise<Blueprint> {
    const blueprint = await this.blueprintRepository.getBlueprint(blueprintId);
    if (!blueprint) {
      throw new ApiNotFoundError('Blueprint not found');
    }
    return blueprint;
  }

  /**
   * List administrative metadata and its filtered pagination count.
   *
   * @param filters Keyword filters.
   * @param pagination Requested page and sorting.
   * @returns Blueprint list and pagination metadata.
   */
  async getBlueprints(filters: BlueprintFilters, pagination: ApiPaginationOptions) {
    if (!BLUEPRINT_SORT_FIELDS.includes(pagination.sort ?? 'name')) {
      throw new ApiValidationError('Unsupported blueprint sort field');
    }
    const blueprints = await this.blueprintRepository.getBlueprints(filters, pagination);
    const count = await this.blueprintRepository.getBlueprintsCount(filters);
    return { blueprints, pagination: makePaginationResponse(count.count, pagination) };
  }

  /**
   * Create non-default blueprint metadata. An absent effective date denotes a draft.
   *
   * @param data Creation fields.
   * @returns Created metadata.
   */
  async createBlueprint(data: CreateBlueprint): Promise<Blueprint> {
    await this.blueprintRepository.lockBlueprintAdministration();
    await this.validateBlueprintParent(null, data.parentBlueprintId ?? null);
    const blueprint = await this.blueprintRepository.insertBlueprint(data);
    return blueprint;
  }

  /**
   * Lock administration before validating metadata or composition edits.
   *
   * @param blueprintId Owning blueprint.
   * @returns Database date for writes in the same transaction.
   */
  async lockEditableBlueprint(blueprintId: number): Promise<string> {
    const currentDate = await this.blueprintRepository.lockBlueprintAdministration();
    const blueprint = await this.getBlueprint(blueprintId);
    this.assertBlueprintEditable(blueprint, currentDate);
    return currentDate;
  }

  /**
   * Require a non-retired blueprint whose effective date has not arrived.
   * Call after acquiring the administration lock and reading the blueprint on the same connection.
   *
   * @param blueprint Blueprint being edited.
   * @param currentDate Database lifecycle date.
   * @returns Throws conflict when metadata or composition is read-only.
   */
  assertBlueprintEditable(blueprint: Blueprint, currentDate: string): void {
    if (
      blueprint.record_end_date !== null ||
      (blueprint.record_effective_date !== null && blueprint.record_effective_date <= currentDate)
    ) {
      throw new ApiConflictError('Only draft and future blueprints can be edited');
    }
  }

  /**
   * Allow descriptive metadata edits after publication while protecting lifecycle and lineage fields.
   *
   * @param blueprintId Blueprint identifier.
   * @param data Mutable metadata.
   * @returns Confirmed metadata.
   */
  async updateBlueprint(blueprintId: number, data: UpdateBlueprint): Promise<Blueprint> {
    const currentDate = await this.blueprintRepository.lockBlueprintAdministration();
    const blueprint = await this.getBlueprint(blueprintId);
    const metadataOnly = Object.keys(data).every((field) => field === 'name' || field === 'description');
    if (blueprint.record_end_date !== null || !metadataOnly) {
      this.assertBlueprintEditable(blueprint, currentDate);
    }
    if (data.parentBlueprintId !== undefined) {
      await this.validateBlueprintParent(blueprintId, data.parentBlueprintId);
    }
    if (Object.keys(data).length === 0) {
      return blueprint;
    }
    return this.blueprintRepository.updateBlueprint(blueprintId, data);
  }

  /**
   * Retire any non-default blueprint, preserving the original date on repeated calls.
   *
   * @param blueprintId Blueprint identifier.
   * @returns Retired metadata.
   */
  async retireBlueprint(blueprintId: number): Promise<Blueprint> {
    await this.blueprintRepository.lockBlueprintAdministration();
    const blueprint = await this.getBlueprint(blueprintId);
    if (blueprint.record_end_date !== null) {
      return blueprint;
    }
    if (blueprint.is_default) {
      throw new ApiConflictError('Select another default blueprint before retiring this blueprint');
    }
    return this.blueprintRepository.retireBlueprint(blueprintId);
  }

  /**
   * Replace the default atomically using the endpoint-owned transaction.
   *
   * @param blueprintId Blueprint identifier.
   * @returns Selected default metadata.
   */
  async setDefaultBlueprint(blueprintId: number): Promise<Blueprint> {
    const currentDate = await this.blueprintRepository.lockBlueprintAdministration();
    const blueprint = await this.getBlueprint(blueprintId);
    if (
      blueprint.record_end_date !== null ||
      blueprint.record_effective_date === null ||
      blueprint.record_effective_date > currentDate
    ) {
      throw new ApiConflictError('Only effective blueprints can be made default');
    }
    if (blueprint.is_default) {
      return blueprint;
    }
    await this.blueprintRepository.clearDefaultBlueprint();
    return this.blueprintRepository.setDefaultBlueprint(blueprintId);
  }

  /**
   * Validate lineage without filtering retired ancestors.
   *
   * @param blueprintId Existing identifier, or null during creation.
   * @param parentBlueprintId Proposed parent, or null to clear lineage.
   * @returns Resolves when the parent exists and would not create a cycle.
   */
  private async validateBlueprintParent(blueprintId: number | null, parentBlueprintId: number | null): Promise<void> {
    if (parentBlueprintId === null) {
      return;
    }
    const ancestorIds = await this.blueprintRepository.getBlueprintAncestorIds(parentBlueprintId);
    if (!ancestorIds.length) {
      throw new ApiValidationError('Parent blueprint does not exist');
    }
    if (blueprintId !== null && ancestorIds.includes(blueprintId)) {
      throw new ApiConflictError('Blueprint lineage cannot contain a cycle');
    }
  }

  /**
   * Require a blueprint to be an active draft before its composition is changed.
   *
   * @param {number} blueprintId - Blueprint identifier.
   * @return {Promise<void>}
   * @throws {ApiNotFoundError} If no active blueprint exists for the id.
   * @throws {ApiConflictError} If the blueprint is published.
   * @memberof BlueprintService
   */
  private async assertBlueprintIsDraft(blueprintId: number): Promise<void> {
    const blueprint = await this.blueprintRepository.getAdminBlueprint(blueprintId);

    if (blueprint.record_effective_date !== null) {
      throw new ApiConflictError('Blueprint is published and cannot be changed; create a new version', [
        'BlueprintService->assertBlueprintIsDraft',
        { blueprint_id: blueprintId, record_effective_date: blueprint.record_effective_date }
      ]);
    }
  }
}
