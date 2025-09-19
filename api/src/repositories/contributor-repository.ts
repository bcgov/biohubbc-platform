import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { GetContributor } from '../paths/contributor/index.interface';
import { BaseRepository } from './base-repository';

/**
 * Contributor repository class.
 *
 * @export
 * @class ContributorRepository
 * @extends {BaseRepository}
 */
export class ContributorRepository extends BaseRepository {
  /**
   * Get the contributor record for a clientId
   *
   * @param {string} clientId
   * @return {Promise<GetContributor>}
   * @memberof ContributorRepository
   */
  async getContributorByClientId(clientId: string): Promise<GetContributor> {
    const sql = SQL`
      SELECT contributor_id, client_id FROM contributor WHERE client_id = ${clientId};
    `;

    const response = await this.connection.sql(sql, GetContributor);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get contributor', [
        'ContributorRepository->getContributorByClientId',
        'rowCount !== 1, expected rowCount === 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Create a new contributor.
   *
   * @param {string} clientId
   * @return {Promise<number>}
   * @memberof ContributorRepository
   */
  async createContributor(clientId: string): Promise<number> {
    const sql = SQL`
      INSERT INTO contributor (client_id)
      VALUES (${clientId})
      RETURNING contributor_id
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create contributor', [
        'ContributorRepository->createContributor',
        'rowCount !== 1, expected rowCount === 1'
      ]);
    }

    return response.rows[0].contributor_id;
  }

  /**
   * Create a new contributor system user.
   *
   * @param {number} contributorId
   * @param {number} systemUserId
   * @return {Promise<void>}
   * @memberof ContributorRepository
   */
  async createContributorMember(contributorId: number, systemUserId: number): Promise<void> {
    const sql = SQL`
      INSERT INTO contributor_system_user (contributor_id, system_user_id)
      VALUES (${contributorId}, ${systemUserId});
    `;

    await this.connection.sql(sql);
  }
}
