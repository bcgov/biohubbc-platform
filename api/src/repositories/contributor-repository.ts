import SQL from 'sql-template-strings';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
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
   * Get the contributor linked to a submission upload.
   *
   * @param {string} submissionUploadId
   * @return {Promise<Contributor>}
   * @memberof ContributorRepository
   */
  async getContributorBySubmissionUploadId(submissionUploadId: string): Promise<Contributor> {
    console.log(submissionUploadId, 'submissuioiploadid');
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

    console.log(response.rows);

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
}
