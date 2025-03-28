import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import { getKnex, getKnexQueryBuilder } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { BaseRepository } from './base-repository';
import { SECURITY_APPLIED_STATUS } from './security-repository';

export interface ISubmissionFeature {
  id: string | null;
  type: string;
  properties: Record<string, unknown>;
  child_features: ISubmissionFeature[];
}

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
  source_id: z.string().nullable(),
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
  sort: z.number().nullable(),
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
  security_review_timestamp: z.string().nullable(),
  submitted_timestamp: z.string(),
  system_user_id: z.number(),
  source_system: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  comment: z.string().nullable(),
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
  root_feature_type_name: z.string(),
  regions: z.array(z.string())
});

export type SubmissionRecordWithSecurityAndRootFeatureType = z.infer<
  typeof SubmissionRecordWithSecurityAndRootFeatureType
>;

export const SubmissionRecordPublishedForPublic = SubmissionRecord.extend({
  security: z.nativeEnum(SECURITY_APPLIED_STATUS),
  root_feature_type_id: z.number(),
  root_feature_type_name: z.string(),
  root_feature_type_display_name: z.string()
}).omit({
  comment: true // Should not be included in public (non-admin) response
});

export type SubmissionRecordPublishedForPublic = z.infer<typeof SubmissionRecordPublishedForPublic>;

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

export type SubmissionFeatureSignedUrlPayload = {
  submissionFeatureId: number;
  submissionFeatureObj: { key: string; value: string };
  isAdmin: boolean;
};

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
   * @param {string} uuid
   * @param {string} name
   * @param {string} description A description of the submission. Should not contain any sensitive information.
   * @param {string} comment An internal comment/description of the submission for administrative purposes. May contain
   * sensitive information. Should never be shared with the general public.
   * @param {string} userIdentifier
   * @return {*}  {Promise<SubmissionRecord>}
   * @memberof SubmissionRepository
   */
  async insertSubmissionRecordWithPotentialConflict(
    uuid: string,
    name: string,
    description: string,
    comment: string,
    systemUserId: number,
    systemUserIdentifier: string
  ): Promise<SubmissionRecord> {
    const sqlStatement = SQL`
      INSERT INTO submission (
        uuid,
        submitted_timestamp,
        name,
        description,
        comment,
        system_user_id,
        source_system
      ) VALUES (
        ${uuid},
        now(),
        ${name},
        ${description},
        ${comment},
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
   * @param {number} submissionId The ID of the submission.
   * @param {(number | null)} parentSubmissionFeatureId The ID of the parent submission feature, or null.
   * @param {(string | null)} featureSourceId The source ID of the feature, or null.
   * @param {string} featureTypeName The name of the feature type.
   * @param {ISubmissionFeature['properties']} featureProperties The properties of the submission feature.
   * @return {*}  {Promise<{ submission_feature_id: number }>} Returns a promise that resolves to an object with the submission feature ID.
   * @memberof SubmissionRepository
   */
  async insertSubmissionFeatureRecord(
    submissionId: number,
    parentSubmissionFeatureId: number | null,
    featureSourceId: string | null,
    featureTypeName: string,
    featureProperties: ISubmissionFeature['properties']
  ): Promise<{ submission_feature_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission_feature (
        submission_id,
        parent_submission_feature_id,
        source_id,
        feature_type_id,
        data,
        record_effective_date
      ) VALUES (
        ${submissionId},
        ${parentSubmissionFeatureId},
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
    if (response.rowCount !== 0) {
      return response.rows[0];
    } else {
      return null;
    }
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
   * Get all submissions that have not completed security review.
   *
   * Note: Will only return the most recent unreviewed submission for each uuid, unless the most recent submission is
   * already reviewed.
   *
   * @return {*}  {Promise<SubmissionRecordWithSecurityAndRootFeatureType[]>}
   * @memberof SubmissionRepository
   */
  async getUnreviewedSubmissionsForAdmins(): Promise<SubmissionRecordWithSecurityAndRootFeatureType[]> {
    const sqlStatement = SQL`
      WITH RankedRows AS (
        SELECT
          t1.*,
          ROW_NUMBER() OVER (PARTITION BY t1.uuid ORDER BY t1.submitted_timestamp DESC) AS rank
        FROM submission t1
      ),
      FilteredRows AS (
        SELECT
          t2.*
        FROM 
          RankedRows t2
        WHERE
          t2.security_review_timestamp IS NULL
        AND 
          t2.rank = 1
      )
      SELECT
        FilteredRows.submission_id,
        FilteredRows.uuid,
        FilteredRows.system_user_id,
        FilteredRows.source_system,
        FilteredRows.security_review_timestamp,
        FilteredRows.publish_timestamp,
        FilteredRows.submitted_timestamp,
        FilteredRows.name,
        FilteredRows.description,
        FilteredRows.comment,
        FilteredRows.record_end_date,
        FilteredRows.create_date,
        FilteredRows.create_user,
        FilteredRows.update_date,
        FilteredRows.update_user,
        FilteredRows.revision_count,
        submission_feature.feature_type_id AS root_feature_type_id,
        feature_type.name AS root_feature_type_name,
        ${SECURITY_APPLIED_STATUS.PENDING} AS security,
        ARRAY_REMOVE(ARRAY_AGG(region_lookup.region_name), NULL) AS regions
      FROM
        FilteredRows
      INNER JOIN
        submission_feature
      ON
        FilteredRows.submission_id = submission_feature.submission_id
      INNER JOIN
        feature_type
      ON
        feature_type.feature_type_id = submission_feature.feature_type_id
      LEFT JOIN
        submission_feature_security
      ON
        submission_feature.submission_feature_id = submission_feature_security.submission_feature_id
      LEFT JOIN 
        submission_regions
      ON
        submission_regions.submission_id = FilteredRows.submission_id 
      LEFT JOIN
        region_lookup 
      ON 
        region_lookup.region_id = submission_regions.region_id
      WHERE
        submission_feature.parent_submission_feature_id IS NULL
      group by 
        FilteredRows.submission_id,
        FilteredRows.uuid,
        FilteredRows.system_user_id,
        FilteredRows.source_system,
        FilteredRows.security_review_timestamp,
        FilteredRows.publish_timestamp,
        FilteredRows.submitted_timestamp,
        FilteredRows.name,
        FilteredRows.description,
        FilteredRows.comment,
        FilteredRows.record_end_date,
        FilteredRows.create_date,
        FilteredRows.create_user,
        FilteredRows.update_date,
        FilteredRows.update_user,
        FilteredRows.revision_count,
        submission_feature.feature_type_id,
        feature_type.name;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionRecordWithSecurityAndRootFeatureType);

    return response.rows;
  }

  /**
   * Get all submissions that have completed security review but are not published.
   *
   * Note: Will only return the most recent reviewed submission for each uuid, unless the most recent submission is
   * already published.
   *
   * @return {*}  {Promise<SubmissionRecordWithSecurityAndRootFeatureType[]>}
   * @memberof SubmissionRepository
   */
  async getReviewedSubmissionsForAdmins(): Promise<SubmissionRecordWithSecurityAndRootFeatureType[]> {
    const sqlStatement = SQL`
      WITH RankedRows AS (
        SELECT
          t1.*,
          ROW_NUMBER() OVER (PARTITION BY t1.uuid ORDER BY t1.submitted_timestamp DESC) AS rank
        FROM 
          submission t1
        WHERE
          t1.security_review_timestamp IS NOT NULL
        OR
          t1.publish_timestamp IS NOT NULL
      ),
      FilteredRows AS (
        SELECT
          t2.*
        FROM 
          RankedRows t2
        WHERE
          t2.security_review_timestamp IS NOT NULL
        AND
          t2.publish_timestamp IS NULL
        AND 
          t2.rank = 1
      )
      SELECT
        FilteredRows.submission_id,
        FilteredRows.uuid,
        FilteredRows.system_user_id,
        FilteredRows.source_system,
        FilteredRows.security_review_timestamp,
        FilteredRows.publish_timestamp,
        FilteredRows.submitted_timestamp,
        FilteredRows.name,
        FilteredRows.description,
        FilteredRows.comment,
        FilteredRows.record_end_date,
        FilteredRows.create_date,
        FilteredRows.create_user,
        FilteredRows.update_date,
        FilteredRows.update_user,
        FilteredRows.revision_count,
        submission_feature.feature_type_id AS root_feature_type_id,
        feature_type.name AS root_feature_type_name,
        CASE
          WHEN FilteredRows.security_review_timestamp is null THEN ${SECURITY_APPLIED_STATUS.PENDING}
          WHEN COUNT(submission_feature_security.submission_feature_security_id) = 0 THEN ${SECURITY_APPLIED_STATUS.UNSECURED}
          WHEN COUNT(submission_feature_security.submission_feature_security_id) = COUNT(submission_feature.submission_feature_id) THEN ${SECURITY_APPLIED_STATUS.SECURED}
          ELSE ${SECURITY_APPLIED_STATUS.PARTIALLY_SECURED}
        END AS security,
        ARRAY_REMOVE(ARRAY_AGG(region_lookup.region_name), NULL) AS regions
      FROM
        FilteredRows
      INNER JOIN
        submission_feature
      ON
        FilteredRows.submission_id = submission_feature.submission_id
      INNER JOIN
        feature_type
      ON
        feature_type.feature_type_id = submission_feature.feature_type_id
      LEFT JOIN
        submission_feature_security
      ON
        submission_feature.submission_feature_id = submission_feature_security.submission_feature_id
      LEFT JOIN 
        submission_regions
      ON
        submission_regions.submission_id = FilteredRows.submission_id 
      LEFT JOIN
        region_lookup 
      ON 
        region_lookup.region_id = submission_regions.region_id
      WHERE
        submission_feature.parent_submission_feature_id IS NULL
      group by 
        FilteredRows.submission_id,
        FilteredRows.uuid,
        FilteredRows.system_user_id,
        FilteredRows.source_system,
        FilteredRows.security_review_timestamp,
        FilteredRows.publish_timestamp,
        FilteredRows.submitted_timestamp,
        FilteredRows.name,
        FilteredRows.description,
        FilteredRows.comment,
        FilteredRows.record_end_date,
        FilteredRows.create_date,
        FilteredRows.create_user,
        FilteredRows.update_date,
        FilteredRows.update_user,
        FilteredRows.revision_count,
        submission_feature.feature_type_id,
        feature_type.name;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionRecordWithSecurityAndRootFeatureType);

    return response.rows;
  }

  /**
   * Get all submissions that have completed security review and are published.
   *
   * @return {*}  {Promise<SubmissionRecordWithSecurityAndRootFeatureType[]>}
   * @memberof SubmissionRepository
   */
  async getPublishedSubmissionsForAdmins(): Promise<SubmissionRecordWithSecurityAndRootFeatureType[]> {
    const sqlStatement = SQL`
      SELECT
        submission.*,
        submission_feature.feature_type_id AS root_feature_type_id,
        feature_type.name AS root_feature_type_name,
        CASE
          WHEN submission.security_review_timestamp IS NULL THEN ${SECURITY_APPLIED_STATUS.PENDING}
          WHEN COUNT(submission_feature_security.submission_feature_security_id) = 0 THEN ${SECURITY_APPLIED_STATUS.UNSECURED}
          WHEN COUNT(submission_feature_security.submission_feature_security_id) = COUNT(submission_feature.submission_feature_id) THEN ${SECURITY_APPLIED_STATUS.SECURED}
          ELSE ${SECURITY_APPLIED_STATUS.PARTIALLY_SECURED}
        END AS security,
        ARRAY_REMOVE(ARRAY_AGG(region_lookup.region_name), NULL) AS regions
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
      LEFT JOIN 
        submission_regions
      ON
        submission_regions.submission_id = submission.submission_id 
      LEFT JOIN
        region_lookup 
      ON 
        region_lookup.region_id = submission_regions.region_id
      WHERE
        submission.publish_timestamp IS NOT NULL
      AND
        submission_feature.parent_submission_feature_id IS NULL
      group by 
        submission.submission_id,
        submission_feature.feature_type_id,
        feature_type.name;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionRecordWithSecurityAndRootFeatureType);

    return response.rows;
  }

  /**
   * Get all submission features by submission id.
   *
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
   *   }} [criteria]
   * @return {*}  {Promise<SubmissionFeatureRecord[]>}
   * @memberof SubmissionRepository
   */
  async findSubmissionFeatures(criteria?: {
    submissionId?: number;
    systemUserId?: number;
    featureTypeNames?: string[];
  }): Promise<SubmissionFeatureRecord[]> {
    const knex = getKnex();

    const queryBuilder = knex.queryBuilder();

    queryBuilder.select().from('submission_feature').where('record_end_date', null);

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
   * Note: Will only return the most recent published submission for each uuid.
   *
   * @return {*}  {Promise<SubmissionRecordPublishedForPublic[]>}
   * @memberof SubmissionRepository
   */
  async getPublishedSubmissions(): Promise<SubmissionRecordPublishedForPublic[]> {
    const sqlStatement = SQL`
      WITH RankedRows AS (
        SELECT
          t1.*,
          ROW_NUMBER() OVER (PARTITION BY t1.uuid ORDER BY t1.publish_timestamp DESC) AS rank
        FROM 
          submission t1
        WHERE
          t1.security_review_timestamp IS NOT NULL
        AND
          t1.publish_timestamp IS NOT NULL
      ),
      FilteredRows as (
        SELECT
          t2.*
        FROM 
          RankedRows t2
        WHERE
          t2.rank = 1
      )
      SELECT
        FilteredRows.submission_id,
        FilteredRows.uuid,
        FilteredRows.system_user_id,
        FilteredRows.source_system,
        FilteredRows.security_review_timestamp,
        FilteredRows.publish_timestamp,
        FilteredRows.submitted_timestamp,
        FilteredRows.name,
        FilteredRows.description,
        FilteredRows.record_end_date,
        FilteredRows.create_date,
        FilteredRows.create_user,
        FilteredRows.update_date,
        FilteredRows.update_user,
        FilteredRows.revision_count,
        feature_type.feature_type_id as root_feature_type_id,
        feature_type.name as root_feature_type_name,
        feature_type.display_name as root_feature_type_display_name,
        CASE
          WHEN COUNT(submission_feature_security.submission_feature_security_id) = 0 THEN ${SECURITY_APPLIED_STATUS.UNSECURED}
          WHEN COUNT(submission_feature_security.submission_feature_security_id) = COUNT(submission_feature.submission_feature_id) THEN ${SECURITY_APPLIED_STATUS.SECURED}
	      ELSE ${SECURITY_APPLIED_STATUS.PARTIALLY_SECURED}
        END as security
      FROM
        FilteredRows
      INNER JOIN
        submission_feature
      ON
        submission_feature.submission_id = FilteredRows.submission_id
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
        FilteredRows.security_review_timestamp IS NOT NULL
      AND
        FilteredRows.publish_timestamp IS NOT NULL
      GROUP BY
        FilteredRows.submission_id,
        FilteredRows.uuid,
        FilteredRows.system_user_id,
        FilteredRows.source_system,
        FilteredRows.security_review_timestamp,
        FilteredRows.publish_timestamp,
        FilteredRows.submitted_timestamp,
        FilteredRows.name,
        FilteredRows.description,
        FilteredRows.record_end_date,
        FilteredRows.create_date,
        FilteredRows.create_user,
        FilteredRows.update_date,
        FilteredRows.update_user,
        FilteredRows.revision_count,
        feature_type.feature_type_id,
        feature_type.name,
        feature_type.display_name
      ORDER BY
        FilteredRows.publish_timestamp ASC;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionRecordPublishedForPublic);

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

      // Publishing this submission, first unpublish all submissions with the same uuid as the target submission.
      // Why? Because we only want one published submission per uuid.
      await this.unpublishAllSubmissionsBySubmissionId(submissionId);
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
   * Unpublish all submissions with the same uuid as the submission with the provided id.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<void>}
   * @memberof SubmissionRepository
   */
  async unpublishAllSubmissionsBySubmissionId(submissionId: number): Promise<void> {
    const sqlStatement = SQL`
      UPDATE 
        submission
      SET
        publish_timestamp = null
      WHERE
        uuid = (SELECT uuid FROM submission WHERE submission_id = ${submissionId});
    `;

    await this.connection.sql(sqlStatement);

    return;
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

  /**
   * Retrieves submission feature (artifact) key from data column key value pair.
   * Checks submission feature is not secure.
   *
   * @async
   * @param {SubmissionFeatureSignedUrlPayload} payload
   * @throws {ApiExecuteSQLError}
   * @memberof SubmissionRepository
   * @returns {Promise<string>} - submission feature (artifact) key
   */
  async getSubmissionFeatureArtifactKey(payload: SubmissionFeatureSignedUrlPayload): Promise<string> {
    const sqlStatement = SQL`
    SELECT ss.value
    FROM search_string ss
    INNER JOIN feature_property fp
    ON ss.feature_property_id = fp.feature_property_id
    WHERE ss.submission_feature_id = ${payload.submissionFeatureId}
    AND NOT EXISTS (
      SELECT NULL
      FROM submission_feature_security sfs
      WHERE sfs.submission_feature_id = ss.submission_feature_id
    )
    AND ss.value = ${payload.submissionFeatureObj.value}
    AND fp.name = ${payload.submissionFeatureObj.key}
    RETURNING ss.value;`;

    const response = await this.connection.sql(sqlStatement, z.object({ value: z.string() }));

    if (response.rowCount === 0 || !response.rows[0]?.value) {
      throw new ApiExecuteSQLError('Failed to get key for signed URL', [
        `submissionFeature is secure or matching key value pair does not exist for submissionFeatureId: ${payload.submissionFeatureId}`,
        'SubmissionRepository->getSubmissionFeatureArtifactKey'
      ]);
    }

    return response.rows[0].value;
  }

  /**
   * Retrieves submission feature (artifact) key from data column key value pair. Skips security checks.
   *
   * @async
   * @param {SubmissionFeatureSignedUrlPayload} payload
   * @throws {ApiExecuteSQLError}
   * @memberof SubmissionRepository
   * @returns {Promise<string>} - submission feature (artifact) key
   */
  async getAdminSubmissionFeatureArtifactKey(payload: SubmissionFeatureSignedUrlPayload): Promise<string> {
    const sqlStatement = SQL`
    SELECT ss.value
    FROM search_string ss
    INNER JOIN feature_property fp
    ON ss.feature_property_id = fp.feature_property_id
    WHERE ss.submission_feature_id = ${payload.submissionFeatureId}
    AND ss.value = ${payload.submissionFeatureObj.value}
    AND fp.name = ${payload.submissionFeatureObj.key};`;

    const response = await this.connection.sql(sqlStatement, z.object({ value: z.string() }));

    if (response.rowCount === 0 || !response.rows[0]?.value) {
      throw new ApiExecuteSQLError('Failed to get key for signed URL', [
        `matching key value pair does not exist for submissionFeatureId: ${payload.submissionFeatureId}`,
        'SubmissionRepository->getAdminSubmissionFeatureArtifactKey'
      ]);
    }

    return response.rows[0].value;
  }
}
