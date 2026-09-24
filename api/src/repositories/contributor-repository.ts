import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { AdministrativeContributor, Contributor, ContributorFilters, ContributorInput } from '../models/contributor';
import { CountResult } from '../models/count';
import { ApiPaginationOptions } from '../zod-schema/pagination';
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
   * Get the contributor linked to a submission upload.
   *
   * @param {string} submissionUploadId
   * @return {Promise<Contributor>}
   * @memberof ContributorRepository
   */
  async getContributorBySubmissionUploadId(submissionUploadId: string): Promise<Contributor> {
    const sql = SQL`
      WITH w_submission_upload AS (
        SELECT
          submission_id
        FROM submission_upload
        WHERE submission_upload_id = ${submissionUploadId}
      ),
      w_submission AS (
        SELECT
          s.contributor_id
        FROM w_submission_upload wsu
        INNER JOIN submission s ON s.submission_id = wsu.submission_id
        WHERE (s.record_end_date IS NULL OR s.record_end_date > NOW())
      )
      SELECT
        c.contributor_id,
        c.client_id
      FROM w_submission ws
      INNER JOIN contributor c ON c.contributor_id = ws.contributor_id
      WHERE c.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, Contributor);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Contributor not found for submission upload', [
        'ContributorRepository->getContributorBySubmissionUploadId',
        { submissionUploadId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'ContributorRepository->getContributorBySubmissionUploadId',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get the contributor linked to a submission.
   *
   * @param {number} submissionId
   * @return {Promise<Contributor>}
   * @memberof ContributorRepository
   */
  async getContributorBySubmissionId(submissionId: number): Promise<Contributor> {
    const sql = SQL`
      WITH w_submission AS (
        SELECT
          contributor_id
        FROM submission
        WHERE submission_id = ${submissionId}
          AND (record_end_date IS NULL OR record_end_date > NOW())
      )
      SELECT
        c.contributor_id,
        c.client_id
      FROM w_submission ws
      INNER JOIN contributor c ON c.contributor_id = ws.contributor_id
      WHERE c.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, Contributor);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Contributor not found for submission', [
        'ContributorRepository->getContributorBySubmissionId',
        { submissionId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'ContributorRepository->getContributorBySubmissionId',
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

  /**
   * List active administrative contributors.
   * @param filters - Domain filters.
   * @param pagination - Bounded pagination and sorting.
   * @returns Matching page of records.
   */
  async listAdministrativeContributors(
    filters: ContributorFilters,
    pagination: ApiPaginationOptions
  ): Promise<AdministrativeContributor[]> {
    const knex = getKnex();
    const query = knex('contributor as c').select(
      'c.contributor_id',
      'c.client_id',
      'c.description',
      'c.record_end_date'
    );
    if (filters.keyword) {
      query.where((builder) => {
        builder.whereILike('c.client_id', `%${filters.keyword}%`).orWhereILike('c.description', `%${filters.keyword}%`);
      });
    }
    query.whereNull('c.record_end_date');

    const columns: Record<string, string> = {
      contributor_id: 'c.contributor_id',
      client_id: 'c.client_id',
      description: 'c.description',
      record_end_date: 'c.record_end_date'
    };
    query.orderBy(columns[pagination.sort ?? ''] ?? 'c.contributor_id', pagination.order ?? 'asc');
    query
      .orderBy('c.contributor_id', 'asc')
      .limit(pagination.limit)
      .offset((pagination.page - 1) * pagination.limit);
    const response = await this.connection.knex(query, AdministrativeContributor);
    return response.rows;
  }

  /**
   * Count active records matching the administrative filters.
   * @param filters - Domain filters.
   * @returns Total matching records.
   */
  async countAdministrativeContributors(filters: ContributorFilters): Promise<number> {
    const knex = getKnex();
    const query = knex('contributor as c').select(knex.raw('count(*)::integer as count'));
    if (filters.keyword) {
      query.where((builder) => {
        builder.whereILike('c.client_id', `%${filters.keyword}%`).orWhereILike('c.description', `%${filters.keyword}%`);
      });
    }
    query.whereNull('c.record_end_date');

    const response = await this.connection.knex(query, CountResult);
    return response.rows[0].count;
  }

  /**
   * Read and lock an administrative record for the current transaction.
   * @param id - Record identifier.
   * @returns Record, or undefined when absent.
   */
  async getAdministrativeContributor(id: number): Promise<AdministrativeContributor | undefined> {
    const knex = getKnex();
    const query = knex('contributor as c')
      .select('c.contributor_id', 'c.client_id', 'c.description', 'c.record_end_date')
      .where('c.contributor_id', id)
      .forUpdate('c');
    const response = await this.connection.knex(query, AdministrativeContributor);
    return response.rows[0];
  }

  /**
   * Insert an active administrative record.
   * @param input - Fields to persist.
   * @returns Created identifier.
   */
  async insertAdministrativeContributor(input: ContributorInput): Promise<number> {
    const knex = getKnex();
    const query = knex('contributor')
      .insert({ client_id: input.clientId, description: input.description })
      .returning('contributor_id');
    const response = await this.connection.knex(query, Contributor.pick({ contributor_id: true }));
    return response.rows[0].contributor_id;
  }

  /**
   * Update an active administrative record.
   * @param id - Record identifier.
   * @param input - Replacement editable fields.
   * @returns Completion of the update.
   */
  async updateAdministrativeContributor(id: number, input: ContributorInput): Promise<void> {
    const knex = getKnex();
    const query = knex('contributor')
      .where('contributor_id', id)
      .whereNull('record_end_date')
      .update({ client_id: input.clientId, description: input.description });
    await this.connection.knex(query);
  }

  /**
   * End an active record without changing an existing end date.
   * @param id - Record identifier.
   * @returns Completion of the deletion.
   */
  async deleteAdministrativeContributor(id: number): Promise<void> {
    const knex = getKnex();
    const query = knex('contributor')
      .where('contributor_id', id)
      .whereNull('record_end_date')
      .update({ record_end_date: knex.fn.now() });
    await this.connection.knex(query);
  }
}
