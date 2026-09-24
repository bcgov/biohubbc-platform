import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import {
  AdminBlueprint,
  AdminBlueprintFeatureType,
  AdminBlueprintFeatureTypeProperty,
  CreateBlueprintFeatureTypePropertyRequest,
  CreateBlueprintVersionRecord,
  PublishBlueprintRecord,
  UpdateBlueprintFeatureTypePropertyRecord,
  UpdateBlueprintFeatureTypeRecord
} from '../models/blueprint';
import { BlueprintRepository } from '../repositories/blueprint-repository';
import { FeaturePropertyRepository } from '../repositories/feature-property-repository';
import { FeatureTypeRepository } from '../repositories/feature-type-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';

/**
 * Service for blueprint administration: versions, the feature types a blueprint includes, and the
 * properties it assigns to each of those feature types.
 *
 * A blueprint's composition can only be changed while it is a draft. Uploads are pinned to the
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
  featureTypeRepository: FeatureTypeRepository;
  featurePropertyRepository: FeaturePropertyRepository;

  /**
   * Build a blueprint service.
   *
   * @param {IDBConnection} connection - Active database connection.
   * @memberof BlueprintService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.blueprintRepository = new BlueprintRepository(connection);
    this.featureTypeRepository = new FeatureTypeRepository(connection);
    this.featurePropertyRepository = new FeaturePropertyRepository(connection);
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
   * Create a new draft version from an existing blueprint, copying its active feature types and
   * property assignments into new rows.
   *
   * @param {number} sourceBlueprintId - The blueprint to copy.
   * @param {CreateBlueprintVersionRecord} overrides - Optional name/description for the new version.
   * @return {Promise<AdminBlueprint>} The new draft blueprint.
   * @throws {ApiNotFoundError} If no active source blueprint exists for the id.
   * @memberof BlueprintService
   */
  async createBlueprintVersion(
    sourceBlueprintId: number,
    overrides: CreateBlueprintVersionRecord
  ): Promise<AdminBlueprint> {
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
    await this.assertBlueprintIsDraft(blueprintId);

    const isDefault = data.is_default ?? false;

    if (isDefault) {
      await this.blueprintRepository.clearDefaultBlueprint();
    }

    await this.blueprintRepository.publishBlueprint(blueprintId, isDefault);

    return this.blueprintRepository.getAdminBlueprint(blueprintId);
  }

  // ---------------------------------------------------------------------------
  // Blueprint feature types
  // ---------------------------------------------------------------------------

  /**
   * Get the active feature types included in a blueprint.
   *
   * @param {number} blueprintId - Blueprint identifier.
   * @return {Promise<AdminBlueprintFeatureType[]>}
   * @throws {ApiNotFoundError} If no active blueprint exists for the id.
   * @memberof BlueprintService
   */
  async getAdminBlueprintFeatureTypes(blueprintId: number): Promise<AdminBlueprintFeatureType[]> {
    await this.blueprintRepository.getAdminBlueprint(blueprintId);

    return this.blueprintRepository.getAdminBlueprintFeatureTypes(blueprintId);
  }

  /**
   * Include a feature type in a draft blueprint.
   *
   * @param {number} blueprintId - Blueprint identifier.
   * @param {{ feature_type_id: number; sort?: number | null }} data - Feature type to include.
   * @return {Promise<AdminBlueprintFeatureType>} The created record.
   * @throws {ApiNotFoundError} If the blueprint or feature type does not exist.
   * @throws {ApiConflictError} If the blueprint is published, or already includes the feature type.
   * @memberof BlueprintService
   */
  async createBlueprintFeatureType(
    blueprintId: number,
    data: { feature_type_id: number; sort?: number | null }
  ): Promise<AdminBlueprintFeatureType> {
    await this.assertBlueprintIsDraft(blueprintId);
    await this.featureTypeRepository.getFeatureType(data.feature_type_id);

    const existing = await this.blueprintRepository.findActiveBlueprintFeatureType(blueprintId, data.feature_type_id);

    if (existing) {
      throw new ApiConflictError('Feature type is already included in this blueprint', [
        'BlueprintService->createBlueprintFeatureType',
        { blueprint_id: blueprintId, feature_type_id: data.feature_type_id }
      ]);
    }

    const blueprintFeatureTypeId = await this.blueprintRepository.insertBlueprintFeatureType({
      blueprint_id: blueprintId,
      feature_type_id: data.feature_type_id,
      sort: data.sort
    });

    return this.blueprintRepository.getAdminBlueprintFeatureType(blueprintFeatureTypeId, blueprintId);
  }

  /**
   * Update a feature type of a draft blueprint.
   *
   * @param {number} blueprintId - Parent blueprint identifier.
   * @param {number} blueprintFeatureTypeId - Blueprint feature type identifier.
   * @param {UpdateBlueprintFeatureTypeRecord} data - Fields to update.
   * @return {Promise<AdminBlueprintFeatureType>} The updated record.
   * @throws {ApiNotFoundError} If no active record exists for the id within the parent blueprint.
   * @throws {ApiConflictError} If the blueprint is published.
   * @memberof BlueprintService
   */
  async updateBlueprintFeatureType(
    blueprintId: number,
    blueprintFeatureTypeId: number,
    data: UpdateBlueprintFeatureTypeRecord
  ): Promise<AdminBlueprintFeatureType> {
    await this.assertBlueprintIsDraft(blueprintId);
    await this.blueprintRepository.updateBlueprintFeatureType(blueprintFeatureTypeId, blueprintId, data);

    return this.blueprintRepository.getAdminBlueprintFeatureType(blueprintFeatureTypeId, blueprintId);
  }

  /**
   * Remove a feature type from a draft blueprint, retiring its property assignments with it.
   *
   * @param {number} blueprintId - Parent blueprint identifier.
   * @param {number} blueprintFeatureTypeId - Blueprint feature type identifier.
   * @return {Promise<void>}
   * @throws {ApiNotFoundError} If no active record exists for the id within the parent blueprint.
   * @throws {ApiConflictError} If the blueprint is published.
   * @memberof BlueprintService
   */
  async deleteBlueprintFeatureType(blueprintId: number, blueprintFeatureTypeId: number): Promise<void> {
    await this.assertBlueprintIsDraft(blueprintId);

    // Retire the parent first: it is scoped to the blueprint, so an id belonging to another blueprint
    // is rejected before any of its assignments are touched.
    await this.blueprintRepository.deleteBlueprintFeatureType(blueprintFeatureTypeId, blueprintId);
    await this.blueprintRepository.deleteBlueprintFeatureTypePropertiesByBlueprintFeatureTypeId(blueprintFeatureTypeId);
  }

  // ---------------------------------------------------------------------------
  // Blueprint feature type properties
  // ---------------------------------------------------------------------------

  /**
   * Get the active properties assigned to a blueprint feature type, with optional pagination.
   *
   * @param {number} blueprintId - Parent blueprint identifier.
   * @param {number} blueprintFeatureTypeId - Blueprint feature type identifier.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<AdminBlueprintFeatureTypeProperty[]>}
   * @throws {ApiNotFoundError} If the blueprint feature type does not exist within the blueprint.
   * @memberof BlueprintService
   */
  async getAdminBlueprintFeatureTypeProperties(
    blueprintId: number,
    blueprintFeatureTypeId: number,
    pagination?: ApiPaginationOptions
  ): Promise<AdminBlueprintFeatureTypeProperty[]> {
    await this.blueprintRepository.getAdminBlueprintFeatureType(blueprintFeatureTypeId, blueprintId);

    return this.blueprintRepository.getAdminBlueprintFeatureTypeProperties(blueprintFeatureTypeId, pagination);
  }

  /**
   * Get count of active properties assigned to a blueprint feature type.
   *
   * @param {number} blueprintFeatureTypeId - Blueprint feature type identifier.
   * @return {Promise<number>}
   * @memberof BlueprintService
   */
  getAdminBlueprintFeatureTypePropertiesCount(blueprintFeatureTypeId: number): Promise<number> {
    return this.blueprintRepository.getAdminBlueprintFeatureTypePropertiesCount(blueprintFeatureTypeId);
  }

  /**
   * Get a single active property assignment of a blueprint feature type.
   *
   * @param {number} blueprintId - Parent blueprint identifier.
   * @param {number} blueprintFeatureTypeId - Parent blueprint feature type identifier.
   * @param {number} blueprintFeatureTypePropertyId - Blueprint feature type property identifier.
   * @return {Promise<AdminBlueprintFeatureTypeProperty>}
   * @throws {ApiNotFoundError} If the assignment does not exist within the blueprint feature type.
   * @memberof BlueprintService
   */
  async getAdminBlueprintFeatureTypeProperty(
    blueprintId: number,
    blueprintFeatureTypeId: number,
    blueprintFeatureTypePropertyId: number
  ): Promise<AdminBlueprintFeatureTypeProperty> {
    await this.blueprintRepository.getAdminBlueprintFeatureType(blueprintFeatureTypeId, blueprintId);

    return this.blueprintRepository.getAdminBlueprintFeatureTypeProperty(
      blueprintFeatureTypePropertyId,
      blueprintFeatureTypeId
    );
  }

  /**
   * Assign an existing feature property directly to a feature type of a draft blueprint.
   *
   * The caller names only the property; requiredness, multiplicity and ordering are stored on the
   * assignment. A property may be assigned to the same feature type in any number of blueprints, each
   * configured on its own.
   *
   * @param {number} blueprintId - Parent blueprint identifier.
   * @param {number} blueprintFeatureTypeId - Blueprint feature type identifier.
   * @param {CreateBlueprintFeatureTypePropertyRequest} data - Property to assign and its configuration.
   * @return {Promise<AdminBlueprintFeatureTypeProperty>} The created assignment.
   * @throws {ApiNotFoundError} If the blueprint feature type or feature property does not exist.
   * @throws {ApiConflictError} If the blueprint is published, or the property is already assigned.
   * @memberof BlueprintService
   */
  async createBlueprintFeatureTypeProperty(
    blueprintId: number,
    blueprintFeatureTypeId: number,
    data: CreateBlueprintFeatureTypePropertyRequest
  ): Promise<AdminBlueprintFeatureTypeProperty> {
    await this.blueprintRepository.getAdminBlueprintFeatureType(blueprintFeatureTypeId, blueprintId);
    await this.assertBlueprintIsDraft(blueprintId);
    await this.featurePropertyRepository.getFeatureProperty(data.feature_property_id);

    const existing = await this.blueprintRepository.findActiveBlueprintFeatureTypeProperty(
      blueprintFeatureTypeId,
      data.feature_property_id
    );

    if (existing) {
      throw new ApiConflictError('Feature property is already assigned to this blueprint feature type', [
        'BlueprintService->createBlueprintFeatureTypeProperty',
        { blueprint_feature_type_id: blueprintFeatureTypeId, feature_property_id: data.feature_property_id }
      ]);
    }

    const blueprintFeatureTypePropertyId = await this.blueprintRepository.insertBlueprintFeatureTypeProperty({
      blueprint_feature_type_id: blueprintFeatureTypeId,
      feature_property_id: data.feature_property_id,
      required_value: data.required_value,
      allow_multiple: data.allow_multiple,
      sort: data.sort
    });

    return this.blueprintRepository.getAdminBlueprintFeatureTypeProperty(
      blueprintFeatureTypePropertyId,
      blueprintFeatureTypeId
    );
  }

  /**
   * Update the configuration of a property assignment of a draft blueprint.
   *
   * Only the assignment changes; the shared global pairing is never updated.
   *
   * @param {number} blueprintId - Parent blueprint identifier.
   * @param {number} blueprintFeatureTypeId - Parent blueprint feature type identifier.
   * @param {number} blueprintFeatureTypePropertyId - Blueprint feature type property identifier.
   * @param {UpdateBlueprintFeatureTypePropertyRecord} data - Fields to update.
   * @return {Promise<AdminBlueprintFeatureTypeProperty>} The updated assignment.
   * @throws {ApiNotFoundError} If the assignment does not exist within the blueprint feature type.
   * @throws {ApiConflictError} If the blueprint is published.
   * @memberof BlueprintService
   */
  async updateBlueprintFeatureTypeProperty(
    blueprintId: number,
    blueprintFeatureTypeId: number,
    blueprintFeatureTypePropertyId: number,
    data: UpdateBlueprintFeatureTypePropertyRecord
  ): Promise<AdminBlueprintFeatureTypeProperty> {
    await this.blueprintRepository.getAdminBlueprintFeatureType(blueprintFeatureTypeId, blueprintId);
    await this.assertBlueprintIsDraft(blueprintId);

    await this.blueprintRepository.updateBlueprintFeatureTypeProperty(
      blueprintFeatureTypePropertyId,
      blueprintFeatureTypeId,
      data
    );

    return this.blueprintRepository.getAdminBlueprintFeatureTypeProperty(
      blueprintFeatureTypePropertyId,
      blueprintFeatureTypeId
    );
  }

  /**
   * Retire a property assignment of a draft blueprint.
   *
   * @param {number} blueprintId - Parent blueprint identifier.
   * @param {number} blueprintFeatureTypeId - Parent blueprint feature type identifier.
   * @param {number} blueprintFeatureTypePropertyId - Blueprint feature type property identifier.
   * @return {Promise<void>}
   * @throws {ApiNotFoundError} If the assignment does not exist within the blueprint feature type.
   * @throws {ApiConflictError} If the blueprint is published.
   * @memberof BlueprintService
   */
  async deleteBlueprintFeatureTypeProperty(
    blueprintId: number,
    blueprintFeatureTypeId: number,
    blueprintFeatureTypePropertyId: number
  ): Promise<void> {
    await this.blueprintRepository.getAdminBlueprintFeatureType(blueprintFeatureTypeId, blueprintId);
    await this.assertBlueprintIsDraft(blueprintId);

    await this.blueprintRepository.deleteBlueprintFeatureTypeProperty(
      blueprintFeatureTypePropertyId,
      blueprintFeatureTypeId
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

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
