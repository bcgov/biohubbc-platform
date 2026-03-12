import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { ContributorCodeset, ContributorCodesetSchema, CreateContributorCodeset } from '../models/contributor-codeset';
import { ContributorCodesetIdentity } from '../services/contributor-codeset-service.interface';
import { BaseRepository } from './base-repository';

export class ContributorCodesetRepository extends BaseRepository {
  /**
   * Insert a contributor_codeset row.
   *
   * @param {CreateContributorCodeset} payload
   * @return {Promise<ContributorCodeset>}
   * @memberof ContributorCodesetRepository
   */
  async insertContributorCodeset(payload: CreateContributorCodeset): Promise<ContributorCodeset> {
    const knex = getKnex();
    const query = knex('contributor_codeset')
      .insert(payload)
      .returning(['contributor_codeset_id', 'contributor_id', 'key', 'label', 'description', 'external_id']);

    const response = await this.connection.knex(query, ContributorCodesetSchema);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert contributor_codeset', [
        'ContributorCodesetRepository->insertContributorCodeset',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert multiple contributor_codeset rows.
   *
   * @param {CreateContributorCodeset[]} payloads
   * @return {Promise<ContributorCodeset[]>}
   * @memberof ContributorCodesetRepository
   */
  async insertContributorCodesets(payloads: CreateContributorCodeset[]): Promise<ContributorCodeset[]> {
    if (!payloads.length) {
      return [];
    }

    const knex = getKnex();
    const query = knex('contributor_codeset')
      .insert(payloads)
      .returning(['contributor_codeset_id', 'contributor_id', 'key', 'label', 'description', 'external_id']);

    const response = await this.connection.knex(query, ContributorCodesetSchema);

    if (response.rowCount !== payloads.length) {
      throw new ApiExecuteSQLError('Failed to insert contributor_codeset rows', [
        'ContributorCodesetRepository->insertContributorCodesets',
        `rowCount was ${response.rowCount}, expected ${payloads.length}`
      ]);
    }

    return response.rows;
  }

  /**
   * Get a contributor_codeset row by id.
   *
   * @param {number} codeCategoryId
   * @return {Promise<ContributorCodeset>}
   * @memberof ContributorCodesetRepository
   */
  async getContributorCodesetById(codeCategoryId: number): Promise<ContributorCodeset> {
    const knex = getKnex();
    const query = knex('contributor_codeset')
      .select(['contributor_codeset_id', 'contributor_id', 'key', 'label', 'description', 'external_id'])
      .where('contributor_codeset_id', codeCategoryId);

    const response = await this.connection.knex(query, ContributorCodesetSchema);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('contributor_codeset not found', [
        'ContributorCodesetRepository->getContributorCodesetById',
        { codeCategoryId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'ContributorCodesetRepository->getContributorCodesetById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get contributor_codeset rows by contributor id.
   *
   * @param {number} contributorId
   * @return {Promise<ContributorCodeset[]>}
   * @memberof ContributorCodesetRepository
   */
  async getContributorCodesetsByContributorId(contributorId: number): Promise<ContributorCodeset[]> {
    const knex = getKnex();
    const query = knex('contributor_codeset')
      .select(['contributor_codeset_id', 'contributor_id', 'key', 'label', 'description', 'external_id'])
      .where('contributor_id', contributorId);

    const response = await this.connection.knex(query, ContributorCodesetSchema);

    return response.rows;
  }

  /**
   * Get a contributor_codeset row by identity fields.
   *
   * @param {number} contributorId
   * @param {string} key
   * @return {Promise<ContributorCodeset | null>}
   * @memberof ContributorCodesetRepository
   */
  async findContributorCodesetByIdentity(contributorId: number, key: string): Promise<ContributorCodeset | null> {
    const knex = getKnex();
    const query = knex('contributor_codeset')
      .select(['contributor_codeset_id', 'contributor_id', 'key', 'label', 'description', 'external_id'])
      .where({
        contributor_id: contributorId,
        key
      });

    const response = await this.connection.knex(query, ContributorCodesetSchema);

    if (response.rowCount === 0) {
      return null;
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'ContributorCodesetRepository->findContributorCodesetByIdentity',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get contributor_codeset rows by identity fields.
   *
   * @param {ContributorCodesetIdentity[]} identities
   * @return {Promise<ContributorCodeset[]>}
   * @memberof ContributorCodesetRepository
   */
  async getContributorCodesetsByIdentities(identities: ContributorCodesetIdentity[]): Promise<ContributorCodeset[]> {
    if (!identities.length) {
      return [];
    }

    const knex = getKnex();
    const tuples = identities.map((identity) => [identity.contributor_id, identity.key]);
    const query = knex('contributor_codeset')
      .select(['contributor_codeset_id', 'contributor_id', 'key', 'label', 'description', 'external_id'])
      .whereIn(['contributor_id', 'key'], tuples);

    const response = await this.connection.knex(query, ContributorCodesetSchema);

    return response.rows;
  }
}
