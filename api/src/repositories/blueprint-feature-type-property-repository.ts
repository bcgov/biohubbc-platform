import { getKnex } from '../database/db';
import { BaseRepository } from './base-repository';

/**
 * Persistence for blueprint-specific property memberships.
 */
export class BlueprintFeatureTypePropertyRepository extends BaseRepository {
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
}
