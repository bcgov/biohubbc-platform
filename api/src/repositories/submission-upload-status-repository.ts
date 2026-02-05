import { Knex } from 'knex';
import { getKnex, IDBConnection } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { SubmissionUploadStatus } from '../models/submission-upload-status';
import { BaseRepository } from './base-repository';

/**
 * A repository class for accessing submission security data.
 *
 * @export
 * @class SubmissionUploadStatusRepository
 * @extends {BaseRepository}
 */
export class SubmissionUploadStatusRepository extends BaseRepository {
  constructor(connection: IDBConnection) {
    super(connection);
  }

  /**
   * Get security details for a submission by its ID.
   *
   * @param {number} submissionId
   * @return {SubmissionUploadStatus}
   * @memberof SubmissionUploadStatusRepository
   */
  async getSubmissionUploadStatusById(submissionId: number): Promise<SubmissionUploadStatus> {
    const queryBuilder = this._makeGetSubmissionUploadStatusQuery(submissionId);
    const response = await this.connection.knex(queryBuilder, SubmissionUploadStatus);
    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to get submission upload status', [
        'SubmissionUploadStatusRepository->getSubmissionUploadStatusById',
        'rowCount was null or undefined, expected rowCount != 0'
      ]);
    }
    return response.rows[0];
  }

  /**
   * Builds a query to get complete submission upload status with security scans and file results.
   * Uses CTEs to modularly construct upload info, artifact counts, archive data, scans, and files.
   *
   * @private
   * @param {number} submissionId - The submission ID to query
   * @return {Knex.QueryBuilder} Query builder for getting submission upload status
   * @memberof SubmissionUploadStatusRepository
   */
  private _makeGetSubmissionUploadStatusQuery(submissionId: number): Knex.QueryBuilder {
    const knex = getKnex();

    return knex
      .with('submission_uploads', (qb) => {
        qb.select('submission_upload.submission_id', 'upload.upload_id', 'upload.upload_status')
          .from('submission_upload')
          .join('upload', 'submission_upload.upload_id', 'upload.upload_id')
          .where('submission_upload.submission_id', submissionId);
      })
      .with('upload_artifacts', (qb) => {
        qb.select('upload_artifact.upload_id', 'upload_artifact.artifact_id', 'upload_artifact.role')
          .from('upload_artifact')
          .whereIn('upload_artifact.upload_id', knex.select('upload_id').from('submission_uploads'));
      })
      .with('enriched_artifacts', (qb) => {
        qb.select(
          'upload_artifacts.upload_id',
          'upload_artifacts.artifact_id',
          'upload_artifacts.role',
          'artifact_security.artifact_security_id',
          'artifact_security.security',
          'artifact.byte_size',
          'upload_archive.upload_archive_id',
          'upload_archive.archive_status'
        )
          .from('upload_artifacts')
          .leftJoin('artifact_security', 'upload_artifacts.artifact_id', 'artifact_security.artifact_id')
          .leftJoin('artifact', 'upload_artifacts.artifact_id', 'artifact.artifact_id')
          .leftJoin('upload_archive', 'upload_artifacts.upload_id', 'upload_archive.upload_id');
      })
      .with('scans_and_files', (qb) => {
        qb.select(
          'enriched_artifacts.upload_id',
          knex.raw(`
            COALESCE(jsonb_agg(
              jsonb_build_object(
                'artifact_security_scan_id', artifact_security_scan.artifact_security_scan_id,
                'scan_status', artifact_security_scan.scan_status,
                'scanner_version', artifact_security_scan.scanner_version,
                'scanned_at', artifact_security_scan.scanned_at,
                'results', artifact_security_scan.results::jsonb
              ) ORDER BY artifact_security_scan.artifact_security_scan_id
            ) FILTER (WHERE artifact_security_scan.artifact_security_scan_id IS NOT NULL), '[]') AS scans
          `),
          knex.raw(`
            COALESCE(jsonb_agg(
              jsonb_build_object(
                'artifact_security_scan_file_id', artifact_security_scan_file.artifact_security_scan_file_id,
                'file_path', artifact_security_scan_file.file_path,
                'result', artifact_security_scan_file.result
              ) ORDER BY artifact_security_scan_file.artifact_security_scan_file_id
            ) FILTER (WHERE artifact_security_scan_file.artifact_security_scan_file_id IS NOT NULL), '[]') AS scan_files
          `)
        )
          .from('enriched_artifacts')
          .leftJoin(
            'artifact_security_scan',
            'enriched_artifacts.artifact_security_id',
            'artifact_security_scan.artifact_security_id'
          )
          .leftJoin(
            'artifact_security_scan_file',
            'artifact_security_scan.artifact_security_scan_id',
            'artifact_security_scan_file.artifact_security_scan_id'
          )
          .groupBy('enriched_artifacts.upload_id');
      })
      .select(
        'submission_uploads.submission_id',
        knex.raw(`
          jsonb_build_object(
            'upload_id', submission_uploads.upload_id,
            'upload_status', submission_uploads.upload_status
          ) AS upload
        `),
        knex.raw(`
          (
            SELECT jsonb_build_object(
              'feature', COALESCE(role_aggregates->'feature', jsonb_build_object('count', 0, 'byte_size', 0)),
              'attachment', COALESCE(role_aggregates->'attachment', jsonb_build_object('count', 0, 'byte_size', 0))
            )
            FROM (
              SELECT jsonb_object_agg(
                role,
                jsonb_build_object('count', count, 'byte_size', byte_size)
              ) AS role_aggregates
              FROM (
                SELECT 
                  role,
                  COUNT(*)::int AS count,
                  COALESCE(SUM(artifact.byte_size)::int, 0) AS byte_size
                FROM upload_artifacts
                LEFT JOIN artifact ON upload_artifacts.artifact_id = artifact.artifact_id
                WHERE upload_artifacts.upload_id = submission_uploads.upload_id
                GROUP BY role
              ) AS role_aggregates
            ) AS t
          ) AS artifacts
        `),
        knex.raw(`
          (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'upload_archive_id', upload_archive_id,
                'archive_status', archive_status,
                'byte_size', byte_size,
                'security', security
              ) ORDER BY upload_archive_id
            ), '[]')
            FROM (
              SELECT DISTINCT upload_archive_id, archive_status, byte_size, security
              FROM enriched_artifacts
              WHERE upload_archive_id IS NOT NULL
            ) AS distinct_archives
          ) AS upload_archives
        `),
        'scans_and_files.scans',
        'scans_and_files.scan_files'
      )
      .from('submission_uploads')
      .leftJoin('scans_and_files', 'scans_and_files.upload_id', 'submission_uploads.upload_id');
  }
}
