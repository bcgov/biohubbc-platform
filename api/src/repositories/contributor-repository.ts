import SQL from 'sql-template-strings';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { Contributor, ContributorMembership } from '../models/contributor';
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
   * Find an active contributor by client ID together with the caller's active membership.
   *
   * @param {string} clientId - Effective client ID for submission attribution.
   * @param {number} systemUserId - Authenticated caller whose membership is checked.
   * @returns {Promise<ContributorMembership | undefined>} Contributor and membership status, or undefined
   * when no active contributor matches.
   */
  async findContributorMembershipByClientId(
    clientId: string,
    systemUserId: number
  ): Promise<ContributorMembership | undefined> {
    const sql = SQL`
      SELECT c.contributor_id,
        EXISTS (
          SELECT 1
          FROM contributor_system_user csu
          WHERE csu.contributor_id = c.contributor_id
            AND csu.system_user_id = ${systemUserId}
            AND csu.record_end_date IS NULL
        ) AS is_member
      FROM contributor c
      WHERE c.client_id = ${clientId}
        AND c.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, ContributorMembership);
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
}
