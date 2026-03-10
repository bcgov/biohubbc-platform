import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { ContributorMemberRecord } from '../models/contributor';
import { BaseRepository } from './base-repository';

/**
 * Contributor-member repository class.
 *
 * @export
 * @class ContributorMemberRepository
 * @extends {BaseRepository}
 */
export class ContributorMemberRepository extends BaseRepository {
  /**
   * Find a contributor-member relationship.
   *
   * @param {number} contributorId
   * @param {number} systemUserId
   * @return {(Promise<ContributorMemberRecord | null>)}
   * @memberof ContributorMemberRepository
   */
  async findContributorMember(contributorId: number, systemUserId: number): Promise<ContributorMemberRecord | null> {
    const sql = SQL`
      SELECT contributor_system_user_id, contributor_id, system_user_id
      FROM contributor_system_user
      WHERE contributor_id = ${contributorId}
        AND system_user_id = ${systemUserId}
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, ContributorMemberRecord);

    if (response.rowCount === 0) {
      return null;
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'ContributorMemberRepository->findContributorMember',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Create a contributor-member relationship.
   *
   * @param {number} contributorId
   * @param {number} systemUserId
   * @return {Promise<void>}
   * @memberof ContributorMemberRepository
   */
  async createContributorMember(contributorId: number, systemUserId: number): Promise<void> {
    const sql = SQL`
      INSERT INTO contributor_system_user (contributor_id, system_user_id)
      VALUES (${contributorId}, ${systemUserId});
    `;

    await this.connection.sql(sql);
  }
}
