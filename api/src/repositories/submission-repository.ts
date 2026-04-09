import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import { getKnex, getKnexQueryBuilder } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { SubmissionFeatureForReview, SubmissionFilters } from '../models/submission';
import { SubmissionFeatureFilters } from '../models/submission-feature';
import { ApiPaginationOptions } from '../zod-schema/pagination';
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
  uuid: string;
  create_date?: string;
  create_user?: string;
  update_date?: string;
  update_user?: string;
  revision_count?: string;
}

export interface ICreateSubmission {
  uuid: string;
  system_user_id: number;
  contributor_id: number;
  name: string;
  description: string;
  comment: string;
}

export const SubmissionFeatureRecord = z.object({
  submission_feature_id: z.number(),
  uuid: z.string(),
  urn: z.string(),
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

export const SubmissionFeature = z.object({
  submission_feature_id: z.number(),
  uuid: z.string(),
  urn: z.string(),
  submission_id: z.number(),
  feature_type_id: z.number(),
  source_id: z.string().nullable(),
  data: z.record(z.any()),
  feature_type_name: z.string(),
  feature_type_display_name: z.string(),
  submission_name: z.string(),
  secured: z.boolean()
});

export type SubmissionFeature = z.infer<typeof SubmissionFeature>;

export const RelatedSubmissionFeature = z.object({
  submission_feature_id: z.number(),
  feature_type_name: z.string(),
  feature_type_display_name: z.string(),
  data: z.record(z.any())
});

export type RelatedSubmissionFeature = z.infer<typeof RelatedSubmissionFeature>;

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
  system_user_id: number;
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
  contributor_id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  comment: z.string().nullable(),
  publish_timestamp: z.string().nullable(),
  record_end_date: z.string().nullable(),
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

export const SubmissionRecordWithSecurityAndRootFeatureType = SubmissionRecord.pick({
  submission_id: true,
  uuid: true,
  submitted_timestamp: true,
  system_user_id: true,
  contributor_id: true,
  name: true,
  description: true,
  comment: true,
  publish_timestamp: true,
  create_user: true,
  update_user: true
}).extend({
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
   * @param {ICreateSubmission} submissionData
   * @returns {Promise<{ submission_id: number }>}
   * @memberof SubmissionRepository
   */
  async insertSubmissionRecord(submissionData: ICreateSubmission): Promise<{ submission_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission (
        uuid,
        system_user_id,
        contributor_id,
        name,
        description,
        comment
      ) VALUES (
        ${submissionData.uuid},
        ${submissionData.system_user_id},
        ${submissionData.contributor_id},
        ${submissionData.name},
        ${submissionData.description},
        ${submissionData.comment}
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
   * @param {number} contributorId
   * @returns {Promise<SubmissionRecord>}
   * @memberof SubmissionRepository
   */
  async insertSubmissionRecordWithPotentialConflict(
    uuid: string,
    name: string,
    description: string,
    comment: string,
    systemUserId: number,
    contributorId: number
  ): Promise<SubmissionRecord> {
    const sqlStatement = SQL`
      INSERT INTO submission (
        uuid,
        submitted_timestamp,
        name,
        description,
        comment,
        system_user_id,
        contributor_id
      ) VALUES (
        ${uuid},
        now(),
        ${name},
        ${description},
        ${comment},
        ${systemUserId},
        ${contributorId}
      )
      RETURNING
        submission_id,
        uuid,
        security_review_timestamp,
        submitted_timestamp,
        system_user_id,
        contributor_id,
        name,
        description,
        comment,
        publish_timestamp,
        record_end_date,
        create_date,
        create_user,
        update_date,
        update_user,
        revision_count;
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
   * Features belong to a submission (submission_id) but are produced by a specific
   * upload event (submission_upload_id). This distinction enables multi-upload-per-submission
   * (append, replace).
   *
   * @param {number} submissionId The ID of the submission.
   * @param {string} submissionUploadId The submission_upload_id that produced these features.
   * @param {(number | null)} parentSubmissionFeatureId The ID of the parent submission feature, or null.
   * @param {(string | null)} featureSourceId The source ID of the feature, or null.
   * @param {string} featureTypeName The name of the feature type.
   * @param {ISubmissionFeature['properties']} featureProperties The properties of the submission feature.
   * @returns {Promise<{ submission_feature_id: number }>} Returns a promise that resolves to an object with the submission feature ID.
   * @memberof SubmissionRepository
   */
  async insertSubmissionFeatureRecord(
    submissionId: number,
    submissionUploadId: string,
    parentSubmissionFeatureId: number | null,
    featureSourceId: string | null,
    featureTypeName: string,
    featureProperties: ISubmissionFeature['properties']
  ): Promise<{ submission_feature_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission_feature (
        submission_id,
        submission_upload_id,
        parent_submission_feature_id,
        source_id,
        feature_type_id,
        data,
        record_effective_date
      ) VALUES (
        ${submissionId},
        ${submissionUploadId},
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
   * Update the parent reference for a submission feature.
   *
   * @param {number} submissionFeatureId The ID of the feature to update.
   * @param {number} parentSubmissionFeatureId The ID of the parent feature.
   * @returns {Promise<void>}
   * @memberof SubmissionRepository
   */
  async updateSubmissionFeatureParent(submissionFeatureId: number, parentSubmissionFeatureId: number): Promise<void> {
    const sqlStatement = SQL`
      UPDATE submission_feature
      SET parent_submission_feature_id = ${parentSubmissionFeatureId}
      WHERE submission_feature_id = ${submissionFeatureId};
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Bulk update parent references for features belonging to a submission upload.
   *
   * @param {string} submissionUploadId The submission_upload_id scope.
   * @param {{ submission_feature_id: number; parent_submission_feature_id: number }[]} pairs The child-parent pairs.
   * @returns {Promise<void>}
   * @memberof SubmissionRepository
   */
  async updateSubmissionFeatureParents(
    submissionUploadId: string,
    pairs: { submission_feature_id: number; parent_submission_feature_id: number }[]
  ): Promise<void> {
    if (!pairs.length) {
      return;
    }

    const submissionFeatureIds = pairs.map((pair) => pair.submission_feature_id);
    const parentSubmissionFeatureIds = pairs.map((pair) => pair.parent_submission_feature_id);

    const sqlStatement = SQL`
      UPDATE submission_feature AS sf
      SET parent_submission_feature_id = mappings.parent_submission_feature_id
      FROM unnest(
        ${submissionFeatureIds}::integer[],
        ${parentSubmissionFeatureIds}::integer[]
      ) AS mappings(submission_feature_id, parent_submission_feature_id)
      WHERE sf.submission_feature_id = mappings.submission_feature_id
        AND sf.submission_upload_id = ${submissionUploadId};
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Delete all submission features for a submission (soft delete).
   * Used for idempotency - allows job retries to start fresh.
   *
   * @param {number} submissionId The submission ID.
   * @returns {Promise<void>}
   * @memberof SubmissionRepository
   */
  async deleteSubmissionFeatures(submissionId: number): Promise<void> {
    const sqlStatement = SQL`
      UPDATE submission_feature
      SET record_end_date = NOW()
      WHERE submission_id = ${submissionId}
        AND record_end_date IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Delete all submission feature relationships for features belonging to a submission.
   * Used for idempotency - allows job retries to start fresh.
   *
   * @param {number} submissionId The submission ID.
   * @returns {Promise<void>}
   * @memberof SubmissionRepository
   */
  async deleteSubmissionFeatureRelationships(submissionId: number): Promise<void> {
    const sqlStatement = SQL`
      DELETE FROM submission_feature_feature
      WHERE source_feature_id IN (
        SELECT submission_feature_id FROM submission_feature WHERE submission_id = ${submissionId}
      )
      OR target_feature_id IN (
        SELECT submission_feature_id FROM submission_feature WHERE submission_id = ${submissionId}
      );
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Insert submission feature relationships (source-target from content array).
   * Uses ON CONFLICT DO NOTHING to avoid failures on duplicate pairs.
   *
   * @param {Array<{ source_feature_id: number; target_feature_id: number }>} pairs The pairs to insert.
   * @returns {Promise<void>}
   * @memberof SubmissionRepository
   */
  async insertSubmissionFeatureRelationships(
    pairs: Array<{ source_feature_id: number; target_feature_id: number }>
  ): Promise<void> {
    if (pairs.length === 0) {
      return;
    }

    const sourceIds = pairs.map((p) => p.source_feature_id);
    const targetIds = pairs.map((p) => p.target_feature_id);

    const sqlStatement = SQL`
      INSERT INTO submission_feature_feature (source_feature_id, target_feature_id)
      SELECT source_id, target_id FROM unnest(
        ${sourceIds}::integer[],
        ${targetIds}::integer[]
      ) AS t(source_id, target_id)
      ON CONFLICT (source_feature_id, target_feature_id) DO NOTHING;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Get feature type id by name.
   *
   * @param {string} name
   * @returns {Promise<{ feature_type_id: number }>}
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
   * @returns {Promise<ISubmissionModel>}
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
   * @param {string} uuid - The submission UUID.
   * @returns {Promise<{ submission_id: number }>} The submission_id for the given UUID.
   * @throws {ApiNotFoundError} If no submission exists for the given UUID.
   * @memberof SubmissionRepository
   */
  async getSubmissionIdByUUID(uuid: string): Promise<{ submission_id: number }> {
    const sqlStatement = SQL`
      SELECT
        submission_id
      FROM
        submission
      WHERE
        uuid = ${uuid};
    `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);
    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Submission not found', ['SubmissionRepository->getSubmissionIdByUUID', { uuid }]);
    }
    return response.rows[0];
  }

  /**
   * Get spatial component counts by dataset id
   *
   * @param {string} datasetId
   * @returns {Promise<ISpatialComponentCount[]>}
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
   * @returns {Promise<ISourceTransformModel>}
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
   * @returns {Promise<ISourceTransformModel>}
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
   * @returns {Promise<{ submission_status_id: number; submission_status_type_id: number }>}
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
   * @returns {Promise<{ submission_message_id: number; submission_message_type_id: number }>}
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
   * Get all submissions that have not completed security review.
   *
   * Note: Will only return the most recent unreviewed submission for each uuid, unless the most recent submission is
   * already reviewed.
   *
   * @returns {Promise<SubmissionRecordWithSecurityAndRootFeatureType[]>}
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
        FilteredRows.contributor_id,
        FilteredRows.publish_timestamp,
        FilteredRows.submitted_timestamp,
        FilteredRows.name,
        FilteredRows.description,
        FilteredRows.comment,
        FilteredRows.create_user,
        FilteredRows.update_user,
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
        FilteredRows.contributor_id,
        FilteredRows.publish_timestamp,
        FilteredRows.submitted_timestamp,
        FilteredRows.name,
        FilteredRows.description,
        FilteredRows.comment,
        FilteredRows.create_user,
        FilteredRows.update_user,
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
   * @returns {Promise<SubmissionRecordWithSecurityAndRootFeatureType[]>}
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
        FilteredRows.contributor_id,
        FilteredRows.publish_timestamp,
        FilteredRows.submitted_timestamp,
        FilteredRows.name,
        FilteredRows.description,
        FilteredRows.comment,
        FilteredRows.create_user,
        FilteredRows.update_user,
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
        FilteredRows.contributor_id,
        FilteredRows.security_review_timestamp,
        FilteredRows.publish_timestamp,
        FilteredRows.submitted_timestamp,
        FilteredRows.name,
        FilteredRows.description,
        FilteredRows.comment,
        FilteredRows.create_user,
        FilteredRows.update_user,
        submission_feature.feature_type_id,
        feature_type.name;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionRecordWithSecurityAndRootFeatureType);

    return response.rows;
  }

  /**
   * Get all submissions that have completed security review and are published.
   *
   * @returns {Promise<SubmissionRecordWithSecurityAndRootFeatureType[]>}
   * @memberof SubmissionRepository
   */
  async getPublishedSubmissionsForAdmins(): Promise<SubmissionRecordWithSecurityAndRootFeatureType[]> {
    const sqlStatement = SQL`
      SELECT
        submission.submission_id,
        submission.uuid,
        submission.system_user_id,
        submission.contributor_id,
        submission.publish_timestamp,
        submission.submitted_timestamp,
        submission.name,
        submission.description,
        submission.comment,
        submission.create_user,
        submission.update_user,
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
   * @returns {Promise<SubmissionFeatureRecordWithTypeAndSecurity[]>}
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
   * Get all submissions accessible to the given system user via their submission team membership.
   *
   * @param {number} systemUserId - The system user ID to fetch submissions for.
   * @param {ApiPaginationOptions} pagination
   * @param {SubmissionFilters} [filters]
   * @returns {Promise<SubmissionRecordWithSecurityAndRootFeatureType[]>}
   * @memberof SubmissionRepository
   */
  async getSubmissionsByUserId(
    systemUserId: number,
    pagination: ApiPaginationOptions,
    filters?: SubmissionFilters
  ): Promise<SubmissionRecordWithSecurityAndRootFeatureType[]> {
    const knex = getKnex();
    const sort = pagination.sort;
    const order = pagination.order;

    const sortColumnMap: Record<string, string> = {
      submission_id: 's.submission_id',
      name: 's.name',
      submitted_timestamp: 's.submitted_timestamp',
      security: 'security'
    };

    const requestedSort = sort ? sortColumnMap[sort] : undefined;
    const resolvedSort = requestedSort ?? 's.submitted_timestamp';
    const resolvedOrder = order === 'asc' ? 'asc' : 'desc';
    const normalizedSearch = filters?.search?.trim().toLowerCase();

    const queryBuilder = knex('team_member as tm')
      .innerJoin('submission_team as st', function () {
        this.on('st.team_id', '=', 'tm.team_id').andOnNull('st.record_end_date');
      })
      .innerJoin('submission as s', function () {
        this.on('s.submission_id', '=', 'st.submission_id').andOnNull('s.record_end_date');
      })
      .innerJoin('submission_feature as sf', function () {
        this.on('sf.submission_id', '=', 's.submission_id').andOnNull('sf.parent_submission_feature_id');
      })
      .innerJoin('feature_type as ft', 'ft.feature_type_id', 'sf.feature_type_id')
      .leftJoin('submission_feature_security as sfs', 'sfs.submission_feature_id', 'sf.submission_feature_id')
      .leftJoin('submission_regions as sr', 'sr.submission_id', 's.submission_id')
      .leftJoin('region_lookup as rl', 'rl.region_id', 'sr.region_id')
      .where('tm.system_user_id', systemUserId)
      .whereNull('tm.record_end_date')
      .select([
        's.submission_id',
        's.uuid',
        's.system_user_id',
        's.contributor_id',
        's.publish_timestamp',
        's.submitted_timestamp',
        's.name',
        's.description',
        's.comment',
        's.create_user',
        's.update_user',
        knex.raw('sf.feature_type_id AS root_feature_type_id'),
        knex.raw('ft.name AS root_feature_type_name'),
        knex.raw(
          `
          CASE
            WHEN s.security_review_timestamp IS NULL THEN ?
            WHEN COUNT(sfs.submission_feature_security_id) = 0 THEN ?
            WHEN COUNT(sfs.submission_feature_security_id) = COUNT(sf.submission_feature_id) THEN ?
            ELSE ?
          END AS security
          `,
          [
            SECURITY_APPLIED_STATUS.PENDING,
            SECURITY_APPLIED_STATUS.UNSECURED,
            SECURITY_APPLIED_STATUS.SECURED,
            SECURITY_APPLIED_STATUS.PARTIALLY_SECURED
          ]
        ),
        knex.raw(`COALESCE(ARRAY_REMOVE(ARRAY_AGG(DISTINCT rl.region_name), NULL), '{}') AS regions`)
      ])
      .groupBy([
        's.submission_id',
        's.uuid',
        's.system_user_id',
        's.contributor_id',
        's.security_review_timestamp',
        's.publish_timestamp',
        's.submitted_timestamp',
        's.name',
        's.description',
        's.comment',
        's.create_user',
        's.update_user',
        'sf.feature_type_id',
        'ft.name'
      ]);

    if (normalizedSearch) {
      queryBuilder.andWhereRaw('LOWER(s.name) LIKE ?', [`%${normalizedSearch}%`]);
    }

    this.applyPagination(queryBuilder, {
      ...pagination,
      sort: resolvedSort,
      order: resolvedOrder
    });

    const response = await this.connection.knex(queryBuilder, SubmissionRecordWithSecurityAndRootFeatureType);

    return response.rows;
  }

  /**
   * Count submissions accessible to the given system user with optional server-side search.
   *
   * @param {number} systemUserId
   * @param {SubmissionFilters} [filters]
   * @returns {Promise<number>}
   * @memberof SubmissionRepository
   */
  async getSubmissionsByUserIdCount(systemUserId: number, filters?: SubmissionFilters): Promise<number> {
    const normalizedSearch = filters?.search?.trim().toLowerCase();

    const sqlStatement = SQL`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT
          s.submission_id
        FROM team_member tm
        INNER JOIN submission_team st
          ON  st.team_id = tm.team_id
          AND st.record_end_date IS NULL
        INNER JOIN submission s
          ON  s.submission_id = st.submission_id
          AND s.record_end_date IS NULL
        WHERE
          tm.system_user_id = ${systemUserId}
          AND tm.record_end_date IS NULL
    `;

    if (normalizedSearch) {
      const searchPattern = `%${normalizedSearch}%`;
      sqlStatement.append(SQL` AND LOWER(s.name) LIKE ${searchPattern}`);
    }

    sqlStatement.append(SQL`
        GROUP BY s.submission_id
      ) AS counted_submissions;
    `);

    const response = await this.connection.sql(sqlStatement, z.object({ count: z.number() }));

    if (!response.rowCount) {
      return 0;
    }

    return response.rows[0].count;
  }

  /**
   * Get a submission record by id (with security status).
   *
   * @param {number} submissionId
   * @returns {Promise<SubmissionRecordWithSecurity>}
   * @memberof SubmissionRepository
   */
  async getSubmissionRecordBySubmissionIdWithSecurity(submissionId: number): Promise<SubmissionRecordWithSecurity> {
    const sqlStatement = SQL`
      SELECT
        submission.submission_id,
        submission.uuid,
        submission.security_review_timestamp,
        submission.submitted_timestamp,
        submission.system_user_id,
        submission.contributor_id,
        submission.name,
        submission.description,
        submission.comment,
        submission.publish_timestamp,
        submission.record_end_date,
        submission.create_date,
        submission.create_user,
        submission.update_date,
        submission.update_user,
        submission.revision_count,
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
   * Find and return all submission feature records that match the provided criteria.
   *
   * @param {{
   *     submissionId?: number;
   *     systemUserId?: number;
   *     featureTypeNames?: string[];
   *   }} [criteria]
   * @returns {Promise<SubmissionFeatureRecord[]>}
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
   * @returns {Promise<SubmissionRecordPublishedForPublic[]>}
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
        FilteredRows.contributor_id,
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
        FilteredRows.contributor_id,
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
   * @returns {Promise<SubmissionMessageRecord[]>}
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
   * @returns {Promise<void>}
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
   * @returns {Promise<SubmissionRecord>}
   * @memberof SubmissionRepository
   */
  async patchSubmissionRecord(submissionId: number, patch: PatchSubmissionRecord): Promise<SubmissionRecord> {
    const knex = getKnex();
    const queryBuilder = knex.table('submission').where('submission_id', submissionId);

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
    queryBuilder
      .update(updateOperations)
      .returning([
        'submission_id',
        'uuid',
        'security_review_timestamp',
        'submitted_timestamp',
        'system_user_id',
        'contributor_id',
        'name',
        'description',
        'comment',
        'publish_timestamp',
        'record_end_date',
        'create_date',
        'create_user',
        'update_date',
        'update_user',
        'revision_count'
      ]);

    const response = await this.connection.knex(queryBuilder);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to patch submission record', [
        'SubmissionRepository->patchSubmissionRecord',
        `rowCount was ${response.rowCount}, expected rowCount === 1`
      ]);
    }

    const submissionRecord = response.rows[0];
    return submissionRecord as SubmissionRecord;
  }

  /**
   * Unpublish all submissions with the same uuid as the submission with the provided id.
   *
   * @param {number} submissionId
   * @returns {Promise<void>}
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
   * @returns {(Promise<SubmissionFeatureRecord>)}
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
   * @returns {Promise<SubmissionFeatureDownloadRecord[]>}
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
   * @returns {Promise<SubmissionFeatureDownloadRecord[]>}
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
   * Build the base query for submission features.
   *
   * @param {number} submissionId
   * @param {Knex} knex
   * @returns {Knex.QueryBuilder}
   * @memberof SubmissionRepository
   */
  private _getSubmissionFeaturesBaseQuery(submissionId: number, knex: Knex, filters?: SubmissionFeatureFilters) {
    const baseQuery = knex('submission_feature')
      .select(
        'submission_feature.submission_id',
        'submission_feature.submission_feature_id',
        'submission_feature.feature_type_id',
        knex.raw('feature_type.name AS feature_type_name'),
        knex.raw(`
        EXISTS (
          SELECT 1 
          FROM submission_feature_security sfs
          WHERE sfs.submission_feature_id = submission_feature.submission_feature_id
        ) AS secured
      `)
      )
      .leftJoin('feature_type', 'feature_type.feature_type_id', 'submission_feature.feature_type_id')
      .where('submission_feature.submission_id', submissionId);

    const normalizedSearch = filters?.search?.trim().toLowerCase();
    if (normalizedSearch) {
      baseQuery.andWhereRaw('LOWER(feature_type.name) LIKE ?', [`%${normalizedSearch}%`]);
    }

    return knex.with('base_features', baseQuery).distinct('*').from('base_features');
  }

  /**
   * Get all submission features by submission id, paginated.
   *
   * @param {number} submissionId
   * @param {ApiPaginationOptions} pagination
   * @returns {Promise<SubmissionFeatureForReview[]>}
   * @memberof SubmissionRepository
   */
  async getSubmissionFeatures(
    submissionId: number,
    pagination?: ApiPaginationOptions,
    filters?: SubmissionFeatureFilters
  ): Promise<SubmissionFeatureForReview[]> {
    const knex = getKnex();

    const baseQuery = this._getSubmissionFeaturesBaseQuery(submissionId, knex, filters);

    this.applyPagination(baseQuery, pagination);

    const response = await this.connection.knex(baseQuery, SubmissionFeatureForReview);

    return response.rows;
  }

  /**
   * Get the total number of submission features for a given submission.
   *
   * @param {number} submissionId
   * @returns {Promise<number>}
   * @memberof SubmissionRepository
   */
  async getSubmissionFeaturesCount(submissionId: number, filters?: SubmissionFeatureFilters): Promise<number> {
    const knex = getKnex();

    // Wrap the base query as a subquery
    const baseQuery = this._getSubmissionFeaturesBaseQuery(submissionId, knex, filters);
    const countQuery = knex.from(baseQuery.as('sf_base')).select(knex.raw('count(*)::integer as count'));

    const response = await this.connection.knex(countQuery, z.object({ count: z.number() }));

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to get submission feature count', [
        'SubmissionRepository->getSubmissionFeaturesCount',
        'rowCount was null or undefined, expected rowCount != 0'
      ]);
    }

    return response.rows[0].count;
  }
}
