import { SQL } from 'sql-template-strings';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { IInsertQuarantine, IUpdateQuarantine, QuarantineRecord } from '../../models/quarantine';
import { SubmissionRecordWithQuarantine } from '../../models/submission';
import { BaseRepository } from '../base-repository';

export class QuarantineRepository extends BaseRepository {
  /**
   * Get a quarantine record by ID.
   *
   * @param {string} quarantineId
   * @return {*}  {Promise<QuarantineRecord>}
   * @memberof QuarantineRepository
   */
  async getQuarantineRecord(quarantineId: string): Promise<QuarantineRecord> {
    const sqlStatement = SQL`
      SELECT
        quarantine_id,
        uri,
        status,
        upload_id
      FROM
        quarantine
      WHERE
        quarantine_id = ${quarantineId};
    `;

    const response = await this.connection.sql(sqlStatement, QuarantineRecord);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get quarantine record', [
        'QuarantineRepository->getQuarantineRecord',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }
  /**
   * Get a quarantine record with all associated scans.
   *
   * @return {*}  {Promise<SubmissionRecordWithQuarantine[]>}
   * @memberof QuarantineRepository
   */
  async getQuarantineRecordsWithScans(): Promise<SubmissionRecordWithQuarantine[]> {
    const knex = getKnex();

    const queryBuilder = knex
      // Step 1: Build scan data per quarantine
      .with('scan_data', (qb) => {
        qb.select(
          'qs.quarantine_id',
          knex.raw(`
          jsonb_agg(
            jsonb_build_object(
              'quarantine_scan_id', qs.quarantine_scan_id,
              'quarantine_id', qs.quarantine_id,
              'scan_status', qs.scan_status,
              'scanned_at', qs.scanned_at,
              'scanner_version', qs.scanner_version,
              'results', qs.results
            )
          ) FILTER (WHERE qs.quarantine_scan_id IS NOT NULL) AS scans
        `)
        )
          .from('biohub.quarantine_scan as qs')
          .groupBy('qs.quarantine_id');
      })
      // Step 2: Build quarantine + scans JSON object
      .with('quarantine_data', (qb) => {
        qb.select(
          'q.quarantine_id',
          knex.raw(`
          jsonb_build_object(
            'quarantine_id', q.quarantine_id,
            'status', q.status,
            'scans', COALESCE(sd.scans, '[]'::jsonb)
          ) AS quarantine
        `)
        )
          .from('biohub.quarantine as q')
          .leftJoin('scan_data as sd', 'q.quarantine_id', 'sd.quarantine_id');
      })
      // Step 3: Select from quarantine, join submission, and filter where submission has no URI
      .select('s.submission_id', 's.name', 's.description', 's.submitted_timestamp', 'qd.quarantine')
      .from('biohub.quarantine as q')
      .join('quarantine_data as qd', 'q.quarantine_id', 'qd.quarantine_id')
      .join('submission as s', 's.quarantine_id', 'q.quarantine_id');

    // Execute query
    const response = await this.connection.knex(queryBuilder, SubmissionRecordWithQuarantine);

    return response.rows;
  }

  /**
   * Insert a new quarantine record.
   *
   * @param {IInsertQuarantine} quarantine
   * @return {*}  {Promise<{ quarantine_id: string }>}
   * @memberof QuarantineRepository
   */
  async insertQuarantineRecord(quarantine: IInsertQuarantine): Promise<{ quarantine_id: string }> {
    const sqlStatement = SQL`
      INSERT INTO biohub.quarantine (
        uri,
        status
      ) VALUES (
        ${quarantine.uri},
        ${quarantine.status}
      )
      RETURNING quarantine_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert quarantine record', [
        'QuarantineRepository->insertQuarantineRecord',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an existing quarantine record.
   *
   * @param {string} quarantineId
   * @param {IUpdateQuarantine} quarantine
   * @return {*}  {Promise<{ quarantine_id: string }>}
   * @memberof QuarantineRepository
   */
  async updateQuarantineRecord(
    quarantineId: string,
    quarantine: IUpdateQuarantine
  ): Promise<{ quarantine_id: string }> {
    const sqlStatement = SQL`
      UPDATE biohub.quarantine
      SET
        uri = COALESCE(${quarantine.uri}, uri),
        status = COALESCE(${quarantine.status}, status),
        upload_id = COALESCE(${quarantine.upload_id}, upload_id)
      WHERE
        quarantine_id = ${quarantineId}
      RETURNING quarantine_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update quarantine record', [
        'QuarantineRepository->updateQuarantineRecord',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }
}
