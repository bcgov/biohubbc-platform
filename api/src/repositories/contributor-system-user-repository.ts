import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { ContributorSystemUser } from '../models/contributor-system-user';
import { BaseRepository } from './base-repository';

/**
 * Contributor-system-user repository class.
 *
 * @export
 * @class ContributorSystemUserRepository
 * @extends {BaseRepository}
 */
export class ContributorSystemUserRepository extends BaseRepository {
  /**
   * Find the active contributor-system-user relationship for a system user.
   *
   * @param {number} systemUserId
   * @return {(Promise<ContributorSystemUser | null>)}
   * @memberof ContributorSystemUserRepository
   */
  async findContributorSystemUser(systemUserId: number): Promise<ContributorSystemUser | null> {
    const sql = SQL`
      SELECT contributor_system_user_id, contributor_id, system_user_id
      FROM contributor_system_user
      WHERE system_user_id = ${systemUserId}
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, ContributorSystemUser);

    if (response.rowCount === 0) {
      return null;
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'ContributorSystemUserRepository->findContributorSystemUser',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Create a contributor-system-user relationship.
   *
   * @param {number} contributorId
   * @param {number} systemUserId
   * @return {Promise<void>}
   * @memberof ContributorSystemUserRepository
   */
  async createContributorSystemUser(contributorId: number, systemUserId: number): Promise<void> {
    const sql = SQL`
      INSERT INTO contributor_system_user (contributor_id, system_user_id)
      VALUES (${contributorId}, ${systemUserId});
    `;

    await this.connection.sql(sql);
  }

  /**
   * End all active relationships belonging to a contributor.
   * @param contributorId - Contributor being deleted.
   * @returns Completion without materializing affected rows.
   */
  async deleteContributorSystemUsers(contributorId: number): Promise<void> {
    const knex = getKnex();
    const query = knex('contributor_system_user')
      .where('contributor_id', contributorId)
      .whereNull('record_end_date')
      .update({ record_end_date: knex.fn.now() });
    await this.connection.knex(query);
  }
}
