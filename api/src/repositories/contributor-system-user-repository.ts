import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { ContributorSystemUser } from '../models/contributor-system-user';
import { CountResult } from '../models/count';
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
   * Find the active relationship for a specific contributor and user.
   *
   * @param {number} contributorId
   * @param {number} systemUserId
   * @return {(Promise<ContributorSystemUser | null>)}
   * @memberof ContributorSystemUserRepository
   */
  async findContributorSystemUser(contributorId: number, systemUserId: number): Promise<ContributorSystemUser | null> {
    const sql = SQL`
      SELECT contributor_system_user_id, contributor_id, system_user_id
      FROM contributor_system_user
      WHERE contributor_id = ${contributorId}
        AND system_user_id = ${systemUserId}
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
      VALUES (${contributorId}, ${systemUserId})
      ON CONFLICT (contributor_id, system_user_id, (record_end_date IS NULL))
        WHERE record_end_date IS NULL DO NOTHING;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Check whether a user belongs to any active contributor without choosing one for attribution.
   * @param systemUserId - Authenticated user identifier.
   * @returns Whether an active contributor membership exists.
   */
  async hasActiveContributor(systemUserId: number): Promise<boolean> {
    const sql = SQL`
      SELECT EXISTS (
        SELECT 1 FROM contributor_system_user csu
        JOIN contributor c ON c.contributor_id = csu.contributor_id AND c.record_end_date IS NULL
        WHERE csu.system_user_id = ${systemUserId} AND csu.record_end_date IS NULL
      )::integer AS count;
    `;
    const response = await this.connection.sql(sql, CountResult);
    return response.rows[0].count === 1;
  }
}
