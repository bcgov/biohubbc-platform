import SQL from 'sql-template-strings';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
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
      SELECT contributor_id, client_id FROM contributor WHERE client_id = ${clientId} AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, GetContributor);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Contributor not found', [
        'ContributorRepository->getContributorByClientId',
        { clientId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'ContributorRepository->getContributorByClientId',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Check if a contributor exists for a given clientId (active records only)
   *
   * @param {string} clientId
   * @return {Promise<boolean>}
   * @memberof ContributorRepository
   */
  async contributorExists(clientId: string): Promise<boolean> {
    const sql = SQL`
      SELECT contributor_id FROM contributor WHERE client_id = ${clientId} AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql);

    return (response.rowCount ?? 0) > 0;
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

  /**
   * Check if a contributor_system_user relationship exists (active records only)
   *
   * @param {number} contributorId
   * @param {number} systemUserId
   * @return {Promise<boolean>}
   * @memberof ContributorRepository
   */
  async contributorMemberExists(contributorId: number, systemUserId: number): Promise<boolean> {
    const sql = SQL`
      SELECT contributor_system_user_id 
      FROM contributor_system_user 
      WHERE contributor_id = ${contributorId} 
        AND system_user_id = ${systemUserId} 
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql);

    return (response.rowCount ?? 0) > 0;
  }

  /**
   * Create a new contributor system user.
   * If the relationship already exists, this is a no-op (idempotent).
   *
   * @param {number} contributorId
   * @param {number} systemUserId
   * @return {Promise<void>}
   * @memberof ContributorRepository
   */
  async createContributorMember(contributorId: number, systemUserId: number): Promise<void> {
    // Check if relationship already exists (idempotent)
    const exists = await this.contributorMemberExists(contributorId, systemUserId);
    if (exists) {
      return; // Already exists, no-op
    }

    const sql = SQL`
      INSERT INTO contributor_system_user (contributor_id, system_user_id)
      VALUES (${contributorId}, ${systemUserId});
    `;

    await this.connection.sql(sql);
  }
}
