import { getKnex } from '../database/db';
import { BaseRepository } from './base-repository';

/**
 * Persist allowed reference targets belonging to blueprint property assignments.
 */
export class FeatureTypePropertyFeatureRepository extends BaseRepository {
  /**
   * Copy active reference targets onto the corresponding assignments of a new blueprint.
   *
   * @param sourceBlueprintId Parent blueprint supplying the allowed targets.
   * @param blueprintId New blueprint whose feature and property assignments have already been copied.
   * @returns Resolves after the target configuration is copied.
   */
  async copyBlueprintReferenceTargets(sourceBlueprintId: number, blueprintId: number): Promise<void> {
    const knex = getKnex();
    const query = knex.raw(
      `INSERT INTO feature_type_property_feature (blueprint_feature_type_property_id, target_feature_type_id)
       SELECT target_property.blueprint_feature_type_property_id, reference.target_feature_type_id
       FROM feature_type_property_feature reference
       JOIN blueprint_feature_type_property source_property
         ON source_property.blueprint_feature_type_property_id = reference.blueprint_feature_type_property_id
       JOIN blueprint_feature_type source_type
         ON source_type.blueprint_feature_type_id = source_property.blueprint_feature_type_id
       JOIN blueprint_feature_type target_type
         ON target_type.feature_type_id = source_type.feature_type_id
       JOIN blueprint_feature_type_property target_property
         ON target_property.blueprint_feature_type_id = target_type.blueprint_feature_type_id
         AND target_property.feature_property_id = source_property.feature_property_id
       WHERE source_type.blueprint_id = ? AND target_type.blueprint_id = ?
         AND reference.record_end_date IS NULL
         AND source_type.record_end_date IS NULL AND source_property.record_end_date IS NULL
         AND target_type.record_end_date IS NULL AND target_property.record_end_date IS NULL`,
      [sourceBlueprintId, blueprintId]
    );
    await this.connection.knex(query);
  }
}
