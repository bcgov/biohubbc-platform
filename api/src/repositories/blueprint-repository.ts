import { SQL } from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import {
  AdminBlueprint,
  AdminBlueprintFeatureType,
  AdminBlueprintFeatureTypeProperty,
  CreateBlueprintFeatureTypePropertyRecord,
  CreateBlueprintFeatureTypeRecord,
  CreateBlueprintVersionRecord,
  UpdateBlueprintFeatureTypePropertyRecord,
  UpdateBlueprintFeatureTypeRecord
} from '../models/blueprint';
import { CountResult } from '../models/count';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

/** Columns selected for admin blueprint responses. */
const ADMIN_BLUEPRINT_COLUMNS = [
  'blueprint_id',
  'version_number',
  'name',
  'description',
  'is_default',
  'parent_blueprint_id',
  'record_effective_date',
  'record_end_date'
] as const;

/** Columns selected for admin blueprint feature type responses (joined to feature_type as `ft`). */
const ADMIN_BLUEPRINT_FEATURE_TYPE_COLUMNS = [
  'bft.blueprint_feature_type_id',
  'bft.blueprint_id',
  'bft.feature_type_id',
  'ft.name as feature_type_name',
  'ft.display_name as feature_type_display_name',
  'bft.sort'
] as const;

/**
 * Columns selected for admin blueprint feature type property responses (joined to feature_property as
 * `fp` and feature_property_type as `fpt`).
 */
const ADMIN_BLUEPRINT_FEATURE_TYPE_PROPERTY_COLUMNS = [
  'bftp.blueprint_feature_type_property_id',
  'bftp.blueprint_feature_type_id',
  'bftp.feature_property_id',
  'fp.name as property_name',
  'fp.display_name as property_display_name',
  'fpt.name as property_type_name',
  'bftp.required_value',
  'bftp.allow_multiple',
  'bftp.sort'
] as const;

export class BlueprintRepository extends BaseRepository {
  /**
   * Find a Blueprint's id only if it is currently available for new uploads.
   *
   * A Blueprint is available when `record_end_date IS NULL` (not soft-deleted) and
   * `record_effective_date <= now()` (live, not a draft or future-dated). A null
   * `record_effective_date` represents a draft Blueprint that is not yet available. This is the only
   * availability check applied to a caller-provided `blueprint_id`; once stored on an upload the
   * Blueprint is grandfathered in and is not re-validated during indexing.
   *
   * @param {number} blueprintId - The requested Blueprint id.
   * @returns {Promise<number | null>} - The `blueprint_id` if available, otherwise null.
   */
  async findActiveBlueprintById(blueprintId: number): Promise<number | null> {
    const sqlStatement = SQL`
      SELECT
        blueprint_id
      FROM
        blueprint
      WHERE
        blueprint_id = ${blueprintId}
        AND record_end_date IS NULL
        AND record_effective_date <= now();
    `;

    const response = await this.connection.sql<{ blueprint_id: number }>(sqlStatement);

    return response.rows[0]?.blueprint_id ?? null;
  }

  /**
   * Find the id of the active default Blueprint (`is_default = true AND record_end_date IS NULL`).
   *
   * Used as the fallback for a brand-new submission that has no prior upload to inherit a Blueprint
   * from. At most one active default Blueprint exists (enforced by a partial unique index).
   *
   * @returns {Promise<number | null>} - The default `blueprint_id`, or null if none is configured.
   */
  async findDefaultBlueprintId(): Promise<number | null> {
    const sqlStatement = SQL`
      SELECT
        blueprint_id
      FROM
        blueprint
      WHERE
        is_default = true
        AND record_end_date IS NULL
      ORDER BY
        version_number DESC
      LIMIT 1;
    `;

    const response = await this.connection.sql<{ blueprint_id: number }>(sqlStatement);

    return response.rows[0]?.blueprint_id ?? null;
  }

  // ---------------------------------------------------------------------------
  // Admin: blueprints
  // ---------------------------------------------------------------------------

  /**
   * Get active (not retired) blueprints, newest version first.
   *
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<AdminBlueprint[]>}
   * @memberof BlueprintRepository
   */
  async getAdminBlueprints(pagination?: ApiPaginationOptions): Promise<AdminBlueprint[]> {
    const knex = getKnex();
    const query = knex
      .from('blueprint')
      .select(ADMIN_BLUEPRINT_COLUMNS)
      .whereNull('record_end_date')
      .orderBy('version_number', 'desc');

    if (pagination) {
      this.applyPagination(query, pagination);
    }

    const response = await this.connection.knex(query, AdminBlueprint);

    return response.rows;
  }

  /**
   * Get count of active (not retired) blueprints.
   *
   * @return {Promise<number>}
   * @memberof BlueprintRepository
   */
  async getAdminBlueprintsCount(): Promise<number> {
    const knex = getKnex();
    const countQuery = knex
      .from('blueprint')
      .whereNull('record_end_date')
      .select(knex.raw('coalesce(count(*), 0)::integer as count'))
      .first();

    const countResult = await this.connection.knex(countQuery, CountResult);
    return countResult.rows[0].count;
  }

  /**
   * Get a single active (not retired) blueprint by ID.
   *
   * @param {number} blueprintId - Blueprint identifier.
   * @return {Promise<AdminBlueprint>} The blueprint record.
   * @throws {ApiNotFoundError} If no active blueprint exists for the id.
   * @memberof BlueprintRepository
   */
  async getAdminBlueprint(blueprintId: number): Promise<AdminBlueprint> {
    const knex = getKnex();
    const query = knex
      .from('blueprint')
      .select(ADMIN_BLUEPRINT_COLUMNS)
      .whereNull('record_end_date')
      .where('blueprint_id', blueprintId);

    const response = await this.connection.knex(query, AdminBlueprint);

    if (response.rowCount !== 1) {
      throw new ApiNotFoundError('Blueprint not found', ['BlueprintRepository->getAdminBlueprint', { blueprintId }]);
    }

    return response.rows[0];
  }

  /**
   * Create a new draft blueprint version from an existing blueprint.
   *
   * The source blueprint's active feature types, active property assignments and the allowed reference
   * targets of those assignments are copied into new rows, so the new version receives its own
   * `blueprint_feature_type_id` and `blueprint_feature_type_property_id` values and can be edited without
   * affecting the source. Retired feature types and assignments are not carried forward.
   *
   * The new version is a draft (`record_effective_date` null, not the default) whose parent is the
   * source blueprint. `version_number` follows the highest ever issued, including retired blueprints,
   * so a version number is never reused.
   *
   * @param {number} sourceBlueprintId - The blueprint to copy.
   * @param {CreateBlueprintVersionRecord} overrides - Optional name/description for the new version.
   * @return {Promise<number>} The new blueprint_id.
   * @throws {ApiNotFoundError} If no active source blueprint exists for the id.
   * @memberof BlueprintRepository
   */
  async createBlueprintVersionFromBlueprint(
    sourceBlueprintId: number,
    overrides: CreateBlueprintVersionRecord
  ): Promise<number> {
    const sqlStatement = SQL`
      WITH source_blueprint AS (
        SELECT
          blueprint_id,
          name,
          description
        FROM blueprint
        WHERE blueprint_id = ${sourceBlueprintId}
          AND record_end_date IS NULL
      ),
      new_blueprint AS (
        INSERT INTO blueprint (
          version_number,
          name,
          description,
          is_default,
          parent_blueprint_id,
          record_effective_date
        )
        SELECT
          (SELECT COALESCE(MAX(version_number), 0) + 1 FROM blueprint),
          COALESCE(${overrides.name ?? null}::text, sb.name),
          COALESCE(${overrides.description ?? null}::text, sb.description),
          false,
          sb.blueprint_id,
          NULL
        FROM source_blueprint sb
        RETURNING blueprint_id
      ),
      new_blueprint_feature_type AS (
        INSERT INTO blueprint_feature_type (
          blueprint_id,
          feature_type_id,
          sort
        )
        SELECT
          nb.blueprint_id,
          source_bft.feature_type_id,
          source_bft.sort
        FROM new_blueprint nb
        JOIN blueprint_feature_type source_bft
          ON source_bft.blueprint_id = ${sourceBlueprintId}
         AND source_bft.record_end_date IS NULL
        RETURNING blueprint_feature_type_id, feature_type_id
      ),
      new_blueprint_feature_type_property AS (
        INSERT INTO blueprint_feature_type_property (
          blueprint_feature_type_id,
          feature_property_id,
          required_value,
          allow_multiple,
          sort
        )
        SELECT
          new_bft.blueprint_feature_type_id,
          source_bftp.feature_property_id,
          source_bftp.required_value,
          source_bftp.allow_multiple,
          source_bftp.sort
        FROM new_blueprint_feature_type new_bft
        -- Map each new Blueprint feature type back to the source row it was copied from. A feature type
        -- is active at most once per Blueprint, so feature_type_id identifies the source row.
        JOIN blueprint_feature_type source_bft
          ON source_bft.blueprint_id = ${sourceBlueprintId}
         AND source_bft.feature_type_id = new_bft.feature_type_id
         AND source_bft.record_end_date IS NULL
        JOIN blueprint_feature_type_property source_bftp
          ON source_bftp.blueprint_feature_type_id = source_bft.blueprint_feature_type_id
         AND source_bftp.record_end_date IS NULL
        RETURNING blueprint_feature_type_property_id, blueprint_feature_type_id, feature_property_id
      ),
      new_feature_type_property_feature AS (
        INSERT INTO feature_type_property_feature (
          blueprint_feature_type_property_id,
          target_feature_type_id
        )
        SELECT
          new_bftp.blueprint_feature_type_property_id,
          ftpf.target_feature_type_id
        FROM new_blueprint_feature_type_property new_bftp
        JOIN new_blueprint_feature_type new_bft
          ON new_bft.blueprint_feature_type_id = new_bftp.blueprint_feature_type_id
        -- Map each new assignment back to its source by feature type and property; a property is
        -- active at most once per Blueprint feature type.
        JOIN blueprint_feature_type source_bft
          ON source_bft.blueprint_id = ${sourceBlueprintId}
         AND source_bft.feature_type_id = new_bft.feature_type_id
         AND source_bft.record_end_date IS NULL
        JOIN blueprint_feature_type_property source_bftp
          ON source_bftp.blueprint_feature_type_id = source_bft.blueprint_feature_type_id
         AND source_bftp.feature_property_id = new_bftp.feature_property_id
         AND source_bftp.record_end_date IS NULL
        JOIN feature_type_property_feature ftpf
          ON ftpf.blueprint_feature_type_property_id = source_bftp.blueprint_feature_type_property_id
         AND ftpf.record_end_date IS NULL
        RETURNING feature_type_property_feature_id
      )
      SELECT
        blueprint_id
      FROM
        new_blueprint;
    `;

    const response = await this.connection.sql<{ blueprint_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiNotFoundError('Blueprint not found', [
        'BlueprintRepository->createBlueprintVersionFromBlueprint',
        { sourceBlueprintId }
      ]);
    }

    return response.rows[0].blueprint_id;
  }

  /**
   * Clear the default flag from the current default blueprint, if any.
   *
   * At most one active blueprint may be the default (partial unique index), so the current default is
   * cleared before another blueprint is published as the default.
   *
   * @return {Promise<void>}
   * @memberof BlueprintRepository
   */
  async clearDefaultBlueprint(): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('blueprint')
      .update({ is_default: false })
      .whereNull('record_end_date')
      .where('is_default', true);

    await this.connection.knex(query);
  }

  /**
   * Publish a draft blueprint, making it available for new uploads from now on.
   *
   * @param {number} blueprintId - Blueprint identifier.
   * @param {boolean} isDefault - Whether the blueprint becomes the default for new submissions.
   * @return {Promise<void>}
   * @throws {ApiNotFoundError} If no active draft blueprint exists for the id.
   * @memberof BlueprintRepository
   */
  async publishBlueprint(blueprintId: number, isDefault: boolean): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('blueprint')
      .update({ record_effective_date: knex.fn.now(), is_default: isDefault })
      .whereNull('record_end_date')
      .whereNull('record_effective_date')
      .where('blueprint_id', blueprintId);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiNotFoundError('Draft blueprint not found', [
        'BlueprintRepository->publishBlueprint',
        { blueprintId }
      ]);
    }
  }

  // ---------------------------------------------------------------------------
  // Admin: blueprint feature types
  // ---------------------------------------------------------------------------

  /**
   * Find the active inclusion of a feature type in a blueprint.
   *
   * Returns `null` when the blueprint does not include the feature type; callers are responsible for
   * deciding whether that constitutes a conflict.
   *
   * @param {number} blueprintId - Blueprint identifier.
   * @param {number} featureTypeId - Feature type identifier.
   * @return {Promise<{ blueprint_feature_type_id: number } | null>} The matching record, or `null` if none exists.
   * @memberof BlueprintRepository
   */
  async findActiveBlueprintFeatureType(
    blueprintId: number,
    featureTypeId: number
  ): Promise<{ blueprint_feature_type_id: number } | null> {
    const knex = getKnex();
    const query = knex
      .from('blueprint_feature_type')
      .select('blueprint_feature_type_id')
      .whereNull('record_end_date')
      .where({ blueprint_id: blueprintId, feature_type_id: featureTypeId })
      .first();

    const response = await this.connection.knex(query);

    return response.rows[0] ?? null;
  }

  /**
   * Include a feature type in a blueprint.
   *
   * @param {CreateBlueprintFeatureTypeRecord} data - Data for the record to insert.
   * @return {Promise<number>} The new blueprint_feature_type_id.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof BlueprintRepository
   */
  async insertBlueprintFeatureType(data: CreateBlueprintFeatureTypeRecord): Promise<number> {
    const knex = getKnex();
    const query = knex
      .table('blueprint_feature_type')
      .insert({
        blueprint_id: data.blueprint_id,
        feature_type_id: data.feature_type_id,
        sort: data.sort ?? null
      })
      .returning(['blueprint_feature_type_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert blueprint feature type', [
        'BlueprintRepository->insertBlueprintFeatureType',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0].blueprint_feature_type_id;
  }

  /**
   * Get a single active blueprint feature type by ID.
   *
   * The lookup is scoped to the parent blueprint, which enforces the nested route hierarchy and
   * prevents a feature type of one blueprint being reached through another.
   *
   * @param {number} blueprintFeatureTypeId - Blueprint feature type identifier.
   * @param {number} blueprintId - Parent blueprint identifier used to scope the lookup.
   * @return {Promise<AdminBlueprintFeatureType>} The blueprint feature type record.
   * @throws {ApiNotFoundError} If no active record exists for the id within the parent blueprint.
   * @memberof BlueprintRepository
   */
  async getAdminBlueprintFeatureType(
    blueprintFeatureTypeId: number,
    blueprintId: number
  ): Promise<AdminBlueprintFeatureType> {
    const knex = getKnex();
    const query = knex
      .from('blueprint_feature_type as bft')
      .join('feature_type as ft', 'ft.feature_type_id', 'bft.feature_type_id')
      .select(ADMIN_BLUEPRINT_FEATURE_TYPE_COLUMNS)
      .whereNull('bft.record_end_date')
      .where('bft.blueprint_feature_type_id', blueprintFeatureTypeId)
      .where('bft.blueprint_id', blueprintId);

    const response = await this.connection.knex(query, AdminBlueprintFeatureType);

    if (response.rowCount !== 1) {
      throw new ApiNotFoundError('Blueprint feature type not found', [
        'BlueprintRepository->getAdminBlueprintFeatureType',
        { blueprintFeatureTypeId, blueprintId }
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get the active feature types included in a blueprint.
   *
   * @param {number} blueprintId - Blueprint identifier to scope results.
   * @return {Promise<AdminBlueprintFeatureType[]>}
   * @memberof BlueprintRepository
   */
  async getAdminBlueprintFeatureTypes(blueprintId: number): Promise<AdminBlueprintFeatureType[]> {
    const knex = getKnex();
    const query = knex
      .from('blueprint_feature_type as bft')
      .join('feature_type as ft', 'ft.feature_type_id', 'bft.feature_type_id')
      .select(ADMIN_BLUEPRINT_FEATURE_TYPE_COLUMNS)
      .whereNull('bft.record_end_date')
      .where('bft.blueprint_id', blueprintId)
      .orderBy('bft.sort', 'asc')
      .orderBy('bft.blueprint_feature_type_id', 'asc');

    const response = await this.connection.knex(query, AdminBlueprintFeatureType);

    return response.rows;
  }

  /**
   * Update an existing blueprint feature type.
   *
   * @param {number} blueprintFeatureTypeId - Blueprint feature type identifier.
   * @param {number} blueprintId - Parent blueprint identifier used to scope the update.
   * @param {UpdateBlueprintFeatureTypeRecord} data - The data to update.
   * @return {Promise<void>}
   * @throws {ApiNotFoundError} If no active record exists for the id within the parent blueprint.
   * @memberof BlueprintRepository
   */
  async updateBlueprintFeatureType(
    blueprintFeatureTypeId: number,
    blueprintId: number,
    data: UpdateBlueprintFeatureTypeRecord
  ): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('blueprint_feature_type')
      .update({ sort: data.sort })
      .whereNull('record_end_date')
      .where('blueprint_feature_type_id', blueprintFeatureTypeId)
      .where('blueprint_id', blueprintId);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiNotFoundError('Blueprint feature type not found', [
        'BlueprintRepository->updateBlueprintFeatureType',
        { blueprintFeatureTypeId, blueprintId }
      ]);
    }
  }

  /**
   * Soft delete a blueprint feature type scoped to a parent blueprint.
   *
   * @param {number} blueprintFeatureTypeId - Blueprint feature type identifier.
   * @param {number} blueprintId - Parent blueprint identifier used to scope the delete.
   * @return {Promise<void>}
   * @throws {ApiNotFoundError} If no active record exists for the id within the parent blueprint.
   * @memberof BlueprintRepository
   */
  async deleteBlueprintFeatureType(blueprintFeatureTypeId: number, blueprintId: number): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('blueprint_feature_type')
      .update({ record_end_date: knex.fn.now() })
      .whereNull('record_end_date')
      .where('blueprint_feature_type_id', blueprintFeatureTypeId)
      .where('blueprint_id', blueprintId)
      .returning(['blueprint_feature_type_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiNotFoundError('Blueprint feature type not found', [
        'BlueprintRepository->deleteBlueprintFeatureType',
        { blueprintFeatureTypeId, blueprintId }
      ]);
    }
  }

  // ---------------------------------------------------------------------------
  // Admin: blueprint feature type properties
  // ---------------------------------------------------------------------------

  /**
   * Find the active assignment of a feature property to a blueprint feature type.
   *
   * Returns `null` when the property is not assigned; callers are responsible for deciding whether
   * that constitutes a conflict.
   *
   * @param {number} blueprintFeatureTypeId - Blueprint feature type identifier.
   * @param {number} featurePropertyId - Feature property identifier.
   * @return {Promise<{ blueprint_feature_type_property_id: number } | null>} The matching record, or `null` if none exists.
   * @memberof BlueprintRepository
   */
  async findActiveBlueprintFeatureTypeProperty(
    blueprintFeatureTypeId: number,
    featurePropertyId: number
  ): Promise<{ blueprint_feature_type_property_id: number } | null> {
    const knex = getKnex();
    const query = knex
      .from('blueprint_feature_type_property')
      .select('blueprint_feature_type_property_id')
      .whereNull('record_end_date')
      .where({ blueprint_feature_type_id: blueprintFeatureTypeId, feature_property_id: featurePropertyId })
      .first();

    const response = await this.connection.knex(query);

    return response.rows[0] ?? null;
  }

  /**
   * Assign a feature property to a blueprint feature type.
   *
   * @param {CreateBlueprintFeatureTypePropertyRecord} data - Data for the record to insert.
   * @return {Promise<number>} The new blueprint_feature_type_property_id.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof BlueprintRepository
   */
  async insertBlueprintFeatureTypeProperty(data: CreateBlueprintFeatureTypePropertyRecord): Promise<number> {
    const knex = getKnex();
    const query = knex
      .table('blueprint_feature_type_property')
      .insert({
        blueprint_feature_type_id: data.blueprint_feature_type_id,
        feature_property_id: data.feature_property_id,
        required_value: data.required_value ?? false,
        allow_multiple: data.allow_multiple ?? false,
        sort: data.sort ?? null
      })
      .returning(['blueprint_feature_type_property_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert blueprint feature type property', [
        'BlueprintRepository->insertBlueprintFeatureTypeProperty',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0].blueprint_feature_type_property_id;
  }

  /**
   * Get a single active blueprint feature type property by ID.
   *
   * The lookup is scoped to the parent blueprint feature type, which enforces the nested route
   * hierarchy and prevents cross-feature-type mutations.
   *
   * @param {number} blueprintFeatureTypePropertyId - Blueprint feature type property identifier.
   * @param {number} blueprintFeatureTypeId - Parent blueprint feature type identifier used to scope the lookup.
   * @return {Promise<AdminBlueprintFeatureTypeProperty>} The assignment record.
   * @throws {ApiNotFoundError} If no active record exists for the id within the parent blueprint feature type.
   * @memberof BlueprintRepository
   */
  async getAdminBlueprintFeatureTypeProperty(
    blueprintFeatureTypePropertyId: number,
    blueprintFeatureTypeId: number
  ): Promise<AdminBlueprintFeatureTypeProperty> {
    const knex = getKnex();
    const query = knex
      .from('blueprint_feature_type_property as bftp')
      .join('feature_property as fp', 'fp.feature_property_id', 'bftp.feature_property_id')
      .join('feature_property_type as fpt', 'fpt.feature_property_type_id', 'fp.feature_property_type_id')
      .select(ADMIN_BLUEPRINT_FEATURE_TYPE_PROPERTY_COLUMNS)
      .whereNull('bftp.record_end_date')
      .where('bftp.blueprint_feature_type_property_id', blueprintFeatureTypePropertyId)
      .where('bftp.blueprint_feature_type_id', blueprintFeatureTypeId);

    const response = await this.connection.knex(query, AdminBlueprintFeatureTypeProperty);

    if (response.rowCount !== 1) {
      throw new ApiNotFoundError('Blueprint feature type property not found', [
        'BlueprintRepository->getAdminBlueprintFeatureTypeProperty',
        { blueprintFeatureTypePropertyId, blueprintFeatureTypeId }
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get the active properties assigned to a blueprint feature type.
   *
   * @param {number} blueprintFeatureTypeId - Blueprint feature type identifier to scope results.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<AdminBlueprintFeatureTypeProperty[]>}
   * @memberof BlueprintRepository
   */
  async getAdminBlueprintFeatureTypeProperties(
    blueprintFeatureTypeId: number,
    pagination?: ApiPaginationOptions
  ): Promise<AdminBlueprintFeatureTypeProperty[]> {
    const knex = getKnex();
    const query = knex
      .from('blueprint_feature_type_property as bftp')
      .join('feature_property as fp', 'fp.feature_property_id', 'bftp.feature_property_id')
      .join('feature_property_type as fpt', 'fpt.feature_property_type_id', 'fp.feature_property_type_id')
      .select(ADMIN_BLUEPRINT_FEATURE_TYPE_PROPERTY_COLUMNS)
      .whereNull('bftp.record_end_date')
      .where('bftp.blueprint_feature_type_id', blueprintFeatureTypeId)
      .orderBy('bftp.sort', 'asc')
      .orderBy('bftp.blueprint_feature_type_property_id', 'asc');

    if (pagination) {
      this.applyPagination(query, pagination);
    }

    const response = await this.connection.knex(query, AdminBlueprintFeatureTypeProperty);

    return response.rows;
  }

  /**
   * Get count of active properties assigned to a blueprint feature type.
   *
   * @param {number} blueprintFeatureTypeId - Blueprint feature type identifier to scope the count.
   * @return {Promise<number>}
   * @memberof BlueprintRepository
   */
  async getAdminBlueprintFeatureTypePropertiesCount(blueprintFeatureTypeId: number): Promise<number> {
    const knex = getKnex();
    const countQuery = knex
      .from('blueprint_feature_type_property')
      .whereNull('record_end_date')
      .where('blueprint_feature_type_id', blueprintFeatureTypeId)
      .select(knex.raw('coalesce(count(*), 0)::integer as count'))
      .first();

    const countResult = await this.connection.knex(countQuery, CountResult);
    return countResult.rows[0].count;
  }

  /**
   * Update an existing blueprint feature type property assignment.
   *
   * @param {number} blueprintFeatureTypePropertyId - Blueprint feature type property identifier.
   * @param {number} blueprintFeatureTypeId - Parent blueprint feature type identifier used to scope the update.
   * @param {UpdateBlueprintFeatureTypePropertyRecord} data - The data to update.
   * @return {Promise<void>}
   * @throws {ApiNotFoundError} If no active record exists for the id within the parent blueprint feature type.
   * @memberof BlueprintRepository
   */
  async updateBlueprintFeatureTypeProperty(
    blueprintFeatureTypePropertyId: number,
    blueprintFeatureTypeId: number,
    data: UpdateBlueprintFeatureTypePropertyRecord
  ): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('blueprint_feature_type_property')
      .update({
        required_value: data.required_value,
        allow_multiple: data.allow_multiple,
        sort: data.sort
      })
      .whereNull('record_end_date')
      .where('blueprint_feature_type_property_id', blueprintFeatureTypePropertyId)
      .where('blueprint_feature_type_id', blueprintFeatureTypeId);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiNotFoundError('Blueprint feature type property not found', [
        'BlueprintRepository->updateBlueprintFeatureTypeProperty',
        { blueprintFeatureTypePropertyId, blueprintFeatureTypeId }
      ]);
    }
  }

  /**
   * Soft delete a blueprint feature type property assignment scoped to a parent blueprint feature type.
   *
   * @param {number} blueprintFeatureTypePropertyId - Blueprint feature type property identifier.
   * @param {number} blueprintFeatureTypeId - Parent blueprint feature type identifier used to scope the delete.
   * @return {Promise<void>}
   * @throws {ApiNotFoundError} If no active record exists for the id within the parent blueprint feature type.
   * @memberof BlueprintRepository
   */
  async deleteBlueprintFeatureTypeProperty(
    blueprintFeatureTypePropertyId: number,
    blueprintFeatureTypeId: number
  ): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('blueprint_feature_type_property')
      .update({ record_end_date: knex.fn.now() })
      .whereNull('record_end_date')
      .where('blueprint_feature_type_property_id', blueprintFeatureTypePropertyId)
      .where('blueprint_feature_type_id', blueprintFeatureTypeId)
      .returning(['blueprint_feature_type_property_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiNotFoundError('Blueprint feature type property not found', [
        'BlueprintRepository->deleteBlueprintFeatureTypeProperty',
        { blueprintFeatureTypePropertyId, blueprintFeatureTypeId }
      ]);
    }
  }

  /**
   * Soft delete every active property assignment of a blueprint feature type.
   *
   * Used when the feature type itself is removed from the blueprint, so no active assignment is left
   * under a retired parent.
   *
   * @param {number} blueprintFeatureTypeId - Blueprint feature type identifier.
   * @return {Promise<void>}
   * @memberof BlueprintRepository
   */
  async deleteBlueprintFeatureTypePropertiesByBlueprintFeatureTypeId(blueprintFeatureTypeId: number): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('blueprint_feature_type_property')
      .update({ record_end_date: knex.fn.now() })
      .whereNull('record_end_date')
      .where('blueprint_feature_type_id', blueprintFeatureTypeId);

    await this.connection.knex(query);
  }
}
