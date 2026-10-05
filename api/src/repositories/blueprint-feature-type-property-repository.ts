import { Knex } from 'knex';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { CreateBlueprintFeatureTypePropertyRecord } from '../models/blueprint';
import {
  BlueprintFeaturePropertyAssignment,
  BlueprintFeaturePropertyFilters,
  UpdateBlueprintFeaturePropertyAssignment
} from '../models/blueprint-composition';
import { CountResult } from '../models/count';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

const COLUMNS = [
  'a.blueprint_feature_type_property_id',
  'a.blueprint_feature_type_id',
  'a.feature_property_id',
  'ft.name as feature_type_name',
  'g.name',
  'g.display_name',
  'g.description',
  'pt.name as type_name',
  'a.required_value',
  'a.allow_multiple',
  'a.sort',
  'a.record_end_date'
];

/**
 * Persistence for blueprint-specific property memberships, including historical assignments.
 */
export class BlueprintFeatureTypePropertyRepository extends BaseRepository {
  /**
   * Build a scoped joined read without filtering ended global definitions.
   *
   * @param query Scoped base query.
   * @param filters Search filters; deleted memberships are always excluded.
   * @returns Scoped query builder.
   */
  private applyBlueprintFeatureTypePropertyFilters(
    query: Knex.QueryBuilder,
    filters: BlueprintFeaturePropertyFilters
  ): Knex.QueryBuilder {
    if (filters.keyword) {
      query.where(function () {
        this.whereILike('g.name', `%${filters.keyword}%`).orWhereILike('g.display_name', `%${filters.keyword}%`);
      });
    }
    if (filters.blueprintFeatureTypeId !== undefined) {
      query.where('a.blueprint_feature_type_id', filters.blueprintFeatureTypeId);
    }
    query.whereNull('a.record_end_date');
    query.whereNull('bft.record_end_date');
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
  async getBlueprintFeatureTypeProperties(
    blueprintId: number,
    filters: BlueprintFeaturePropertyFilters,
    pagination: ApiPaginationOptions
  ): Promise<BlueprintFeaturePropertyAssignment[]> {
    const knex = getKnex();
    const query = knex('blueprint_feature_type_property as a')
      .join('blueprint_feature_type as bft', 'bft.blueprint_feature_type_id', 'a.blueprint_feature_type_id')
      .join('feature_type as ft', 'ft.feature_type_id', 'bft.feature_type_id')
      .join('feature_property as g', 'g.feature_property_id', 'a.feature_property_id')
      .join('feature_property_type as pt', 'pt.feature_property_type_id', 'g.feature_property_type_id')
      .where('bft.blueprint_id', blueprintId);
    this.applyBlueprintFeatureTypePropertyFilters(query, filters)
      .select(COLUMNS)
      .orderBy(pagination.sort ?? 'name', pagination.order ?? 'asc', 'last')
      .orderBy('a.blueprint_feature_type_property_id', 'asc')
      .limit(pagination.limit)
      .offset((pagination.page - 1) * pagination.limit);
    const response = await this.connection.knex(query, BlueprintFeaturePropertyAssignment);
    return response.rows;
  }

  /**
   * Count non-deleted assignments using the same scoped predicates as the list.
   *
   * @param blueprintId Owning blueprint.
   * @param filters Search filters.
   * @returns Count row.
   */
  async getBlueprintFeatureTypePropertiesCount(
    blueprintId: number,
    filters: BlueprintFeaturePropertyFilters
  ): Promise<CountResult> {
    const knex = getKnex();
    const query = knex('blueprint_feature_type_property as a')
      .join('blueprint_feature_type as bft', 'bft.blueprint_feature_type_id', 'a.blueprint_feature_type_id')
      .join('feature_type as ft', 'ft.feature_type_id', 'bft.feature_type_id')
      .join('feature_property as g', 'g.feature_property_id', 'a.feature_property_id')
      .join('feature_property_type as pt', 'pt.feature_property_type_id', 'g.feature_property_type_id')
      .where('bft.blueprint_id', blueprintId);
    this.applyBlueprintFeatureTypePropertyFilters(query, filters).select(knex.raw('count(*)::integer as count'));
    const response = await this.connection.knex(query, CountResult);
    return response.rows[0];
  }

  /**
   * Read one assignment using blueprint ownership in the database predicate.
   *
   * @param blueprintId Owning blueprint.
   * @param blueprintFeatureTypePropertyId Assignment identifier.
   * @returns Metadata or undefined.
   */
  async getBlueprintFeatureTypePropertyById(
    blueprintId: number,
    blueprintFeatureTypePropertyId: number
  ): Promise<BlueprintFeaturePropertyAssignment> {
    const knex = getKnex();
    const query = knex('blueprint_feature_type_property as a')
      .join('blueprint_feature_type as bft', 'bft.blueprint_feature_type_id', 'a.blueprint_feature_type_id')
      .join('feature_type as ft', 'ft.feature_type_id', 'bft.feature_type_id')
      .join('feature_property as g', 'g.feature_property_id', 'a.feature_property_id')
      .join('feature_property_type as pt', 'pt.feature_property_type_id', 'g.feature_property_type_id')
      .where('bft.blueprint_id', blueprintId);
    query.select(COLUMNS).where('a.blueprint_feature_type_property_id', blueprintFeatureTypePropertyId);
    const response = await this.connection.knex(query, BlueprintFeaturePropertyAssignment);
    if (!response.rows[0]) {
      throw new ApiNotFoundError('Assignment or available definition not found');
    }
    return response.rows[0];
  }

  /**
   * Update only supplied mutable settings in the selected blueprint.
   *
   * @param blueprintId Owning blueprint.
   * @param blueprintFeatureTypePropertyId Assignment identifier.
   * @param data Supplied settings.
   * @returns Resolves after persistence.
   */
  async updateBlueprintFeatureTypeProperty(
    blueprintId: number,
    blueprintFeatureTypePropertyId: number,
    data: UpdateBlueprintFeaturePropertyAssignment
  ): Promise<void> {
    const knex = getKnex();
    const query = knex('blueprint_feature_type_property')
      .whereIn(
        'blueprint_feature_type_id',
        knex('blueprint_feature_type').select('blueprint_feature_type_id').where('blueprint_id', blueprintId)
      )
      .where('blueprint_feature_type_property_id', blueprintFeatureTypePropertyId)
      .whereNull('record_end_date')
      .update({ required_value: data.requiredValue, allow_multiple: data.allowMultiple });
    await this.connection.knex(query);
  }

  /**
   * End an active assignment without deleting historical references.
   *
   * @param blueprintId Owning blueprint.
   * @param blueprintFeatureTypePropertyId Assignment identifier.
   * @param date Database lifecycle date for deleting the property assignment.
   * @returns Resolves after persistence.
   */
  async deleteBlueprintFeatureTypeProperty(
    blueprintId: number,
    blueprintFeatureTypePropertyId: number,
    date: string
  ): Promise<void> {
    const knex = getKnex();
    const query = knex('blueprint_feature_type_property')
      .whereIn(
        'blueprint_feature_type_id',
        knex('blueprint_feature_type').select('blueprint_feature_type_id').where('blueprint_id', blueprintId)
      )
      .where('blueprint_feature_type_property_id', blueprintFeatureTypePropertyId)
      .whereNull('record_end_date')
      .update({ record_end_date: date });
    await this.connection.knex(query);
  }

  /**
   * Locate an active duplicate inside the exact membership scope.
   *
   * @param blueprintFeatureTypeId Owning blueprint feature-type assignment.
   * @param featurePropertyId Global definition identifier.
   * @returns Count row.
   */
  async getActiveBlueprintFeatureTypePropertyCount(
    blueprintFeatureTypeId: number,
    featurePropertyId: number
  ): Promise<CountResult> {
    const knex = getKnex();
    const query = knex('blueprint_feature_type_property')
      .where('blueprint_feature_type_id', blueprintFeatureTypeId)
      .where('feature_property_id', featurePropertyId)
      .whereNull('record_end_date')
      .select(knex.raw('count(*)::integer as count'));
    const response = await this.connection.knex(query, CountResult);
    return response.rows[0];
  }

  /**
   * Delete only active children of a validated blueprint feature-type assignment.
   *
   * @param blueprintFeatureTypeId Validated parent assignment identifier.
   * @param date Database date shared with parent deletion.
   * @returns Resolves after set-based persistence.
   */
  async deleteBlueprintFeatureTypePropertiesByBlueprintFeatureTypeId(
    blueprintFeatureTypeId: number,
    date: string
  ): Promise<void> {
    const knex = getKnex();
    const query = knex('blueprint_feature_type_property')
      .where('blueprint_feature_type_id', blueprintFeatureTypeId)
      .whereNull('record_end_date')
      .update({ record_end_date: date });
    await this.connection.knex(query);
  }
  /**
   * Copy non-deleted properties onto the new blueprint's corresponding feature memberships.
   *
   * Preserve assignment settings without creating global relationships.
   *
   * @param sourceBlueprintId Parent blueprint supplying the composition.
   * @param blueprintId New blueprint whose feature memberships have already been copied.
   * @returns Resolves after independent property assignments are inserted.
   */
  async copyBlueprintFeatureTypeProperties(sourceBlueprintId: number, blueprintId: number): Promise<void> {
    const knex = getKnex();
    const query = knex.raw(
      `INSERT INTO blueprint_feature_type_property (
        blueprint_feature_type_id, feature_property_id,
        required_value, allow_multiple, sort
      )
      SELECT target.blueprint_feature_type_id, property.feature_property_id,
        property.required_value, property.allow_multiple, property.sort
      FROM blueprint_feature_type_property property
      JOIN blueprint_feature_type source ON source.blueprint_feature_type_id = property.blueprint_feature_type_id
      JOIN blueprint_feature_type target ON target.feature_type_id = source.feature_type_id
      WHERE source.blueprint_id = ? AND target.blueprint_id = ?
        AND source.record_end_date IS NULL AND target.record_end_date IS NULL AND property.record_end_date IS NULL`,
      [sourceBlueprintId, blueprintId]
    );
    await this.connection.knex(query);
  }

  /**
   * Assign a feature property to a blueprint feature type.
   *
   * @param {CreateBlueprintFeatureTypePropertyRecord} data - Data for the record to insert.
   * @return {Promise<number>} The new blueprint_feature_type_property_id.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof BlueprintFeatureTypePropertyRepository
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
        'BlueprintFeatureTypePropertyRepository->insertBlueprintFeatureTypeProperty',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0].blueprint_feature_type_property_id;
  }
}
