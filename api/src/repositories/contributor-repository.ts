import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { Contributor } from '../models/contributor';
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
   * Find the contributor record for a clientId.
   *
   * @param {string} clientId
   * @return {(Promise<Contributor | null>)}
   * @memberof ContributorRepository
   */
  async findContributorByClientId(clientId: string): Promise<Contributor | null> {
    const sql = SQL`
      SELECT contributor_id, client_id FROM contributor WHERE client_id = ${clientId} AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, Contributor);

    if (response.rowCount === 0) {
      return null;
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'ContributorRepository->findContributorByClientId',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
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
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0].contributor_id;
  }
}
