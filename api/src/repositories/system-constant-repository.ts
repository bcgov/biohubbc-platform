import { getKnex } from '../database/db';
import { BaseRepository } from './base-repository';

export interface ISystemConstant {
  system_constant_id: number;
  constant_name: string;
  character_value: string;
  numeric_value: number;
  description: string;
  create_date: string;
  create_user: number;
  update_date: string | null;
  update_user: number | null;
  revision_count: number;
}

/**
 * A repository class for accessing system constant records.
 *
 * @export
 * @class SystemConstantRepository
 * @extends {BaseRepository}
 */
export class SystemConstantRepository extends BaseRepository {
  /**
   * Fetch one or more system constants by name.
   *
   * @param {string[]} constantNames
   * @return {*}  {Promise<ISystemConstant[]>}
   * @memberof SystemConstantRepository
   */
  async getSystemConstants(constantNames: string[]): Promise<ISystemConstant[]> {
    const knex = getKnex();
    const queryBuilder = knex.queryBuilder().select().from('system_constant').whereIn('constant_name', constantNames);

    const response = await this.connection.knex<ISystemConstant>(queryBuilder);

    return response.rows;
  }
}
