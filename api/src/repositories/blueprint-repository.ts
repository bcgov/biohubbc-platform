import { Knex } from 'knex';
import { SQL } from 'sql-template-strings';
import { BLUEPRINT_COLUMNS } from '../constants/blueprint';
import { getKnex } from '../database/db';
import { ApiNotFoundError } from '../errors/api-error';
import {
  AdminBlueprint,
  Blueprint,
  BlueprintFilters,
  CreateBlueprint,
  CreateBlueprintVersionRecord,
  UpdateBlueprint
} from '../models/blueprint';
import { CountResult } from '../models/count';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

/**
 * Columns selected for admin blueprint responses.
 */
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
   * Create a draft version's metadata from an active source blueprint.
   *
   * @param sourceBlueprintId Source blueprint whose metadata is inherited.
   * @param overrides Supplied name and description overrides.
   * @returns New blueprint identifier; composition is copied separately in the same transaction.
   */
  async createBlueprintVersionFromBlueprint(
    sourceBlueprintId: number,
    overrides: CreateBlueprintVersionRecord
  ): Promise<number> {
    const knex = getKnex();
    const query = knex.raw(
      `INSERT INTO blueprint (version_number, name, description, is_default, parent_blueprint_id, record_effective_date)
       SELECT (SELECT COALESCE(MAX(version_number), 0) + 1 FROM blueprint),
         COALESCE(?::text, name), COALESCE(?::text, description), false, blueprint_id, NULL
       FROM blueprint WHERE blueprint_id = ? AND record_end_date IS NULL
       RETURNING blueprint_id`,
      [overrides.name ?? null, overrides.description ?? null, sourceBlueprintId]
    );
    const response = await this.connection.knex(query, Blueprint.pick({ blueprint_id: true }));
    if (!response.rows[0]) {
      throw new ApiNotFoundError('Blueprint not found');
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

  /**
   * Serialize administrative writes before any lifecycle or lineage reads.
   *
   * @returns Database date used throughout the administrative operation.
   */
  async lockBlueprintAdministration(): Promise<string> {
    const query = SQL`SELECT CURRENT_DATE::text AS current_date FROM
      pg_advisory_xact_lock(hashtext('blueprint_administration'));`;
    const response = await this.connection.sql<{ current_date: string }>(query);
    return response.rows[0].current_date;
  }

  /**
   * Retrieve administrative metadata without applying upload availability predicates.
   *
   * @param blueprintId Blueprint identifier.
   * @returns Metadata, or undefined when absent.
   */
  async getBlueprint(blueprintId: number): Promise<Blueprint | undefined> {
    const knex = getKnex();
    const query = knex('blueprint').select(BLUEPRINT_COLUMNS).where('blueprint_id', blueprintId);
    const response = await this.connection.knex(query, Blueprint);
    return response.rows[0];
  }

  /**
   * List blueprint metadata across all lifecycle states.
   *
   * @param filters Administrative search filters.
   * @param pagination Validated pagination and sorting.
   * @returns Matching page of blueprints.
   */
  async getBlueprints(filters: BlueprintFilters, pagination: ApiPaginationOptions): Promise<Blueprint[]> {
    const knex = getKnex();
    const query = this.applyBlueprintFilters(knex('blueprint').select(BLUEPRINT_COLUMNS), filters)
      .orderBy(pagination.sort ?? 'name', pagination.order ?? 'asc', 'last')
      .orderBy('blueprint_id', 'asc')
      .limit(pagination.limit)
      .offset((pagination.page - 1) * pagination.limit);
    const response = await this.connection.knex(query, Blueprint);
    return response.rows;
  }

  /**
   * Count blueprints using the same predicates as the administrative list.
   *
   * @param filters Administrative search filters.
   * @returns Matching count row.
   */
  async getBlueprintsCount(filters: BlueprintFilters): Promise<CountResult> {
    const knex = getKnex();
    const query = this.applyBlueprintFilters(knex('blueprint'), filters).select(knex.raw('count(*)::integer AS count'));
    const response = await this.connection.knex(query, CountResult);
    return response.rows[0];
  }

  /**
   * Insert metadata with the next version across all lifecycle states.
   * The caller must hold the blueprint administration lock before insertion.
   *
   * @param data Validated creation fields.
   * @returns Created blueprint.
   */
  async insertBlueprint(data: CreateBlueprint): Promise<Blueprint> {
    const knex = getKnex();
    const query = knex('blueprint')
      .insert({
        name: data.name,
        version_number: knex('blueprint').select(knex.raw('COALESCE(MAX(version_number), 0) + 1')),
        description: data.description ?? null,
        parent_blueprint_id: data.parentBlueprintId ?? null,
        record_effective_date: data.recordEffectiveDate ?? null,
        is_default: false
      })
      .returning(BLUEPRINT_COLUMNS);
    const response = await this.connection.knex(query, Blueprint);
    return response.rows[0];
  }

  /**
   * Update supplied metadata fields; undefined values are omitted by Knex.
   *
   * @param blueprintId Blueprint identifier.
   * @param data Validated mutable metadata.
   * @returns Updated blueprint.
   */
  async updateBlueprint(blueprintId: number, data: UpdateBlueprint): Promise<Blueprint> {
    const knex = getKnex();
    const query = knex('blueprint')
      .where('blueprint_id', blueprintId)
      .update({
        name: data.name,
        description: data.description,
        parent_blueprint_id: data.parentBlueprintId,
        record_effective_date: data.recordEffectiveDate
      })
      .returning(BLUEPRINT_COLUMNS);
    const response = await this.connection.knex(query, Blueprint);
    return response.rows[0];
  }

  /**
   * Retire a blueprint while preserving its references and composition.
   *
   * @param blueprintId Blueprint identifier.
   * @returns Retired metadata.
   */
  async retireBlueprint(blueprintId: number): Promise<Blueprint> {
    const knex = getKnex();
    const query = knex('blueprint')
      .where('blueprint_id', blueprintId)
      .update({ record_end_date: knex.raw('CURRENT_DATE'), is_default: false })
      .returning(BLUEPRINT_COLUMNS);
    const response = await this.connection.knex(query, Blueprint);
    return response.rows[0];
  }

  /**
   * Mark an already validated blueprint as default within the caller's transaction.
   *
   * @param blueprintId Blueprint identifier.
   * @returns New default metadata.
   */
  async setDefaultBlueprint(blueprintId: number): Promise<Blueprint> {
    const knex = getKnex();
    const query = knex('blueprint')
      .where('blueprint_id', blueprintId)
      .update({ is_default: true })
      .returning(BLUEPRINT_COLUMNS);
    const response = await this.connection.knex(query, Blueprint);
    return response.rows[0];
  }

  /**
   * Traverse lineage including retired rows. UNION bounds traversal even for an existing cycle.
   *
   * @param parentBlueprintId Proposed parent identifier.
   * @returns Parent and ancestor identifiers.
   */
  async getBlueprintAncestorIds(parentBlueprintId: number): Promise<number[]> {
    const query = SQL`WITH RECURSIVE lineage AS (
      SELECT blueprint_id, parent_blueprint_id FROM blueprint WHERE blueprint_id = ${parentBlueprintId}
      UNION
      SELECT b.blueprint_id, b.parent_blueprint_id FROM blueprint b
      JOIN lineage l ON b.blueprint_id = l.parent_blueprint_id
    ) SELECT blueprint_id FROM lineage;`;
    const response = await this.connection.sql<{ blueprint_id: number }>(query);
    return response.rows.map((row) => row.blueprint_id);
  }

  /**
   * Apply administrative keyword predicates to list and count queries.
   *
   * @param query Base query.
   * @param filters Administrative filters.
   * @returns Filtered query.
   */
  private applyBlueprintFilters(query: Knex.QueryBuilder, filters: BlueprintFilters): Knex.QueryBuilder {
    if (filters.keyword) {
      query.whereILike('name', `%${filters.keyword}%`);
    }
    return query;
  }
}
