import SQL from 'sql-template-strings';
import { getKnexQueryBuilder } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { generateGeometryCollectionSQL } from '../utils/spatial-utils';
import { BaseRepository } from './base-repository';

export interface ISearchSubmissionCriteria {
  keyword?: string;
  spatial?: string;
}

export interface IInsertSubmissionRecord {
  source_transform_id: number;
  uuid: string;
  event_timestamp: string;
  input_key: string;
  input_file_name: string;
  eml_source: string;
  darwin_core_source: string;
}

/**
 * Submission table model.
 *
 * @export
 * @interface ISubmissionModel
 */
export interface ISubmissionModel {
  submission_id: number;
  source_transform_id: string;
  uuid: string;
  event_timestamp: string;
  delete_timestamp: string | null;
  input_key: string | null;
  input_file_name: string | null;
  eml_source: string | null;
  darwin_core_source: string | null;
  create_date: string;
  create_user: number;
  update_date: string | null;
  update_user: number | null;
  revision_count: number;
}

export interface ISubmissionModelWithStatus extends ISubmissionModel {
  submission_status: string;
}
/**
 * Submission source transform table model.
 *
 * @export
 * @interface ISourceTransformModel
 */
export interface ISourceTransformModel {
  source_transform_id: number;
  system_user_id: number;
  version: number;
  transform_filename: string | null;
  transform_key: string | null;
  transform_precompile_filename: string | null;
  transform_precompile_key: string | null;
  metadata_index: string | null;
  record_effective_date: string;
  record_end_date: string | null;
  create_date: string;
  create_user: number;
  update_date: string | null;
  update_user: number | null;
  revision_count: number;
}

export enum SUBMISSION_STATUS_TYPE {
  'SUBMITTED' = 'Submitted',
  'TEMPLATE_VALIDATED' = 'Template Validated',
  'DARWIN_CORE_VALIDATED' = 'Darwin Core Validated',
  'TEMPLATE_TRANSFORMED' = 'Template Transformed',
  'SUBMISSION_DATA_INGESTED' = 'Submission Data Ingested',
  'SECURED' = 'Secured',
  'AWAITING_CURATION' = 'Awaiting Curration',
  'PUBLISHED' = 'Published',
  'REJECTED' = 'Rejected',
  'ON_HOLD' = 'On Hold',
  'SYSTEM_ERROR' = 'System Error'
}

export enum SUBMISSION_MESSAGE_TYPE {
  'DUPLICATE_HEADER' = 'Duplicate Header',
  'UNKNOWN_HEADER' = 'Unknown Header',
  'MISSING_REQUIRED_HEADER' = 'Missing Required Header',
  'MISSING_RECOMMENDED_HEADER' = 'Missing Recommended Header',
  'MISCELLANEOUS' = 'Miscellaneous',
  'MISSING_REQUIRED_FIELD' = 'Missing Required Field',
  'UNEXPECTED_FORMAT' = 'Unexpected Format',
  'OUT_OF_RANGE' = 'Out Of Range',
  'INVALID_VALUE' = 'Invalid Value',
  'MISSING_VALIDATION_SCHEMA' = 'Missing Validation Schema'
}

export enum SUBMISSION_MESSAGE_CLASS {
  'NOTICE' = 'Notice',
  'ERROR' = 'Error',
  'WARNING' = 'Warning'
}

/**
 * A repository class for accessing submission data.
 *
 * @export
 * @class SubmissionRepository
 * @extends {BaseRepository}
 */
export class SubmissionRepository extends BaseRepository {
  async findSubmissionByCriteria(criteria: ISearchSubmissionCriteria): Promise<{ submission_id: number }[]> {
    const queryBuilder = getKnexQueryBuilder<any, { project_id: number }>()
      .select('submission.submission_id')
      .from('submission')
      .leftJoin('occurrence', 'submission.submission_id', 'occurrence.submission_id');

    if (criteria.keyword) {
      queryBuilder.and.where(function () {
        this.or.whereILike('occurrence.taxonid', `%${criteria.keyword}%`);
        this.or.whereILike('occurrence.lifestage', `%${criteria.keyword}%`);
        this.or.whereILike('occurrence.sex', `%${criteria.keyword}%`);
        this.or.whereILike('occurrence.vernacularname', `%${criteria.keyword}%`);
        this.or.whereILike('occurrence.individualcount', `%${criteria.keyword}%`);
      });
    }

    if (criteria.spatial) {
      const geometryCollectionSQL = generateGeometryCollectionSQL(JSON.parse(criteria.spatial));

      const sqlStatement = SQL`
      public.ST_INTERSECTS(
        geography,
        public.geography(
          public.ST_Force2D(
            public.ST_SetSRID(`;

      sqlStatement.append(geometryCollectionSQL);

      sqlStatement.append(`,
              4326
            )
          )
        )
      )`);

      queryBuilder.and.whereRaw(sqlStatement.sql, sqlStatement.values);
    }

    queryBuilder.groupBy('submission.submission_id');

    const response = await this.connection.knex<{ submission_id: number }>(queryBuilder);

    return response.rows;
  }

  /**
   * Insert a new submission record.
   *
   * @param {IInsertSubmissionRecord} submissionData
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionRepository
   */
  async insertSubmissionRecord(submissionData: IInsertSubmissionRecord): Promise<{ submission_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission (
        source_transform_id,
        uuid,
        record_effective_date,
        input_key,
        input_file_name,
        eml_source,
        darwin_core_source
      ) VALUES (
        ${submissionData.source_transform_id},
        ${submissionData.uuid},
        ${submissionData.event_timestamp},
        ${submissionData.input_key},
        ${submissionData.input_file_name},
        ${submissionData.eml_source},
        ${submissionData.darwin_core_source}
      )
      RETURNING
        submission_id;
    `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission record', [
        'SubmissionRepository->insertSubmissionRecord',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update the `input_key` column of a submission record.
   *
   * @param {number} submissionId
   * @param {IInsertSubmissionRecord['input_key']} inputKey
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionRepository
   */
  async updateSubmissionRecordInputKey(
    submissionId: number,
    inputKey: IInsertSubmissionRecord['input_key']
  ): Promise<{ submission_id: number }> {
    const sqlStatement = SQL`
      UPDATE
        submission
      SET
        input_key = ${inputKey}
      WHERE
        submission_id = ${submissionId}
      RETURNING
        submission_id;
    `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update submission record key', [
        'SubmissionRepository->updateSubmissionRecordInputKey',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch a submission record by primary id.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<ISubmissionModel>}
   * @memberof SubmissionRepository
   */
  async getSubmissionRecordBySubmissionId(submissionId: number): Promise<ISubmissionModel> {
    const sqlStatement = SQL`
      SELECT
        *
      FROM
        submission
      WHERE
        submission_id = ${submissionId};
    `;

    const response = await this.connection.sql<ISubmissionModel>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get submission record', [
        'SubmissionRepository->getSubmissionRecordBySubmissionId',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch a submission_id from uuid.
   *
   * @param {number} uuid
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionRepository
   */
  async getSubmissionIdByUUID(uuid: string): Promise<{ submission_id: number }> {
    const sqlStatement = SQL`
      SELECT
        submission_id
      FROM
        submission
      WHERE
        uuid = ${uuid}
      AND
        record_end_date IS NULL;
    `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

    return response.rows[0];
  }

  /**
   * Update record_end_date of submission id
   *
   * @param {number} submissionId
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionRepository
   */
  async setSubmissionIdEndDate(submissionId: number): Promise<{ submission_id: number }> {
    const sqlStatement = SQL`
    UPDATE
      submission
    SET
      record_end_date = now()
    WHERE
      submission_id = ${submissionId}
    RETURNING
      submission_id;
  `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update enddate in submission record', [
        'SubmissionRepository->setSubmissionIdEndDate',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch a submission source transform record by associated source system user id.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<ISourceTransformModel>}
   * @memberof SubmissionRepository
   */
  async getSourceTransformRecordBySystemUserId(systemUserId: number): Promise<ISourceTransformModel> {
    const sqlStatement = SQL`
        SELECT
          *
        FROM
          source_transform
        WHERE
          system_user_id = ${systemUserId};
      `;

    const response = await this.connection.sql<ISourceTransformModel>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get submission source transform record', [
        'SubmissionRepository->getSourceTransformRecordBySystemUserId',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert a new submission status record.
   *
   * @param {number} submissionId
   * @param {SUBMISSION_STATUS_TYPE} submissionStatusType
   * @return {*}  {Promise<{ submission_status_id: number; submission_status_type_id: number }>}
   * @memberof SubmissionRepository
   */
  async insertSubmissionStatus(
    submissionId: number,
    submissionStatusType: SUBMISSION_STATUS_TYPE
  ): Promise<{ submission_status_id: number; submission_status_type_id: number }> {
    const sqlStatement = SQL`
    INSERT INTO submission_status (
      submission_id,
      submission_status_type_id,
      event_timestamp
    ) VALUES (
      ${submissionId},
      (
        SELECT
          submission_status_type_id
        FROM
          submission_status_type
        WHERE
          name = ${submissionStatusType}
      ),
      now()
    )
    RETURNING
      submission_status_id,
      submission_status_type_id;
  `;

    const response = await this.connection.sql<{ submission_status_id: number; submission_status_type_id: number }>(
      sqlStatement
    );

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission status record', [
        'SubmissionRepository->insertSubmissionStatus',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert a submission message record.
   *
   * @param {number} submissionStatusId
   * @param {SUBMISSION_MESSAGE_TYPE} submissionMessageType
   * @return {*}  {Promise<{ submission_message_id: number; submission_message_type_id: number }>}
   * @memberof SubmissionRepository
   */
  async insertSubmissionMessage(
    submissionStatusId: number,
    submissionMessageType: SUBMISSION_MESSAGE_TYPE,
    submissionMessage: string
  ): Promise<{ submission_message_id: number; submission_message_type_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission_message (
        submission_status_id,
        submission_message_type_id,
        event_timestamp,
        message
      ) VALUES (
        ${submissionStatusId},
        (
          SELECT
            submission_message_type_id
          FROM
            submission_message_type
          WHERE
            name = ${submissionMessageType}
        ),
        now(),
        ${submissionMessage}
      )
      RETURNING
        submission_message_id,
        submission_message_type_id;
    `;

    const response = await this.connection.sql<{ submission_message_id: number; submission_message_type_id: number }>(
      sqlStatement
    );

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission message record', [
        'SubmissionRepository->insertSubmissionMessage',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch a submission record by primary id.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<ISubmissionModel>}
   * @memberof SubmissionRepository
   */
  async listSubmissionRecords(): Promise<ISubmissionModelWithStatus[]> {
    const sqlStatement = SQL`
      SELECT
        t1.submission_status,
        s.*
      FROM
        submission s
      LEFT JOIN
        (SELECT DISTINCT ON (ss.submission_id)
          ss.submission_id,
          sst.name AS submission_status
        FROM
          submission_status ss
        LEFT JOIN
          submission_status_type sst
        ON
          ss.submission_status_type_id = sst.submission_status_type_id
        ORDER BY
          ss.submission_id, ss.submission_status_id DESC) t1
      ON
        t1.submission_id = s.submission_id;
    `;

    const response = await this.connection.sql<ISubmissionModelWithStatus>(sqlStatement);

    return response.rows;
  }

  /**
   * Fetch a submission source transform record by associated source system user id.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<ISourceTransformModel>}
   * @memberof SubmissionRepository
   */
  async getSourceTransformRecordBySubmissionId(submissionId: number): Promise<ISourceTransformModel> {
    const sqlStatement = SQL`
          SELECT
            *
          FROM
            source_transform st
          LEFT JOIN
            submission s
          ON
            st.source_transform_id = s.source_transform_id
          WHERE
            s.submission_id = ${submissionId};
        `;

    const response = await this.connection.sql<ISourceTransformModel>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get submission source transform record', [
        'SubmissionRepository->getSourceTransformRecordBySystemUserId',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update darwin_core_source field in submission table
   *
   * @param {number} submissionId
   * @param {string} normalizedData
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionRepository
   */
  async updateSubmissionRecordDWCSource(
    submissionId: number,
    normalizedData: string
  ): Promise<{ submission_id: number }> {
    const sqlStatement = SQL`
      UPDATE
        submission
      SET
        darwin_core_source = ${normalizedData}
      WHERE
        submission_id = ${submissionId}
      RETURNING
        submission_id;
    `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update submission record darwin core source', [
        'SubmissionRepository->updateSubmissionRecordDWCSource',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }
}
