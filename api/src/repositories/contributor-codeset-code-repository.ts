import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import {
  ContributorCodesetCode,
  ContributorCodesetCodeSchema,
  CreateContributorCodesetCode
} from '../models/contributor-codeset-code';
import { ContributorCodesetCodeIdentity } from '../services/contributor-codeset-code-service.interface';
import { BaseRepository } from './base-repository';

export class ContributorCodesetCodeRepository extends BaseRepository {
  /**
   * Insert a contributor_codeset_code row.
   *
   * @param {CreateContributorCodesetCode} payload
   * @return {Promise<ContributorCodesetCode>}
   * @memberof ContributorCodesetCodeRepository
   */
  async insertContributorCodesetCode(payload: CreateContributorCodesetCode): Promise<ContributorCodesetCode> {
    const knex = getKnex();
    const query = knex('contributor_codeset_code')
      .insert(payload)
      .returning(['contributor_codeset_code_id', 'contributor_codeset_id', 'key', 'label', 'description', 'version']);

    const response = await this.connection.knex(query, ContributorCodesetCodeSchema);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert contributor_codeset_code', [
        'ContributorCodesetCodeRepository->insertContributorCodesetCode',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert multiple contributor_codeset_code rows.
   *
   * @param {CreateContributorCodesetCode[]} payloads
   * @return {Promise<ContributorCodesetCode[]>}
   * @memberof ContributorCodesetCodeRepository
   */
  async insertContributorCodesetCodes(payloads: CreateContributorCodesetCode[]): Promise<ContributorCodesetCode[]> {
    if (!payloads.length) {
      return [];
    }

    const knex = getKnex();
    const query = knex('contributor_codeset_code')
      .insert(payloads)
      .returning(['contributor_codeset_code_id', 'contributor_codeset_id', 'key', 'label', 'description', 'version']);

    const response = await this.connection.knex(query, ContributorCodesetCodeSchema);

    if (response.rowCount !== payloads.length) {
      throw new ApiExecuteSQLError('Failed to insert contributor_codeset_code rows', [
        'ContributorCodesetCodeRepository->insertContributorCodesetCodes',
        `rowCount was ${response.rowCount}, expected ${payloads.length}`
      ]);
    }

    return response.rows;
  }

  /**
   * Get a contributor_codeset_code row by id.
   *
   * @param {number} contributorCodesetCodeId
   * @return {Promise<ContributorCodesetCode>}
   * @memberof ContributorCodesetCodeRepository
   */
  async getContributorCodesetCodeById(contributorCodesetCodeId: number): Promise<ContributorCodesetCode> {
    const knex = getKnex();
    const query = knex('contributor_codeset_code')
      .select(['contributor_codeset_code_id', 'contributor_codeset_id', 'key', 'label', 'description', 'version'])
      .where('contributor_codeset_code_id', contributorCodesetCodeId);

    const response = await this.connection.knex(query, ContributorCodesetCodeSchema);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('contributor_codeset_code not found', [
        'ContributorCodesetCodeRepository->getContributorCodesetCodeById',
        { contributorCodesetCodeId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'ContributorCodesetCodeRepository->getContributorCodesetCodeById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get contributor_codeset_code rows by contributor_codeset_id.
   *
   * @param {number} contributorCodesetId
   * @return {Promise<ContributorCodesetCode[]>}
   * @memberof ContributorCodesetCodeRepository
   */
  async getContributorCodesetCodesByContributorCodesetId(
    contributorCodesetId: number
  ): Promise<ContributorCodesetCode[]> {
    const knex = getKnex();
    const query = knex('contributor_codeset_code')
      .select(['contributor_codeset_code_id', 'contributor_codeset_id', 'key', 'label', 'description', 'version'])
      .where('contributor_codeset_id', contributorCodesetId);

    const response = await this.connection.knex(query, ContributorCodesetCodeSchema);

    return response.rows;
  }

  /**
   * Get a contributor_codeset_code row by identity fields.
   *
   * @param {ContributorCodesetCodeIdentity} identity
   * @return {Promise<ContributorCodesetCode | null>}
   * @memberof ContributorCodesetCodeRepository
   */
  async findContributorCodesetCodeByIdentity(
    identity: ContributorCodesetCodeIdentity
  ): Promise<ContributorCodesetCode | null> {
    const knex = getKnex();
    const query = knex('contributor_codeset_code')
      .select(['contributor_codeset_code_id', 'contributor_codeset_id', 'key', 'label', 'description', 'version'])
      .where({
        contributor_codeset_id: identity.contributor_codeset_id,
        key: identity.key,
        version: identity.version
      });

    const response = await this.connection.knex(query, ContributorCodesetCodeSchema);

    if (response.rowCount === 0) {
      return null;
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'ContributorCodesetCodeRepository->findContributorCodesetCodeByIdentity',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get contributor_codeset_code rows by identity fields.
   *
   * @param {ContributorCodesetCodeIdentity[]} identities
   * @return {Promise<ContributorCodesetCode[]>}
   * @memberof ContributorCodesetCodeRepository
   */
  async getContributorCodesetCodesByIdentities(
    identities: ContributorCodesetCodeIdentity[]
  ): Promise<ContributorCodesetCode[]> {
    if (!identities.length) {
      return [];
    }

    const knex = getKnex();
    const tuples = identities.map((identity) => [identity.contributor_codeset_id, identity.key, identity.version]);
    const query = knex('contributor_codeset_code')
      .select(['contributor_codeset_code_id', 'contributor_codeset_id', 'key', 'label', 'description', 'version'])
      .whereIn(['contributor_codeset_id', 'key', 'version'], tuples);

    const response = await this.connection.knex(query, ContributorCodesetCodeSchema);

    return response.rows;
  }
}
