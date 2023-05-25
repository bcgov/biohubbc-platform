import { QueryResult } from 'pg';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import { getKnexQueryBuilder } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { EMLFile } from '../utils/media/eml/eml-file';
import { BaseRepository } from './base-repository';

export const DatasetsToReview = z.object({
  artifacts_to_review: z.number(),
  dataset_id: z.string(),
  dataset_name: z.string(),
  last_updated: z.string(),
  related_projects: z
    .array(z.string())
    .nullable()
    .optional()
    .transform((item) => item || [])
    .default([]),
  dataset_type: z.string()
});

export type DatasetsToReview = z.infer<typeof DatasetsToReview>;

export interface ISpatialComponentCount {
  spatial_type: string;
  count: number;
}

export interface ISearchSubmissionCriteria {
  keyword?: string;
  spatial?: string;
}

export interface ISubmissionRecord {
  submission_id?: number;
  source_transform_id: number;
  uuid: string;
  create_date?: string;
  create_user?: string;
  update_date?: string;
  update_user?: string;
  revision_count?: string;
}

export interface ISubmissionRecordWithSpatial {
  id: string;
  source: Record<string, unknown>;
  observation_count: number;
}

/**
 * Submission table model.
 *
 * @export
 * @interface ISubmissionModel
 */
export interface ISubmissionModel {
  submission_id?: number;
  source_transform_id: number;
  uuid: string;
  create_date?: string;
  create_user?: number;
  update_date?: string | null;
  update_user?: number | null;
  revision_count?: number;
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
  metadata_transform: string | null;
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
  'PUBLISHED' = 'Published',
  'REJECTED' = 'Rejected',
  'SYSTEM_ERROR' = 'System Error',
  //Success
  'OUT_DATED_RECORD' = 'Out Dated Record',
  'INGESTED' = 'Ingested',
  'UPLOADED' = 'Uploaded',
  'VALIDATED' = 'Validated',
  'SECURED' = 'Secured',
  'EML_INGESTED' = 'EML Ingested',
  'EML_TO_JSON' = 'EML To JSON',
  'METADATA_TO_ES' = 'Metadata To ES',
  'NORMALIZED' = 'Normalized',
  'SPATIAL_TRANSFORM_UNSECURE' = 'Spatial Transform Unsecure',
  'SPATIAL_TRANSFORM_SECURE' = 'Spatial Transform Secure',
  //Failure
  'FAILED_INGESTION' = 'Failed Ingestion',
  'FAILED_UPLOAD' = 'Failed Upload',
  'FAILED_VALIDATION' = 'Failed Validation',
  'FAILED_SECURITY' = 'Failed Security',
  'FAILED_EML_INGESTION' = 'Failed EML Ingestion',
  'FAILED_EML_TO_JSON' = 'Failed EML To JSON',
  'FAILED_METADATA_TO_ES' = 'Failed Metadata To ES',
  'FAILED_NORMALIZATION' = 'Failed Normalization',
  'FAILED_SPATIAL_TRANSFORM_UNSECURE' = 'Failed Spatial Transform Unsecure',
  'FAILED_SPATIAL_TRANSFORM_SECURE' = 'Failed Spatial Transform Secure'
}

export enum SUBMISSION_MESSAGE_TYPE {
  'NOTICE' = 'Notice',
  'ERROR' = 'Error',
  'WARNING' = 'Warning',
  'DEBUG' = 'Debug'
}

export interface ISubmissionJobQueueRecord {
  submission_job_queue_id: number;
  submission_id: number;
  job_start_timestamp: string | null;
  job_end_timestamp: string | null;
  security_request: string | null; // JSON string
  key: string | null;
  create_date: string;
  create_user: number;
  update_date: string | null;
  update_user: number | null;
  revision_count: number;
}

export interface ISubmissionMetadataRecord {
  submission_metadata_id?: number;
  submission_id: number;
  eml_source: string;
  eml_json_source?: any;
  record_effective_timestamp?: string | null;
  record_end_timestamp?: string | null;
  create_date?: string;
  create_user?: string;
  update_date?: string;
  update_user?: string;
  revision_count?: string;
}

export interface ISubmissionObservationRecord {
  submission_observation_id?: number;
  submission_id: number;
  darwin_core_source: any;
  submission_security_request?: string | null;
  security_review_timestamp?: string | null;
  foi_reason_description?: string | null;
  record_effective_timestamp?: string | null;
  record_end_timestamp?: string | null;
  create_date?: string;
  create_user?: string;
  update_date?: string;
  update_user?: string;
  revision_count?: string;
}

/**
 * A repository class for accessing submission data.
 *
 * @export
 * @class SubmissionRepository
 * @extends {BaseRepository}
 */
export class SubmissionRepository extends BaseRepository {
  /**
   * Insert a new submission record.
   *
   * @param {ISubmissionRecord} submissionData
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionRepository
   */
  async insertSubmissionRecord(submissionData: ISubmissionRecord): Promise<{ submission_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission (
        source_transform_id,
        uuid
      ) VALUES (
        ${submissionData.source_transform_id},
        ${submissionData.uuid}
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
   * Insert a new submission record, returning the record having the matching UUID if it already exists.
   *
   * Because `ON CONFLICT ... DO NOTHING` fails to yield the submission_id, the query simply updates the
   * uuid with the given value in the case that they match, which allows us to retrieve the submission_id
   * and infer that the query ran successfully.
   *
   * @param {ISubmissionModel} submissionData The submission record
   * @return {*} {Promise<{ submission_id: number }>} The primary key of the submission
   * @memberof SubmissionRepository
   */
  async insertSubmissionRecordWithPotentialConflict(
    submissionData: ISubmissionModel
  ): Promise<{ submission_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission (
        source_transform_id,
        uuid
      ) VALUES (
        ${submissionData.source_transform_id},
        ${submissionData.uuid}
      )
      ON CONFLICT (uuid) DO UPDATE SET uuid = ${submissionData.uuid}
      RETURNING
        submission_id;
    `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get or insert submission record', [
        'SubmissionRepository->insertSubmissionRecordWithPotentialConflict',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update the `eml_source` column of a submission record.
   *
   * @param {number} submissionId
   * @param {number} submissionMetadataId
   * @param {EMLFile} file
   * @return {*}  {Promise<{ submission_metadata_id: number }>}
   * @memberof SubmissionRepository
   */
  async updateSubmissionMetadataEMLSource(
    submissionId: number,
    submissionMetadataId: number,
    file: EMLFile
  ): Promise<{ submission_metadata_id: number }> {
    const sqlStatement = SQL`
      UPDATE
        submission_metadata
      SET
        eml_source = ${file.emlFile.buffer.toString()}
      WHERE
        submission_id = ${submissionId}
        AND
        submission_metadata_id =${submissionMetadataId}
      RETURNING
        submission_metadata_id;
    `;

    const response = await this.connection.sql<{ submission_metadata_id: number }>(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to update submission Metadata source', [
        'SubmissionRepository->updateSubmissionMetadataEMLSource',
        'rowCount was null or undefined, expected rowCount != 0'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update the `eml_json_source` column of a submission metadata.
   *
   * @param {number} submissionId
   * @param {number} submissionMetadataId
   * @param {ISubmissionMetadataRecord['eml_json_source']} EMLJSONSource
   * @return {*}  {Promise<{ submission_metadata_id: number }>}
   * @memberof SubmissionRepository
   */
  async updateSubmissionMetadataEMLJSONSource(
    submissionId: number,
    submissionMetadataId: number,
    EMLJSONSource: ISubmissionMetadataRecord['eml_json_source']
  ): Promise<{ submission_metadata_id: number }> {
    const sqlStatement = SQL`
      UPDATE
        submission_metadata
      SET
        eml_json_source = ${EMLJSONSource}
      WHERE
        submission_id = ${submissionId}
      AND
        submission_metadata_id =${submissionMetadataId}
      RETURNING
        submission_metadata_id;
    `;

    const response = await this.connection.sql<{ submission_metadata_id: number }>(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to update submission Metadata eml json', [
        'SubmissionRepository->updateSubmissionMetadataEMLJSONSource',
        'rowCount was null or undefined, expected rowCount != 0'
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

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to get submission record', [
        'SubmissionRepository->getSubmissionRecordBySubmissionId',
        'rowCount was null or undefined, expected rowCount != 0'
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
  async getSubmissionIdByUUID(uuid: string): Promise<{ submission_id: number } | null> {
    const sqlStatement = SQL`
      SELECT
        submission_id
      FROM
        submission
      WHERE
        uuid = ${uuid};
    `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);
    if (response.rowCount > 0) {
      return response.rows[0];
    } else {
      return null;
    }
  }

  /**
   * Get submission eml json by dataset id.
   *
   * @param {string} datasetId
   * @return {*}  {Promise<QueryResult<{ eml_json_source: Record<string, unknown> }>>}
   * @memberof SubmissionRepository
   */
  async getSubmissionRecordEMLJSONByDatasetId(
    datasetId: string
  ): Promise<QueryResult<{ eml_json_source: Record<string, unknown> }>> {
    const sqlStatement = SQL`
      SELECT
        sm.eml_json_source
      FROM submission s, submission_metadata sm
      WHERE s.submission_id = sm.submission_id
      AND sm.record_end_timestamp IS NULL
      AND s.uuid = ${datasetId};
    `;

    return this.connection.sql<{ eml_json_source: Record<string, unknown> }>(sqlStatement);
  }

  /**
   * Get spatial component counts by dataset id
   *
   * @param {string} datasetId
   * @return {*}  {Promise<ISpatialComponentCount[]>}
   * @memberof SubmissionRepository
   */
  async getSpatialComponentCountByDatasetId(datasetId: string): Promise<ISpatialComponentCount[]> {
    const sqlStatement = SQL`
        SELECT
          features_array #> '{properties, type}' spatial_type,
          count(features_array #> '{properties, type}')::integer count
        FROM
          submission_spatial_component ssc,
          jsonb_array_elements(ssc.spatial_component -> 'features') features_array,
          submission s,
          submission_observation so
        WHERE s.uuid = ${datasetId}
        AND so.submission_id = s.submission_id 
        AND ssc.submission_observation_id = so.submission_observation_id
        AND so.record_end_timestamp is null
        AND so.security_review_timestamp is not null
        GROUP BY spatial_type;
      `;
    const response = await this.connection.sql<ISpatialComponentCount>(sqlStatement);
    return response.rows;
  }

  /**
   * Fetch a submission source transform record by associated source system user id.
   *
   * @param {number} systemUserId
   * @return {*}  {Promise<ISourceTransformModel>}
   * @memberof SubmissionRepository
   */
  async getSourceTransformRecordBySystemUserId(systemUserId: number, version?: string): Promise<ISourceTransformModel> {
    const queryBuilder = getKnexQueryBuilder()
      .select('*')
      .from('source_transform')
      .where('system_user_id', systemUserId)
      .and.where('record_end_date', null);

    if (version) {
      queryBuilder.and.where('version', version);
    }

    const response = await this.connection.knex<ISourceTransformModel>(queryBuilder);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to get submission source transform record', [
        'SubmissionRepository->getSourceTransformRecordBySystemUserId',
        'rowCount was null or undefined, expected rowCount != 0'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch a submissions metadata json representation.
   *
   * @param {number} sourceTransformId
   * @param {string} transform
   * @return {*}  {Promise<ISourceTransformModel>}
   * @memberof SubmissionRepository
   */
  async getSubmissionMetadataJson(submissionId: number, transform: string): Promise<string> {
    const response = await this.connection.query<{ result_data: any }>(transform, [submissionId]);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to transform submission eml to json', [
        'SubmissionRepository->getSubmissionMetadataJson',
        'rowCount was null or undefined, expected rowCount != 0'
      ]);
    }

    return response.rows[0].result_data;
  }

  /**
   * Fetch a submission source transform record by associated source transform id.
   *
   * @param {number} sourceTransformId
   * @return {*}  {Promise<ISourceTransformModel>}
   * @memberof SubmissionRepository
   */
  async getSourceTransformRecordBySourceTransformId(sourceTransformId: number): Promise<ISourceTransformModel> {
    const sqlStatement = SQL`
        SELECT
          *
        FROM
          source_transform
        WHERE
          source_transform_id = ${sourceTransformId}
      `;

    const response = await this.connection.sql<ISourceTransformModel>(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to get submission source transform record', [
        'SubmissionRepository->getSourceTransformRecordBySourceTransformId',
        'rowCount was null or undefined, expected rowCount != 0'
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

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to get submission source transform record', [
        'SubmissionRepository->getSourceTransformRecordBySubmissionId',
        'rowCount was null or undefined, expected rowCount != 0'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch row of submission job queue by submission Id
   *
   * @param {number} submissionId
   * @return {*}  {Promise<ISubmissionJobQueueRecord>}
   * @memberof SubmissionRepository
   */
  async getSubmissionJobQueue(submissionId: number): Promise<ISubmissionJobQueueRecord> {
    const sqlStatement = SQL`
      SELECT
        *
      FROM
        submission_job_queue
      WHERE
        submission_id = ${submissionId} ORDER BY CREATE_DATE DESC LIMIT 1
      ;
    `;

    const response = await this.connection.sql<ISubmissionJobQueueRecord>(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to get submission job queue from submission id', [
        'SubmissionRepository->getSubmissionJobQueue',
        'rowCount was null or undefined, expected rowCount >= 0'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert a new metadata record
   *
   * @param {ISubmissionMetadataRecord} submissonMetadata
   * @return {*}  {Promise<{ submission_metadata_id: number }>}
   * @memberof SubmissionRepository
   */
  async insertSubmissionMetadataRecord(
    submissonMetadata: ISubmissionMetadataRecord
  ): Promise<{ submission_metadata_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission_metadata (
        submission_id,
        eml_source,
        eml_json_source
      ) VALUES (
        ${submissonMetadata.submission_id},
        ${submissonMetadata.eml_source},
        ${submissonMetadata.eml_json_source}
      )
      RETURNING
        submission_metadata_id
      ;
    `;

    const response = await this.connection.sql<{ submission_metadata_id: number }>(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to insert submission metadata record', [
        'SubmissionRepository->insertSubmissionMetadataRecord',
        'rowCount was null or undefined, expected rowCount >= 0'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert a new Observation Record
   *
   * @param {ISubmissionObservationRecord} submissonObservation
   * @return {*}  {Promise<{ submission_observation_id: number }>}
   * @memberof SubmissionRepository
   */
  async insertSubmissionObservationRecord(
    submissonObservation: ISubmissionObservationRecord
  ): Promise<{ submission_observation_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission_observation (
        submission_id,
        darwin_core_source,
        submission_security_request,
        foi_reason_description,
        record_effective_timestamp
      ) VALUES (
        ${submissonObservation.submission_id},
        ${submissonObservation.darwin_core_source},
        ${submissonObservation.submission_security_request},
        ${submissonObservation.foi_reason_description},
        now()
      )
      RETURNING
        submission_observation_id
      ;
    `;

    const response = await this.connection.sql<{ submission_observation_id: number }>(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to insert submission observation record', [
        'SubmissionRepository->insertSubmissionObservationRecord',
        'rowCount was null or undefined, expected rowCount >= 0'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update record_end_timestamp of submission id
   *
   * @param {number} submissionId
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionRepository
   */
  async updateSubmissionMetadataRecordEndDate(submissionId: number): Promise<number> {
    const sqlStatement = SQL`
      UPDATE
        submission_metadata
      SET
        record_end_timestamp = now()
      WHERE
        submission_id = ${submissionId}
      AND
        record_end_timestamp IS NULL
      AND
        record_effective_timestamp IS NOT NULL
      ;
    `;

    const response = await this.connection.sql(sqlStatement);

    return response.rowCount;
  }

  /**
   * Update start time stamp of submission metadata record
   *
   * @param {number} submissionId
   * @return {*}  {Promise<number>}
   * @memberof SubmissionRepository
   */
  async updateSubmissionMetadataRecordEffectiveDate(submissionId: number): Promise<number> {
    const sqlStatement = SQL`
      UPDATE
        submission_metadata
      SET
        record_effective_timestamp = now()
      WHERE
        submission_id = ${submissionId}
      AND
        record_effective_timestamp IS NULL
      AND
        record_end_timestamp IS NULL
      ;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to update record_effective_timestamp submission metadata record', [
        'SubmissionRepository->updateSubmissionMetadataRecordEffectiveDate',
        'rowCount was null or undefined, expected rowCount >= 0'
      ]);
    }

    return response.rowCount;
  }

  /**
   * Update end time stamp for submission observation record
   *
   * @param {number} submissionId
   * @return {*}  {Promise<number>}
   * @memberof SubmissionRepository
   */
  async updateSubmissionObservationRecordEndDate(submissionId: number): Promise<number> {
    const sqlStatement = SQL`
      UPDATE
        submission_observation
      SET
        record_end_timestamp = now()
      WHERE
        submission_id = ${submissionId}
      AND
        record_end_timestamp IS NULL
      AND
        record_effective_timestamp IS NOT NULL
      ;
    `;

    const response = await this.connection.sql(sqlStatement);

    return response.rowCount;
  }

  /**
   * Fetches a count of artifacts that require security review for each dataset
   *
   * @returns {*} {Promise<DatasetsToReview[]>}
   * @memberof SubmissionRepository
   */
  async getDatasetsForReview(): Promise<DatasetsToReview[]> {
    // 3 queries to collect the datasets for the admin dashboard
    // The first sub-query is getting a count of un reviewed (`security_review_timestamp is null`) artifacts for all datasets
    // the second sub-query is parsing the eml json object for dataset type and related projects for all active projects (record_end_timestamp IS NULL)
    // The top level SELECT is combining the data collected in the sub-queries to create an list that will feed the admin dashboard
    const sql = SQL`
    SELECT
      sm.eml_json_source::json->'eml:eml'->'dataset'->>'title' as dataset_name,
      fc.artifacts_to_review,
      fc.dataset_id,
      fc.last_updated,
      project_metadata.*
    FROM submission_metadata sm, (
      SELECT
        s.uuid as dataset_id,
        COUNT(a.artifact_id)::int as artifacts_to_review,
        a.submission_id,
        MAX(a.create_date)::date as last_updated
      FROM artifact a, submission s
      WHERE a.submission_id = s.submission_id
      AND security_review_timestamp is null
      GROUP BY a.submission_id , s.submission_id, s.uuid
    ) as fc,
    (
      SELECT 
        s.uuid,
        sm.submission_id, 
        json_extract_path_text(additional_metadata, 'metadata', 'types', 'type') as dataset_type,
  		  COALESCE(json_agg(json_extract_path_text(related_projects, '@_id')) filter (where json_extract_path_text(related_projects, '@_id') IS NOT NULL), null) as related_projects
    FROM 
        submission s, 
        submission_metadata sm, 
        json_array_elements(sm.eml_json_source::json->'eml:eml'->'additionalMetadata') as additional_metadata
        LEFT JOIN LATERAL json_array_elements(sm.eml_json_source::json->'eml:eml'->'dataset'->'project'->'relatedProject') as related_projects ON true
      WHERE s.submission_id = sm.submission_id 
      AND sm.record_end_timestamp IS NULL
      AND additional_metadata->>'describes' = s.uuid::text
      AND json_extract_path_text(additional_metadata, 'metadata', 'types', 'type') IS NOT NULL
      GROUP BY s.uuid, sm.submission_id, dataset_type
    ) as project_metadata
    WHERE sm.submission_id = fc.submission_id
    AND sm.record_end_timestamp IS NULL
    AND project_metadata.uuid = fc.dataset_id;
    `;

    const response = await this.connection.sql(sql, DatasetsToReview);

    return response.rows;
  }

  /**
   *
   * @param submissionId the submission to update
   * @param submitterSystem The name of the system that is submitted data e.g. 'sims'
   * @param datasetSearch
   * @returns {*} {Promise<number>} the number of rows updated
   * @memberof SubmissionRepository
   */
  async updateSubmissionMetadataWithSearchKeys(
    submissionId: number,
    submitterSystem: string,
    datasetSearch: any
  ): Promise<number> {
    const sql = SQL`
    UPDATE 
      submission_metadata 
    SET 
      dataset_search_criteria=${datasetSearch}, 
      submitter_system= ${submitterSystem} 
    WHERE submission_id = ${submissionId}
    AND record_end_timestamp IS NULL;
    `;

    const response = await this.connection.sql(sql);

    return response.rowCount;
  }

  async getDatasetsForReview_new(keywordFilter: string[]): Promise<any[]> {
    const sql = SQL`
      SELECT 
        s.uuid as dataset_id, 
        sm.submission_id, 
        sm.dataset_search_criteria::json->>'primaryKeywords' as keywords, 
        sm.submitter_system,
        sm.eml_json_source::json->'eml:eml'->'dataset'->'project'->'relatedProject' as related_projects
      FROM 
        submission s, 
        submission_metadata sm
      WHERE s.submission_id = sm.submission_id
      AND sm.record_end_timestamp IS NULL
      AND (sm.dataset_search_criteria->'primaryKeywords')::jsonb \?| array[${keywordFilter.join(",")}];
    `;

    const response = await this.connection.sql(sql);

    return response.rows;
  }

  async getArtifactsForReviewForSubmissionUUID(uuids: string[]): Promise<any[]> {
    const sql = SQL`
      SELECT
        s.uuid as dataset_id,
        COUNT(a.artifact_id)::int as artifacts_to_review,
        s.submission_id ,
        MAX(a.create_date)::date as last_updated
      FROM artifact a, submission s
      WHERE s.submission_id = a.submission_id
      AND a.security_review_timestamp is null
      AND s.uuid::text in (${uuids.join(",")})
      GROUP BY s.submission_id, dataset_id;
    `;

    console.log(sql)
    const response = await this.connection.sql(sql);

    return response.rows;
  }
}
