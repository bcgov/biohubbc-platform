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
   * @return {Promise<GetContributor>}
   * @memberof ContributorRepository
   */
  async getContributorBySubmissionUploadId(submissionUploadId: string): Promise<GetContributor> {
    const sql = SQL`
      SELECT
        c.contributor_id,
        c.client_id
      FROM submission_upload su
      INNER JOIN submission s ON s.submission_id = su.submission_id
      INNER JOIN contributor_system_user csu ON csu.system_user_id = s.system_user_id
      INNER JOIN contributor c ON c.contributor_id = csu.contributor_id
      WHERE su.submission_upload_id = ${submissionUploadId}
        AND (s.record_end_date IS NULL OR s.record_end_date > NOW())
        AND csu.record_end_date IS NULL
        AND c.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, GetContributor);

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
   * @return {Promise<GetContributor>}
   * @memberof ContributorRepository
   */
  async getContributorBySubmissionId(submissionId: number): Promise<GetContributor> {
    const sql = SQL`
      SELECT
        c.contributor_id,
        c.client_id
      FROM submission s
      INNER JOIN contributor_system_user csu ON csu.system_user_id = s.system_user_id
      INNER JOIN contributor c ON c.contributor_id = csu.contributor_id
      WHERE s.submission_id = ${submissionId}
        AND (s.record_end_date IS NULL OR s.record_end_date > NOW())
        AND csu.record_end_date IS NULL
        AND c.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, GetContributor);

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
}
