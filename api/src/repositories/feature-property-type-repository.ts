import { getKnex } from '../database/db';
import { FeaturePropertyType } from '../models/feature-property-type';
import { BaseRepository } from './base-repository';

export class FeaturePropertyTypeRepository extends BaseRepository {
  /**
   * List non-ended property types for the creation selector.
   * @returns Identifiers and names in name order.
   */
  async getFeaturePropertyTypes(): Promise<FeaturePropertyType[]> {
    const knex = getKnex();
    const query = knex('feature_property_type')
      .select('feature_property_type_id', 'name')
      .whereNull('record_end_date')
      .orderBy('name');
    const response = await this.connection.knex(query, FeaturePropertyType);
    return response.rows;
  }
}
