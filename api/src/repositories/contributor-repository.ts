import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
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
   * Create a new contributor.
   *
   * @param {{
   *   name: string;
   *   description?: string;
   *   createUser: number;
   * }} contributor
   * @return {*}  {Promise<number>} inserted contributor_id
   * @memberof ContributorRepository
   */
  async createContributor(contributor: { name: string; description?: string }): Promise<number> {
    const sql = SQL`
      INSERT INTO contributor (name, description)
      VALUES (${contributor.name}, ${contributor.description || null})
      RETURNING contributor_id;
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
   * Get contributor by ID.
   *
   * @param {number} contributorId
   * @return {*}  {Promise<any>} contributor record
   * @memberof ContributorRepository
   */
  async getContributorById(contributorId: number): Promise<any> {
    const sql = SQL`
      SELECT *
      FROM contributor
      WHERE contributor_id = ${contributorId};
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get contributor by id', [
        'ContributorRepository->getContributorById',
        'rowCount !== 1, expected rowCount === 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Delete contributor by ID.
   *
   * @param {number} contributorId
   * @return {*}  {Promise<void>}
   * @memberof ContributorRepository
   */
  async deleteContributor(contributorId: number): Promise<void> {
    const sql = SQL`
      DELETE FROM contributor
      WHERE contributor_id = ${contributorId};
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete contributor', [
        'ContributorRepository->deleteContributor',
        'rowCount !== 1, expected rowCount === 1'
      ]);
    }
  }
}
