import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiNotFoundError } from '../errors/api-error';
import {
  BlueprintCompositionFilters,
  BlueprintFeatureTypeAssignment,
  BlueprintFeatureTypeKey,
  EnsureBlueprintFeatureType
} from '../models/blueprint-composition';
import { CountResult } from '../models/count';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

const COLUMNS = [
  'a.blueprint_feature_type_id',
  'a.blueprint_id',
  'a.feature_type_id',
  'g.name',
  'g.display_name',
  'g.description',
  'a.sort',
  'a.record_end_date'
];

/**
 * Persistence for blueprint-specific type memberships, including historical assignments.
 */
export class BlueprintFeatureTypeRepository extends BaseRepository {
  /**
   * Build a scoped joined read without filtering ended global definitions.
   *
   * @param query Scoped base query.
   * @param filters Search filters; deleted memberships are always excluded.
   * @returns Scoped query builder.
   */
  private applyBlueprintFeatureTypeFilters(
    query: Knex.QueryBuilder,
    filters: BlueprintCompositionFilters
  ): Knex.QueryBuilder {
    if (filters.keyword) {
      query.where(function () {
        this.whereILike('g.name', `%${filters.keyword}%`).orWhereILike('g.display_name', `%${filters.keyword}%`);
      });
    }
    query.whereNull('a.record_end_date');
    return query;
  }

  /**
   * List a deterministic page of non-deleted assignments in this blueprint.
   *
   * @param blueprintId Owning blueprint.
   * @param filters Search filters.
   * @param pagination Requested column ordering and page.
   * @returns Joined assignment rows.
   */
  async getBlueprintFeatureTypes(
    blueprintId: number,
    filters: BlueprintCompositionFilters,
    pagination: ApiPaginationOptions
  ): Promise<BlueprintFeatureTypeAssignment[]> {
    const knex = getKnex();
    const query = knex('blueprint_feature_type as a')
      .join('feature_type as g', 'g.feature_type_id', 'a.feature_type_id')
      .where('a.blueprint_id', blueprintId);
    this.applyBlueprintFeatureTypeFilters(query, filters)
      .select(COLUMNS)
      .orderBy(pagination.sort ?? 'name', pagination.order ?? 'asc', 'last')
      .orderBy('a.blueprint_feature_type_id', 'asc')
      .limit(pagination.limit)
      .offset((pagination.page - 1) * pagination.limit);
    const response = await this.connection.knex(query, BlueprintFeatureTypeAssignment);
    return response.rows;
  }

  /**
   * Count non-deleted assignments using the same scoped predicates as the list.
   *
   * @param blueprintId Owning blueprint.
   * @param filters Search filters.
   * @returns Count row.
   */
  async getBlueprintFeatureTypesCount(blueprintId: number, filters: BlueprintCompositionFilters): Promise<CountResult> {
    const knex = getKnex();
    const query = knex('blueprint_feature_type as a')
      .join('feature_type as g', 'g.feature_type_id', 'a.feature_type_id')
      .where('a.blueprint_id', blueprintId);
    this.applyBlueprintFeatureTypeFilters(query, filters).select(knex.raw('count(*)::integer as count'));
    const response = await this.connection.knex(query, CountResult);
    return response.rows[0];
  }

  /**
   * Read one assignment using blueprint ownership in the database predicate.
   *
   * @param blueprintId Owning blueprint.
   * @param blueprintFeatureTypeId Assignment identifier.
   * @returns Metadata or undefined.
   */
  async getBlueprintFeatureTypeById(
    blueprintId: number,
    blueprintFeatureTypeId: number
  ): Promise<BlueprintFeatureTypeAssignment> {
    const knex = getKnex();
    const query = knex('blueprint_feature_type as a')
      .join('feature_type as g', 'g.feature_type_id', 'a.feature_type_id')
      .where('a.blueprint_id', blueprintId);
    query.select(COLUMNS).where('a.blueprint_feature_type_id', blueprintFeatureTypeId);
    const response = await this.connection.knex(query, BlueprintFeatureTypeAssignment);
    if (!response.rows[0]) {
      throw new ApiNotFoundError('Assignment or available definition not found');
    }
    return response.rows[0];
  }

  /**
   * End an active assignment without deleting historical references.
   *
   * @param blueprintId Owning blueprint.
   * @param blueprintFeatureTypeId Assignment identifier.
   * @param date Database lifecycle date shared with child deletion.
   * @returns Resolves after persistence.
   */
  async deleteBlueprintFeatureType(blueprintId: number, blueprintFeatureTypeId: number, date: string): Promise<void> {
    const knex = getKnex();
    const query = knex('blueprint_feature_type')
      .where('blueprint_id', blueprintId)
      .where('blueprint_feature_type_id', blueprintFeatureTypeId)
      .whereNull('record_end_date')
      .update({ record_end_date: date });
    await this.connection.knex(query);
  }

  /**
   * Locate an active duplicate inside the exact membership scope.
   *
   * @param blueprintId Owning blueprint.
   * @param featureTypeId Global definition identifier.
   * @returns Count row.
   */
  async getActiveBlueprintFeatureTypeCount(blueprintId: number, featureTypeId: number): Promise<CountResult> {
    const knex = getKnex();
    const query = knex('blueprint_feature_type')
      .where('blueprint_id', blueprintId)
      .where('feature_type_id', featureTypeId)
      .whereNull('record_end_date')
      .select(knex.raw('count(*)::integer as count'));
    const response = await this.connection.knex(query, CountResult);
    return response.rows[0];
  }

  /**
   * Insert an independent feature-type membership.
   *
   * @param blueprintId Owning blueprint.
   * @param featureTypeId Reusable definition.
   * @returns Created identifier.
   */
  async insertBlueprintFeatureType(blueprintId: number, featureTypeId: number): Promise<number> {
    const knex = getKnex();
    const query = knex('blueprint_feature_type')
      .insert({ blueprint_id: blueprintId, feature_type_id: featureTypeId })
      .returning('blueprint_feature_type_id');
    const response = await this.connection.knex(
      query,
      BlueprintFeatureTypeAssignment.pick({ blueprint_feature_type_id: true })
    );
    return response.rows[0].blueprint_feature_type_id;
  }
  /**
   * Copy non-deleted feature memberships into a newly created blueprint.
   *
   * @param sourceBlueprintId Parent blueprint supplying the composition.
   * @param blueprintId New blueprint receiving independent assignment rows.
   * @returns Resolves after the assignments are copied.
   */
  async copyBlueprintFeatureTypes(sourceBlueprintId: number, blueprintId: number): Promise<void> {
    const knex = getKnex();
    const query = knex.raw(
      `INSERT INTO blueprint_feature_type (blueprint_id, feature_type_id, sort)
       SELECT ?, feature_type_id, sort FROM blueprint_feature_type
       WHERE blueprint_id = ? AND record_end_date IS NULL`,
      [blueprintId, sourceBlueprintId]
    );
    await this.connection.knex(query);
  }

  /**
   * Ensure each feature type has an active membership in the blueprint with the given sort, in one statement.
   * Existing active memberships keep their identifiers.
   *
   * @param blueprintId Owning blueprint.
   * @param featureTypes Feature types and their sort order.
   * @returns Active membership identifiers of the supplied feature types.
   */
  async ensureBlueprintFeatureTypes(
    blueprintId: number,
    featureTypes: EnsureBlueprintFeatureType[]
  ): Promise<BlueprintFeatureTypeKey[]> {
    if (!featureTypes.length) {
      return [];
    }

    const featureTypeIds = featureTypes.map((featureType) => featureType.featureTypeId);
    const sorts = featureTypes.map((featureType) => featureType.sort);

    const sqlStatement = SQL`
      INSERT INTO blueprint_feature_type (blueprint_id, feature_type_id, sort)
      SELECT ${blueprintId}, requested.feature_type_id, requested.sort
      FROM unnest(${featureTypeIds}::integer[], ${sorts}::integer[]) AS requested(feature_type_id, sort)
      ON CONFLICT (blueprint_id, feature_type_id) WHERE record_end_date IS NULL
      DO UPDATE SET sort = EXCLUDED.sort
      RETURNING blueprint_feature_type_id, feature_type_id;
    `;

    const response = await this.connection.sql(sqlStatement, BlueprintFeatureTypeKey);

    return response.rows;
  }

  /**
   * End the active memberships of a blueprint whose feature type is not retained. An empty list ends every active
   * membership of that blueprint only.
   *
   * @param blueprintId Owning blueprint.
   * @param featureTypeIds Feature types to retain.
   * @param date Database lifecycle date shared with child deletion.
   * @returns Resolves after persistence.
   */
  async deleteBlueprintFeatureTypesNotIn(blueprintId: number, featureTypeIds: number[], date: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE blueprint_feature_type
      SET record_end_date = ${date}
      WHERE blueprint_id = ${blueprintId}
        AND record_end_date IS NULL
        AND NOT (feature_type_id = ANY(${featureTypeIds}::integer[]));
    `;

    await this.connection.sql(sqlStatement);
  }
}
