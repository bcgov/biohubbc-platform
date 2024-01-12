import { Knex } from 'knex';
import { QueryResult } from 'pg';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import { getKnex, getKnexQueryBuilder } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { EMLFile } from '../utils/media/eml/eml-file';
import { BaseRepository } from './base-repository';
import { SECURITY_APPLIED_STATUS } from './security-repository';
import { simsHandlebarsTemplate_DETAILS, simsHandlebarsTemplate_HEADER } from './templates/SIMS-handlebar-template';

export interface IHandlebarsTemplates {
  header: string;
  details: string;
}
export interface IDatasetsForReview {
  dataset_id: string; // UUID
  artifacts_to_review: number;
  dataset_name: string;
  last_updated: string;
  keywords: string[];
}

export interface ISubmissionFeature {
  id: string;
  type: string;
  properties: Record<string, unknown>;
  features: ISubmissionFeature[];
}

export const DatasetMetadata = z.object({
  dataset_id: z.string(),
  submission_id: z.number(),
  dataset_name: z.string(),
  keywords: z.array(z.string()),
  related_projects: z
    .array(z.any())
    .nullable()
    .optional()
    .transform((item) => item || [])
});

export type DatasetMetadata = z.infer<typeof DatasetMetadata>;

export const DatasetArtifactCount = z.object({
  dataset_id: z.string(),
  submission_id: z.number(),
  artifacts_to_review: z.number(),
  last_updated: z.string().nullable()
});

export type DatasetArtifactCount = z.infer<typeof DatasetArtifactCount>;

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

export const SubmissionFeatureRecord = z.object({
  submission_feature_id: z.number(),
  uuid: z.string(),
  submission_id: z.number(),
  feature_type_id: z.number(),
  source_id: z.string(),
  data: z.record(z.any()),
  parent_submission_feature_id: z.number().nullable(),
  record_effective_date: z.string(),
  record_end_date: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number()
});

export type SubmissionFeatureRecord = z.infer<typeof SubmissionFeatureRecord>;

export const SubmissionFeatureRecordWithTypeAndSecurity = SubmissionFeatureRecord.extend({
  feature_type_name: z.string(),
  feature_type_display_name: z.string(),
  submission_feature_security_ids: z.array(z.number())
});

export type SubmissionFeatureRecordWithTypeAndSecurity = z.infer<typeof SubmissionFeatureRecordWithTypeAndSecurity>;

export const FeatureTypeRecord = z.object({
  feature_type_id: z.number(),
  name: z.string(),
  display_name: z.string(),
  description: z.string(),
  record_effective_date: z.string(),
  record_end_date: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number()
});

export type FeatureTypeRecord = z.infer<typeof FeatureTypeRecord>;

export const SubmissionFeatureDownloadRecord = z.object({
  submission_feature_id: z.number(),
  parent_submission_feature_id: z.number().nullable(),
  feature_type_name: z.string(),
  data: z.record(z.any()),
  level: z.number()
});

export type SubmissionFeatureDownloadRecord = z.infer<typeof SubmissionFeatureDownloadRecord>;

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
  uuid: string;
  security_review_timestamp?: string | null;
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
  foi_reason?: string | boolean | null;
  record_effective_timestamp?: string | null;
  record_end_timestamp?: string | null;
  create_date?: string;
  create_user?: string;
  update_date?: string;
  update_user?: string;
  revision_count?: string;
}

export const SubmissionRecord = z.object({
  submission_id: z.number(),
  uuid: z.string(),
  source_id: z.string(),
  security_review_timestamp: z.string().nullable(),
  submitted_timestamp: z.string(),
  system_user_id: z.number(),
  source_system: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  publish_timestamp: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number()
});

export type SubmissionRecord = z.infer<typeof SubmissionRecord>;

export const SubmissionRecordWithSecurity = SubmissionRecord.extend({
  security: z.nativeEnum(SECURITY_APPLIED_STATUS)
});

export type SubmissionRecordWithSecurity = z.infer<typeof SubmissionRecordWithSecurity>;

export const SubmissionRecordWithSecurityAndRootFeatureType = SubmissionRecord.extend({
  security: z.nativeEnum(SECURITY_APPLIED_STATUS),
  root_feature_type_id: z.number(),
  root_feature_type_name: z.string()
});

export type SubmissionRecordWithSecurityAndRootFeatureType = z.infer<
  typeof SubmissionRecordWithSecurityAndRootFeatureType
>;

export const SubmissionRecordPublished = SubmissionRecord.extend({
  security: z.nativeEnum(SECURITY_APPLIED_STATUS),
  root_feature_type_id: z.number(),
  root_feature_type_name: z.string(),
  root_feature_type_display_name: z.string()
});

export type SubmissionRecordPublished = z.infer<typeof SubmissionRecordPublished>;

export const SubmissionMessageRecord = z.object({
  submission_message_id: z.number(),
  submission_message_type_id: z.number(),
  submission_id: z.number(),
  label: z.string(),
  message: z.string(),
  data: z.record(z.string(), z.any()).nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number()
});

export type SubmissionMessageRecord = z.infer<typeof SubmissionMessageRecord>;

export const PatchSubmissionRecord = z.object({
  security_reviewed: z.boolean().optional(),
  published: z.boolean().optional()
});

export type PatchSubmissionRecord = z.infer<typeof PatchSubmissionRecord>;

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
   * Insert a new submission record.
   *
   * @param {string} sourceId
   * @param {string} name
   * @param {string} description
   * @param {string} userIdentifier
   * @return {*}  {Promise<SubmissionRecord>}
   * @memberof SubmissionRepository
   */
  async insertSubmissionRecordWithPotentialConflict(
    sourceId: string,
    name: string,
    description: string,
    systemUserId: number,
    systemUserIdentifier: string
  ): Promise<SubmissionRecord> {
    const sqlStatement = SQL`
      INSERT INTO submission (
        source_id,
        submitted_timestamp,
        name,
        description,
        system_user_id,
        source_system
      ) VALUES (
        ${sourceId},
        now(),
        ${name},
        ${description},
        ${systemUserId},
        ${systemUserIdentifier}
      )
      RETURNING
        *;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionRecord);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get or insert submission record', [
        'SubmissionRepository->insertSubmissionRecordWithPotentialConflict',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert a new submission feature record.
   *
   * @param {number} submissionId
   * @param {string} sourceId
   * @param {string} featureTypeName
   * @param {ISubmissionFeature['properties']} featureProperties
   * @return {*}  {Promise<{ submission_feature_id: number }>}
   * @memberof SubmissionRepository
   */
  async insertSubmissionFeatureRecord(
    submissionId: number,
    featureSourceId: string,
    featureTypeName: string,
    featureProperties: ISubmissionFeature['properties']
  ): Promise<{ submission_feature_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission_feature (
        submission_id,
        source_id,
        feature_type_id,
        data,
        record_effective_date
      ) VALUES (
        ${submissionId},
        ${featureSourceId},
        (SELECT feature_type_id FROM feature_type WHERE name = ${featureTypeName}),
        ${featureProperties},
        now()
      )
      RETURNING
        submission_feature_id;
    `;

    const response = await this.connection.sql(sqlStatement, z.object({ submission_feature_id: z.number() }));

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission feature record', [
        'SubmissionRepository->insertSubmissionFeatureRecord',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get feature type id by name.
   *
   * @param {string} name
   * @return {*}  {Promise<{ feature_type_id: number }>}
   * @memberof SubmissionRepository
   */
  async getFeatureTypeIdByName(name: string): Promise<{ feature_type_id: number }> {
    const sqlStatement = SQL`
      SELECT
        feature_type_id
      FROM
        feature_type
      WHERE
        name = ${name};
    `;

    const response = await this.connection.sql<{ feature_type_id: number }>(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to get feature type record', [
        'SubmissionRepository->getFeatureTypeByName',
        'rowCount was null or undefined, expected rowCount != 0'
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
      AND sm.record_effective_timestamp IS NOT NULL
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
   * @param {ISubmissionMetadataRecord} submissionMetadata
   * @return {*}  {Promise<{ submission_metadata_id: number }>}
   * @memberof SubmissionRepository
   */
  async insertSubmissionMetadataRecord(
    submissionMetadata: ISubmissionMetadataRecord
  ): Promise<{ submission_metadata_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission_metadata (
        submission_id,
        eml_source,
        eml_json_source
      ) VALUES (
        ${submissionMetadata.submission_id},
        ${submissionMetadata.eml_source},
        ${submissionMetadata.eml_json_source}
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
   * @param {ISubmissionObservationRecord} submissionObservation
   * @return {*}  {Promise<{ submission_observation_id: number }>}
   * @memberof SubmissionRepository
   */
  async insertSubmissionObservationRecord(
    submissionObservation: ISubmissionObservationRecord
  ): Promise<{ submission_observation_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission_observation (
        submission_id,
        darwin_core_source,
        submission_security_request,
        foi_reason,
        record_effective_timestamp
      ) VALUES (
        ${submissionObservation.submission_id},
        ${submissionObservation.darwin_core_source},
        ${submissionObservation.submission_security_request},
        ${submissionObservation.foi_reason},
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
   * Finds an object of handlebars templates for a given datasetId to power the project details page
   *
   * //TODO: Eventually will integrate datasetId specific handlebars  @param datasetId a dataset UUID for determining the handlebars template to fetch
   * @returns {*} {Promise<IDetailsPage>} an object containing a string of handlebars templates
   * @memberof SubmissionRepository
   */
  async getHandleBarsTemplateByDatasetId(datasetId: string): Promise<IHandlebarsTemplates> {
    return {
      header: simsHandlebarsTemplate_HEADER,
      details: simsHandlebarsTemplate_DETAILS
    };
  }

  /**
   *
   * @param submissionId the submission to update
   * @param datasetSearch
   * @returns {*} {Promise<number>} the number of rows updated
   * @memberof SubmissionRepository
   */
  async updateSubmissionMetadataWithSearchKeys(submissionId: number, datasetSearch: any): Promise<number> {
    const sql = SQL`
    UPDATE
      submission_metadata
    SET
      dataset_search_criteria=${datasetSearch}
    WHERE submission_id = ${submissionId}
    AND record_end_timestamp IS NULL
    AND record_effective_timestamp IS NOT NULL;
    `;

    const response = await this.connection.sql(sql);

    return response.rowCount;
  }

  /**
   * Gets datasets that have artifacts that require a security review.
   *
   * @param keywordFilter A list of keys to filter the data based on search criteria defined by the transform process
   * @returns {*}  {Promise<IDatasetsForReview[]>}
   */
  async getDatasetsForReview(keywordFilter: string[]): Promise<DatasetMetadata[]> {
    const knex = getKnex();
    const queryBuilder = knex
      .queryBuilder()
      .select(
        's.uuid as dataset_id',
        'sm.submission_id',
        knex.raw(`sm.eml_json_source::json->'eml:eml'->'dataset'->>'title' as dataset_name`),
        knex.raw(`sm.dataset_search_criteria::json->'primaryKeywords' as keywords`),
        knex.raw(`sm.eml_json_source::json->'eml:eml'->'dataset'->'project'->'relatedProject' as related_projects`)
      )
      .from('submission as s')
      .leftJoin('submission_metadata as sm', 'sm.submission_id', 's.submission_id')
      .whereNull('sm.record_end_timestamp')
      // the ?| operator does a containment check meaning it will check if any elements in the left side array exist in the right side array
      .whereRaw(
        `(sm.dataset_search_criteria->'primaryKeywords')::jsonb \\?| array[${"'" + keywordFilter.join("','") + "'"}]`
      );

    const response = await this.connection.knex(queryBuilder, DatasetMetadata);

    return response.rows;
  }

  /**
   * Gets a count of all artifacts for a given submission UUID.
   *
   * @param uuid UUID of the submission to look for
   * @returns {*} Promise<DatasetArtifactCount | undefined>
   */
  async getArtifactForReviewCountForSubmissionUUID(uuid: string): Promise<DatasetArtifactCount | undefined> {
    const knex = getKnex();
    const queryBuilder = knex
      .queryBuilder()
      .select(
        's.uuid as dataset_id',
        's.submission_id',
        knex.raw(`COUNT(a.artifact_id)::int as artifacts_to_review`),
        knex.raw(`MAX(a.create_date)::date as last_updated`)
      )
      .from('submission as s')
      .leftJoin('artifact as a', 'a.submission_id', 's.submission_id')
      .whereNull('a.security_review_timestamp')
      .where('s.uuid', uuid)
      .groupBy(['s.submission_id', 's.uuid']);
    const response = await this.connection.knex(queryBuilder, DatasetArtifactCount);

    return response.rows[0];
  }

  /**
   * Get all submissions that are pending security review (are unreviewed).
   *
   * @return {*}  {Promise<SubmissionRecordWithSecurityAndRootFeatureType[]>}
   * @memberof SubmissionRepository
   */
  async getUnreviewedSubmissionsForAdmins(): Promise<SubmissionRecordWithSecurityAndRootFeatureType[]> {
    const sqlStatement = SQL`
      WITH w_unique_submissions as (
        SELECT
          DISTINCT ON (submission.source_id) submission.*,
          submission_feature.feature_type_id as root_feature_type_id,
          feature_type.name as root_feature_type_name,
          ${SECURITY_APPLIED_STATUS.PENDING} as security
        FROM
          submission
        INNER JOIN
          submission_feature
        ON
          submission.submission_id = submission_feature.submission_id
        INNER JOIN
          feature_type
        ON
          feature_type.feature_type_id = submission_feature.feature_type_id
        WHERE
          submission.security_review_timestamp IS NULL
        AND
          submission_feature.parent_submission_feature_id IS NULL
        ORDER BY
          submission.source_id, submission.submission_id DESC
      )
      SELECT
        *
      FROM
        w_unique_submissions
      ORDER BY submitted_timestamp DESC;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionRecordWithSecurityAndRootFeatureType);

    return response.rows;
  }

  /**
   * Get all submissions that have completed security review (are reviewed).
   *
   * @return {*}  {Promise<SubmissionRecordWithSecurityAndRootFeatureType[]>}
   * @memberof SubmissionRepository
   */
  async getReviewedSubmissionsForAdmins(): Promise<SubmissionRecordWithSecurityAndRootFeatureType[]> {
    const sqlStatement = SQL`
      WITH w_unique_submissions as (
        SELECT
          DISTINCT ON (submission.source_id) submission.*,
          submission_feature.feature_type_id as root_feature_type_id,
          feature_type.name as root_feature_type_name,
          CASE
            WHEN submission.security_review_timestamp is null THEN ${SECURITY_APPLIED_STATUS.PENDING}
            WHEN COUNT(submission_feature_security.submission_feature_security_id) = 0 THEN ${SECURITY_APPLIED_STATUS.UNSECURED}
            WHEN COUNT(submission_feature_security.submission_feature_security_id) = COUNT(submission_feature.submission_feature_id) THEN ${SECURITY_APPLIED_STATUS.SECURED}
            ELSE ${SECURITY_APPLIED_STATUS.PARTIALLY_SECURED}
          END as security
        FROM
          submission
        INNER JOIN
          submission_feature
        ON
          submission.submission_id = submission_feature.submission_id
        INNER JOIN
          feature_type
        ON
          feature_type.feature_type_id = submission_feature.feature_type_id
        LEFT JOIN
          submission_feature_security
        ON
          submission_feature.submission_feature_id = submission_feature_security.submission_feature_id
        WHERE
          submission.security_review_timestamp IS NOT NULL
        AND
          submission_feature.parent_submission_feature_id IS NULL
        GROUP BY
          submission.submission_id,
          submission_feature.feature_type_id,
          feature_type.name
        ORDER BY
          submission.source_id, submission.submission_id DESC
      )
      SELECT
        *
      FROM
        w_unique_submissions
      ORDER BY
        security_review_timestamp DESC;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionRecordWithSecurityAndRootFeatureType);

    return response.rows;
  }

  /**
   * Get all submission features by submission id.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<SubmissionFeatureRecordWithTypeAndSecurity[]>}
   * @memberof SubmissionRepository
   */
  async getSubmissionFeaturesBySubmissionId(
    submissionId: number
  ): Promise<SubmissionFeatureRecordWithTypeAndSecurity[]> {
    const sqlStatement = SQL`
      SELECT
        submission_feature.*,
        feature_type.name as feature_type_name,
        feature_type.display_name as feature_type_display_name,
        array_remove(array_agg(submission_feature_security.submission_feature_security_id), NULL) AS submission_feature_security_ids
      FROM
        submission_feature
      INNER JOIN
        feature_type
      ON
        feature_type.feature_type_id = submission_feature.feature_type_id
       LEFT JOIN
        submission_feature_security
      ON
        submission_feature_security.submission_feature_id = submission_feature.submission_feature_id
      WHERE
        submission_id = ${submissionId}
      GROUP BY
        submission_feature.submission_feature_id,
        feature_type.name,
        feature_type.display_name,
        feature_type.sort
      ORDER BY
        feature_type.sort ASC;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionFeatureRecordWithTypeAndSecurity);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to get submission feature record', [
        'SubmissionRepository->getSubmissionFeaturesBySubmissionId',
        'rowCount was null or undefined, expected rowCount != 0'
      ]);
    }

    return response.rows;
  }

  /**
   * Get a submission record by id (with security status).
   *
   * @param {number} submissionId
   * @return {*}  {Promise<SubmissionRecordWithSecurity>}
   * @memberof SubmissionRepository
   */
  async getSubmissionRecordBySubmissionIdWithSecurity(submissionId: number): Promise<SubmissionRecordWithSecurity> {
    const sqlStatement = SQL`
      SELECT
        submission.*,
        CASE
          WHEN COUNT(submission_feature_security.submission_feature_security_id) = 0 THEN ${SECURITY_APPLIED_STATUS.UNSECURED}
          WHEN COUNT(submission_feature_security.submission_feature_security_id) = COUNT(submission_feature.submission_feature_id) THEN ${SECURITY_APPLIED_STATUS.SECURED}
          ELSE ${SECURITY_APPLIED_STATUS.PARTIALLY_SECURED}
        END as security
      FROM
        submission
      INNER JOIN
        submission_feature
      ON
        submission_feature.submission_id = submission.submission_id
      LEFT JOIN
        submission_feature_security
      ON
        submission_feature.submission_feature_id = submission_feature_security.submission_feature_id
      WHERE
        submission.submission_id = ${submissionId}
      GROUP BY
        submission.submission_id;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionRecordWithSecurity);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get submission record with security status', [
        'SubmissionRepository->getSubmissionRecordBySubmissionIdWithSecurity',
        `rowCount was ${response.rowCount}, expected rowCount === 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a submission feature record by uuid.
   *
   * @param {string} submissionUuid
   * @return {*}  {Promise<SubmissionFeatureRecord>}
   * @memberof SubmissionRepository
   */
  async getSubmissionFeatureByUuid(submissionUuid: string): Promise<SubmissionFeatureRecord> {
    const sqlStatement = SQL`
      SELECT
        *
      FROM
        submission_feature
      WHERE
        uuid = ${submissionUuid};
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionFeatureRecord);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get submission feature record', [
        'SubmissionRepository->getSubmissionFeatureByUuid',
        `rowCount was ${response.rowCount}, expected rowCount === 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Find and return all submission feature records that match the provided criteria.
   *
   * @param {{
   *     submissionId?: number;
   *     systemUserId?: number;
   *     featureTypeNames?: string[];
   *     includeDeleted?: boolean;
   *   }} [criteria]
   * @return {*}  {Promise<SubmissionFeatureRecord[]>}
   * @memberof SubmissionRepository
   */
  async findSubmissionFeatures(criteria?: {
    submissionId?: number;
    systemUserId?: number;
    featureTypeNames?: string[];
    includeDeleted?: boolean;
  }): Promise<SubmissionFeatureRecord[]> {
    const knex = getKnex();

    const queryBuilder = knex.queryBuilder();

    queryBuilder.select().from('submission_feature');

    if (criteria?.submissionId) {
      // Filter by submitter system user id
      queryBuilder.where('submission_id', criteria.submissionId);
    }

    if (criteria?.systemUserId) {
      // Filter by submitter system user id
      queryBuilder.where('systemUserId', criteria.systemUserId);
    }

    if (criteria?.featureTypeNames?.length) {
      const featureTypeNames = criteria?.featureTypeNames;
      // Filter by feature type names
      queryBuilder.whereIn('feature_type_id', (qb) => {
        qb.select('feature_type_id')
          .from('feature_type')
          .where(
            knex.raw('LOWER(name)'),
            'IN',
            featureTypeNames.map((featureTypeName) => featureTypeName.toLowerCase())
          );
      });
    }

    const response = await this.connection.knex(queryBuilder, SubmissionFeatureRecord);

    return response.rows;
  }

  /**
   * Get all published submissions.
   *
   * @return {*}  {Promise<SubmissionRecordPublished[]>}
   * @memberof SubmissionRepository
   */
  async getPublishedSubmissions(): Promise<SubmissionRecordPublished[]> {
    const sqlStatement = SQL`
      SELECT
        submission.*,
        feature_type.feature_type_id as root_feature_type_id,
        feature_type.name as root_feature_type_name,
        feature_type.display_name as root_feature_type_display_name,
        CASE
          WHEN COUNT(submission_feature_security.submission_feature_security_id) = 0 THEN ${SECURITY_APPLIED_STATUS.UNSECURED}
          WHEN COUNT(submission_feature_security.submission_feature_security_id) = COUNT(submission_feature.submission_feature_id) THEN ${SECURITY_APPLIED_STATUS.SECURED}
	      ELSE ${SECURITY_APPLIED_STATUS.PARTIALLY_SECURED}
        END as security
      FROM
        submission
      INNER JOIN
        submission_feature
      ON
        submission_feature.submission_id = submission.submission_id
      LEFT JOIN
        submission_feature_security
      ON
        submission_feature.submission_feature_id = submission_feature_security.submission_feature_id
      INNER JOIN
        feature_type
      ON
        feature_type.feature_type_id = submission_feature.feature_type_id
      WHERE
        submission_feature.parent_submission_feature_id IS NULL
      AND
        submission.security_review_timestamp IS NOT NULL
      AND
        submission.publish_timestamp IS NOT NULL
      GROUP BY
        submission.submission_id,
        feature_type.feature_type_id,
        feature_type.name,
        feature_type.display_name
      ORDER BY
        submission.publish_timestamp ASC;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionRecordPublished);

    return response.rows;
  }

  /**
   * Get all messages for a submission.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<SubmissionMessageRecord[]>}
   * @memberof SubmissionRepository
   */
  async getMessages(submissionId: number): Promise<SubmissionMessageRecord[]> {
    const sqlStatement = SQL`
      SELECT
        *
      FROM
        submission_message
      WHERE
        submission_id = ${submissionId};
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionMessageRecord);

    return response.rows;
  }

  /**
   * Creates submission message records.
   *
   * @param {(Pick<
   *       SubmissionMessageRecord,
   *       'submission_id' | 'submission_message_type_id' | 'label' | 'message' | 'data'
   *     >[])} messages
   * @return {*}  {Promise<void>}
   * @memberof SubmissionRepository
   */
  async createMessages(
    messages: Pick<
      SubmissionMessageRecord,
      'submission_id' | 'submission_message_type_id' | 'label' | 'message' | 'data'
    >[]
  ): Promise<void> {
    const knex = getKnex();
    const queryBuilder = knex.queryBuilder().insert(messages);

    const response = await this.connection.knex(queryBuilder);

    if (response.rowCount !== messages.length) {
      throw new ApiExecuteSQLError('Failed to create submission messages', [
        'SubmissionRepository->createMessages',
        `rowCount was ${response.rowCount}, expected rowCount === ${messages.length}`
      ]);
    }
  }

  /**
   * Patch a submission record.
   *
   * @param {number} submissionId
   * @param {PatchSubmissionRecord} patch
   * @return {*}  {Promise<SubmissionRecord>}
   * @memberof SubmissionRepository
   */
  async patchSubmissionRecord(submissionId: number, patch: PatchSubmissionRecord): Promise<SubmissionRecord> {
    const knex = getKnex();
    const queryBuilder = knex.table('submission').where('submission_id', submissionId).returning('*');

    // Collect all update operations
    let updateOperations: Record<string, Knex.Raw> = {};

    if (patch.security_reviewed === true) {
      updateOperations = {
        ...updateOperations,
        security_review_timestamp: knex.raw(
          'CASE WHEN security_review_timestamp IS NULL THEN NOW() ELSE security_review_timestamp END'
        )
      };
    } else if (patch.security_reviewed === false) {
      updateOperations = {
        ...updateOperations,
        security_review_timestamp: knex.raw(
          'CASE WHEN security_review_timestamp IS NOT NULL THEN NULL ELSE security_review_timestamp END'
        )
      };
    }

    if (patch.published === true) {
      updateOperations = {
        ...updateOperations,
        publish_timestamp: knex.raw('CASE WHEN publish_timestamp IS NULL THEN NOW() ELSE publish_timestamp END')
      };
    } else if (patch.published === false) {
      updateOperations = {
        ...updateOperations,
        publish_timestamp: knex.raw('CASE WHEN publish_timestamp IS NOT NULL THEN NULL ELSE publish_timestamp END')
      };
    }

    // Register all update operations
    queryBuilder.update(updateOperations);

    const response = await this.connection.knex(queryBuilder, SubmissionRecord);

    return response.rows[0];
  }

  /**
   * Get the root submission feature record for a submission.
   *
   * Note: A 'root' submission feature is indicated by parent_submission_feature_id being null.
   * Note: If more than one 'root' submission feature is found, returns the first one. Only one record is expected.
   *
   * @param {number} submissionId
   * @return {*}  {(Promise<SubmissionFeatureRecord>)}
   * @memberof SubmissionRepository
   */
  async getSubmissionRootFeature(submissionId: number): Promise<SubmissionFeatureRecord> {
    const sqlStatement = SQL`
      SELECT
        *
      FROM
        submission_feature
      WHERE
        submission_id = ${submissionId}
      and
        parent_submission_feature_id is null;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionFeatureRecord);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get root submission feature record', [
        'SubmissionRepository->getSubmissionRootFeature',
        `rowCount was ${response.rowCount}, expected rowCount === 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Download Submission with all associated Features
   *
   * @param {number} submissionId
   * @return {*}  {Promise<SubmissionFeatureDownloadRecord[]>}
   * @memberof SubmissionRepository
   */
  async downloadSubmission(submissionId: number): Promise<SubmissionFeatureDownloadRecord[]> {
    const sqlStatement = SQL`
    WITH RECURSIVE w_submission_feature AS (
      SELECT
        sf.submission_id,
        sf.submission_feature_id,
        sf.parent_submission_feature_id,
        ft.name as feature_type_name,
        sf.data,
        1 AS level
      FROM
        submission_feature sf
      INNER JOIN
        submission s
      ON
        sf.submission_id = s.submission_id
      INNER JOIN
        feature_type ft
      ON
        ft.feature_type_id = sf.feature_type_id
      WHERE
        parent_submission_feature_id IS null
      AND
        s.submission_id = ${submissionId}

      UNION ALL

      SELECT
        sf.submission_id,
        sf.submission_feature_id,
        sf.parent_submission_feature_id,
        ft.name as feature_type_name,
        sf.data,
        wsf.level + 1
      FROM
        submission_feature sf
      INNER JOIN
        w_submission_feature wsf
      ON
        sf.parent_submission_feature_id = wsf.submission_feature_id
      INNER JOIN
        feature_type ft
      ON
      ft.feature_type_id = sf.feature_type_id
      where
        sf.submission_id = ${submissionId}
    )
    SELECT
      w_submission_feature.submission_feature_id,
      w_submission_feature.parent_submission_feature_id,
      w_submission_feature.feature_type_name,
      w_submission_feature.data,
      w_submission_feature.level
    FROM
      w_submission_feature
    LEFT JOIN
     submission
    ON
      w_submission_feature.submission_id = submission.submission_id
    WHERE
      submission.submission_id = ${submissionId}
    ORDER BY
      level,
      submission_feature_id;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionFeatureDownloadRecord);

    if (response.rowCount === 0) {
      throw new ApiExecuteSQLError('Failed to get submission with associated features', [
        'SubmissionRepository->downloadSubmission',
        `rowCount was ${response.rowCount}, expected rowCount > 0`
      ]);
    }

    return response.rows;
  }

  /**
   * Download Published Submission with all associated Features
   *
   * @param {number} submissionId
   * @return {*}  {Promise<SubmissionFeatureDownloadRecord[]>}
   * @memberof SubmissionRepository
   */
  async downloadPublishedSubmission(submissionId: number): Promise<SubmissionFeatureDownloadRecord[]> {
    const sqlStatement = SQL`
    WITH RECURSIVE w_submission_feature AS (
      SELECT
        sf.submission_id,
        sf.submission_feature_id,
        sf.parent_submission_feature_id,
        ft.name as feature_type_name,
        sf.data,
        1 AS level
      FROM
        submission_feature sf
      INNER JOIN
        submission s
      ON
        sf.submission_id = s.submission_id
      INNER JOIN
        feature_type ft
      ON
        ft.feature_type_id = sf.feature_type_id
      LEFT JOIN
        submission_feature_security sfs
      ON
        sf.submission_feature_id = sfs.submission_feature_id
      WHERE
        parent_submission_feature_id IS null
      AND
        s.submission_id = ${submissionId}
      AND sfs.submission_feature_security_id IS NULL

      UNION ALL

      SELECT
        sf.submission_id,
        sf.submission_feature_id,
        sf.parent_submission_feature_id,
        ft.name as feature_type_name,
        sf.data,
        wsf.level + 1
      FROM
        submission_feature sf
      INNER JOIN
        w_submission_feature wsf
      ON
        sf.parent_submission_feature_id = wsf.submission_feature_id
      INNER JOIN
        feature_type ft
      ON
      ft.feature_type_id = sf.feature_type_id
      LEFT JOIN
        submission_feature_security sfs
      ON
        sf.submission_feature_id = sfs.submission_feature_id
      WHERE
        sf.submission_id = ${submissionId}
      AND sfs.submission_feature_security_id IS NULL
    )
    SELECT
      w_submission_feature.submission_feature_id,
      w_submission_feature.parent_submission_feature_id,
      w_submission_feature.feature_type_name,
      w_submission_feature.data,
      w_submission_feature.level
    FROM
      w_submission_feature
    LEFT JOIN
     submission
    ON
      w_submission_feature.submission_id = submission.submission_id
    WHERE
      submission.submission_id = ${submissionId}
    ORDER BY
      level,
      submission_feature_id;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionFeatureDownloadRecord);

    if (response.rowCount === 0) {
      throw new ApiExecuteSQLError('Failed to get submission with associated features', [
        'SubmissionRepository->downloadSubmission',
        `rowCount was ${response.rowCount}, expected rowCount > 0`
      ]);
    }

    return response.rows;
  }
}
