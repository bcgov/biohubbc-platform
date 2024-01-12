import { default as dayjs } from 'dayjs';
import { JSONPath } from 'jsonpath-plus';
import { z } from 'zod';
import { IDBConnection } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import {
  IDatasetsForReview,
  ISourceTransformModel,
  ISubmissionFeature,
  ISubmissionJobQueueRecord,
  ISubmissionMetadataRecord,
  ISubmissionModel,
  ISubmissionModelWithStatus,
  ISubmissionObservationRecord,
  ISubmissionRecord,
  ISubmissionRecordWithSpatial,
  PatchSubmissionRecord,
  SubmissionFeatureDownloadRecord,
  SubmissionFeatureRecord,
  SubmissionFeatureRecordWithTypeAndSecurity,
  SubmissionMessageRecord,
  SubmissionRecord,
  SubmissionRecordPublished,
  SubmissionRecordWithSecurity,
  SubmissionRecordWithSecurityAndRootFeatureType,
  SubmissionRepository,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE
} from '../repositories/submission-repository';
import { EMLFile } from '../utils/media/eml/eml-file';
import { DBService } from './db-service';

export const RelatedDataset = z.object({
  datasetId: z.string(),
  title: z.string(),
  url: z.string()
});

export type RelatedDataset = z.infer<typeof RelatedDataset>;

export class SubmissionService extends DBService {
  submissionRepository: SubmissionRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.submissionRepository = new SubmissionRepository(connection);
  }

  /**
   * Insert a new submission record.
   *
   * @param {ISubmissionRecord} submissionData
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async insertSubmissionRecord(submissionData: ISubmissionRecord): Promise<{ submission_id: number }> {
    return this.submissionRepository.insertSubmissionRecord(submissionData);
  }

  /**
   * Insert a new submission record, returning the record having the matching UUID if it already exists
   * in the database.
   *
   * @param {string} uuid
   * @param {string} name
   * @param {string} description
   * @param {string} userIdentifier
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async insertSubmissionRecordWithPotentialConflict(
    uuid: string,
    name: string,
    description: string,
    userIdentifier: string
  ): Promise<{ submission_id: number }> {
    return this.submissionRepository.insertSubmissionRecordWithPotentialConflict(
      uuid,
      name,
      description,
      userIdentifier
    );
  }

  /**
   * insert submission feature record
   *
   * @param {number} submissionId
   * @param {ISubmissionFeature[]} submissionFeature
   * @return {*}  {Promise<{ submission_feature_id: number }[]>}
   * @memberof SubmissionService
   */
  async insertSubmissionFeatureRecords(
    submissionId: number,
    submissionFeature: ISubmissionFeature[]
  ): Promise<{ submission_feature_id: number }[]> {
    const promise = submissionFeature.map(async (feature) => {
      const featureTypeId = await this.submissionRepository.getFeatureTypeIdByName(feature.type);

      return this.submissionRepository.insertSubmissionFeatureRecord(
        submissionId,
        featureTypeId.feature_type_id,
        feature.properties
      );
    });

    return Promise.all(promise);
  }

  /**
   * Update the `eml_source` column of a submission record.
   *
   * @param {number} submissionId
   * @param {EMLFile} file
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async updateSubmissionMetadataEMLSource(
    submissionId: number,
    submissionMetadataId: number,
    file: EMLFile
  ): Promise<{ submission_metadata_id: number }> {
    return this.submissionRepository.updateSubmissionMetadataEMLSource(submissionId, submissionMetadataId, file);
  }

  /**
   * Update the `eml_json_source` column of a submission record.
   *
   * @param {number} submissionId
   * @param {ISubmissionRecord['eml_json_source']} EMLJSONSource
   * @return {*}  {Promise<{ submission_metadata_id: number }>}
   * @memberof SubmissionService
   */
  async updateSubmissionRecordEMLJSONSource(
    submissionId: number,
    submissionMetadataId: number,
    EMLJSONSource: ISubmissionMetadataRecord['eml_json_source']
  ): Promise<{ submission_metadata_id: number }> {
    return this.submissionRepository.updateSubmissionMetadataEMLJSONSource(
      submissionId,
      submissionMetadataId,
      EMLJSONSource
    );
  }

  /**
   * Get submission record by id.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<ISubmissionModel>}
   * @memberof SubmissionService
   */
  async getSubmissionRecordBySubmissionId(submissionId: number): Promise<ISubmissionModel> {
    return this.submissionRepository.getSubmissionRecordBySubmissionId(submissionId);
  }

  /**
   * Get submission record by uuid.
   *
   * @param {number} uuid
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async getSubmissionIdByUUID(uuid: string): Promise<{ submission_id: number } | null> {
    return this.submissionRepository.getSubmissionIdByUUID(uuid);
  }

  /**
   * Set record_end_date of submission id
   *
   * @param {number} submissionId
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async updateSubmissionMetadataRecordEndDate(submissionId: number): Promise<number> {
    return this.submissionRepository.updateSubmissionMetadataRecordEndDate(submissionId);
  }

  /**
   * Set record_effective_timestamp of submission id
   *
   * @param {number} submissionId
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async updateSubmissionMetadataRecordEffectiveDate(submissionId: number): Promise<number> {
    return this.submissionRepository.updateSubmissionMetadataRecordEffectiveDate(submissionId);
  }

  /**
   * Update end time stamp for submission observation record
   *
   * @param {number} submissionId
   * @return {*}  {Promise<number>}
   * @memberof SubmissionService
   */
  async updateSubmissionObservationRecordEndDate(submissionId: number): Promise<number> {
    return this.submissionRepository.updateSubmissionObservationRecordEndDate(submissionId);
  }

  /**
   * Get source transform record by its associated source system user id.
   *
   * @param {number} systemUserId
   * @return {*}  {Promise<ISourceTransformModel>}
   * @memberof SubmissionService
   */
  async getSourceTransformRecordBySystemUserId(systemUserId: number, version?: string): Promise<ISourceTransformModel> {
    return this.submissionRepository.getSourceTransformRecordBySystemUserId(systemUserId, version);
  }

  /**
   * Get json representation of eml source from submission.
   *
   * @param {number} submissionId
   * @param {string} transform
   * @return {string}
   * @memberof SubmissionService
   */
  async getSubmissionMetadataJson(submissionId: number, transform: string): Promise<string> {
    return this.submissionRepository.getSubmissionMetadataJson(submissionId, transform);
  }

  /**
   * Get source transform record by its associated source transform id.
   *
   * @param {number} sourceTransformId
   * @return {*}  {Promise<ISourceTransformModel>}
   * @memberof SubmissionService
   */
  async getSourceTransformRecordBySourceTransformId(sourceTransformId: number): Promise<ISourceTransformModel> {
    return this.submissionRepository.getSourceTransformRecordBySourceTransformId(sourceTransformId);
  }

  /**
   * Get json representation of eml source from submission by datasetId.
   *
   * @param {string} datasetId
   * @return {Promise<Record<string, unknown>>}
   * @memberof SubmissionService
   */
  async getSubmissionRecordEMLJSONByDatasetId(datasetId: string): Promise<Record<string, unknown>> {
    const response = await this.submissionRepository.getSubmissionRecordEMLJSONByDatasetId(datasetId);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get dataset', [
        'SubmissionRepository->getSubmissionRecordEMLJSONByDatasetId',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0].eml_json_source;
  }

  /**
   * Find json representation of eml source from submission by datasetId. May return null if `datasetId` does not match
   * any existing records.
   *
   * @param {string} datasetId
   * @return {Record<string, unknown> | null}
   * @memberof SubmissionService
   */
  async findSubmissionRecordEMLJSONByDatasetId(datasetId: string): Promise<Record<string, unknown> | null> {
    const response = await this.submissionRepository.getSubmissionRecordEMLJSONByDatasetId(datasetId);

    if (response.rowCount !== 1) {
      return null;
    }

    return response.rows[0].eml_json_source;
  }

  /**
   * Insert a submission status record.
   *
   * @param {number} submissionId
   * @param {SUBMISSION_STATUS_TYPE} submissionStatusType
   * @return {*}  {Promise<{
   *     submission_status_id: number;
   *     submission_status_type_id: number;
   *   }>}
   * @memberof SubmissionService
   */
  async insertSubmissionStatus(
    submissionId: number,
    submissionStatusType: SUBMISSION_STATUS_TYPE
  ): Promise<{
    submission_status_id: number;
    submission_status_type_id: number;
  }> {
    return this.submissionRepository.insertSubmissionStatus(submissionId, submissionStatusType);
  }

  /**
   * Insert a submission message record.
   *
   * @param {number} submissionStatusId
   * @param {SUBMISSION_MESSAGE_TYPE} submissionMessageType
   * @return {*}  {Promise<{
   *     submission_message_id: number;
   *     submission_message_type_id: number;
   *   }>}
   * @memberof SubmissionService
   */
  async insertSubmissionMessage(
    submissionStatusId: number,
    submissionMessageType: SUBMISSION_MESSAGE_TYPE,
    submissionMessage: string
  ): Promise<{
    submission_message_id: number;
    submission_message_type_id: number;
  }> {
    return this.submissionRepository.insertSubmissionMessage(
      submissionStatusId,
      submissionMessageType,
      submissionMessage
    );
  }

  /**
   * List all submissions
   *
   * @param {number} submissionId
   * @return {*}  {Promise<ISubmissionModelWithStatus>}
   * @memberof SubmissionService
   */
  async listSubmissionRecords(): Promise<ISubmissionModelWithStatus[]> {
    return this.submissionRepository.listSubmissionRecords();
  }

  /**
   * Inserts both the status and message of a submission
   *
   * @param {number} submissionId
   * @param {SUBMISSION_STATUS_TYPE} submissionStatusType
   * @param {SUBMISSION_MESSAGE_TYPE} submissionMessageType
   * @param {string} submissionMessage
   * @return {*}  {Promise<{
   *     submission_status_id: number;
   *     submission_message_id: number;
   *   }>}
   * @memberof SubmissionService
   */
  async insertSubmissionStatusAndMessage(
    submissionId: number,
    submissionStatusType: SUBMISSION_STATUS_TYPE,
    submissionMessageType: SUBMISSION_MESSAGE_TYPE,
    submissionMessage: string
  ): Promise<{
    submission_status_id: number;
    submission_message_id: number;
  }> {
    const submission_status_id = (
      await this.submissionRepository.insertSubmissionStatus(submissionId, submissionStatusType)
    ).submission_status_id;

    const submission_message_id = (
      await this.submissionRepository.insertSubmissionMessage(
        submission_status_id,
        submissionMessageType,
        submissionMessage
      )
    ).submission_message_id;

    return {
      submission_status_id,
      submission_message_id
    };
  }

  /**
   * Retrieves an array of submission records with spatial count by dataset id.
   *
   * @param {string[]} datasetIds
   * @return {*}  {(Promise<(ISubmissionRecordWithSpatial | null)[]>)}
   * @memberof SubmissionService
   */
  async findSubmissionRecordsWithSpatialCount(datasetIds: string[]): Promise<(ISubmissionRecordWithSpatial | null)[]> {
    return Promise.all(datasetIds.map(async (datasetId) => this.findSubmissionRecordWithSpatialCount(datasetId)));
  }

  /**
   * Retrieves a submission record with spatial count by dataset id.
   *
   * @param {string} datasetId
   * @return {*}  {(Promise<ISubmissionRecordWithSpatial | null>)}
   * @memberof SubmissionService
   */
  async findSubmissionRecordWithSpatialCount(datasetId: string): Promise<ISubmissionRecordWithSpatial | null> {
    const [submissionEMLJSON, spatialComponentCounts] = await Promise.all([
      this.findSubmissionRecordEMLJSONByDatasetId(datasetId),
      this.submissionRepository.getSpatialComponentCountByDatasetId(datasetId)
    ]);

    if (!submissionEMLJSON) {
      return null;
    }

    return {
      id: datasetId,
      source: submissionEMLJSON,
      observation_count: spatialComponentCounts.find((countItem) => countItem.spatial_type === 'Occurrence')?.count ?? 0
    };
  }

  /**
   *  Fetch row of submission job queue by submission Id
   *
   * @param {number} submissionId
   * @return {*}  {Promise<ISubmissionJobQueueRecord>}
   * @memberof SubmissionService
   */
  async getSubmissionJobQueue(submissionId: number): Promise<ISubmissionJobQueueRecord> {
    return this.submissionRepository.getSubmissionJobQueue(submissionId);
  }

  /**
   * Insert a new metadata record
   *
   * @param {ISubmissionMetadataRecord} submissionMetadata
   * @return {*}  {Promise<{ submission_metadata_id: number }>}
   * @memberof SubmissionService
   */
  async insertSubmissionMetadataRecord(
    submissionMetadata: ISubmissionMetadataRecord
  ): Promise<{ submission_metadata_id: number }> {
    return this.submissionRepository.insertSubmissionMetadataRecord(submissionMetadata);
  }

  /**
   * Insert a new Observation Record
   *
   * @param {ISubmissionObservationRecord} submissionObservation
   * @return {*}  {Promise<{ submission_observation_id: number }>}
   * @memberof SubmissionService
   */
  async insertSubmissionObservationRecord(
    submissionObservation: ISubmissionObservationRecord
  ): Promise<{ submission_observation_id: number }> {
    return this.submissionRepository.insertSubmissionObservationRecord(submissionObservation);
  }

  /**
   * Retrieves an array of datasets related to the given dataset.
   *
   * @param {string} datasetId
   * @return {*}  {Promise<RelatedDataset[]>}
   * @memberof SubmissionService
   */
  async findRelatedDatasetsByDatasetId(datasetId: string): Promise<RelatedDataset[]> {
    const emlJson = await this.getSubmissionRecordEMLJSONByDatasetId(datasetId);

    if (!emlJson) {
      return [];
    }

    const result = JSONPath({
      path: '$..eml:eml..relatedProject',
      json: emlJson,
      resultType: 'all'
    });

    if (!result.length) {
      return [];
    }

    return result[0].value.map((relatedProject: any) => {
      return {
        datasetId: relatedProject['@_id'],
        title: relatedProject['title'],
        url: [relatedProject['@_system'], relatedProject['@_id']].join('/')
      };
    });
  }

  /**
   * Gets datasets that have artifacts that require a security review.
   * This will roll up any related projects to provide a "total" count of artifacts to review
   *
   * @param keys A list of keys to filter the data based on search criteria defined by the transform process
   * @returns {*}  {Promise<IDatasetsForReview[]>}
   * @memberof SubmissionService
   */
  async getDatasetsForReview(keys: string[]): Promise<IDatasetsForReview[]> {
    const data = await this.submissionRepository.getDatasetsForReview(keys);
    const datasetsForReview: IDatasetsForReview[] = [];

    for await (const item of data) {
      let rollUpCount = 0;
      const dates: string[] = [];

      if (item.related_projects) {
        for await (const rp of item.related_projects) {
          const rpCount = await this.submissionRepository.getArtifactForReviewCountForSubmissionUUID(rp['@_id']);
          if (rpCount) {
            rollUpCount += rpCount.artifacts_to_review;
            dates.push(rpCount.last_updated ?? '');
          }
        }
      }

      const parentArtifactCount = await this.submissionRepository.getArtifactForReviewCountForSubmissionUUID(
        item.dataset_id
      );
      if (parentArtifactCount) {
        const finalCount = rollUpCount + parentArtifactCount.artifacts_to_review;

        // only push projects with artifacts to review
        if (finalCount > 0) {
          dates.push(parentArtifactCount.last_updated ?? '');
          datasetsForReview.push({
            dataset_id: parentArtifactCount.dataset_id,
            artifacts_to_review: finalCount,
            dataset_name: item.dataset_name,
            last_updated: this.mostRecentDate(dates),
            keywords: item.keywords
          });
        }
      }
    }
    return datasetsForReview;
  }

  /**
   * Compares and finds the most recent date given a list of date strings. Todays date is returned if no data is present in the list
   *
   * @param dates a list of date strings
   * @returns {*} {string} the most recent date found
   */
  mostRecentDate(dates: string[]): string {
    dates.sort((d1, d2) => dayjs(d1).diff(dayjs(d2)));
    return dates[0] ?? dayjs();
  }

  /**
   *
   * @param submissionId
   * @param submitterSystem
   * @param datasetSearch
   * @returns
   * @memberof SubmissionService
   */
  async updateSubmissionMetadataWithSearchKeys(submissionId: number, datasetSearch: any): Promise<number> {
    return this.submissionRepository.updateSubmissionMetadataWithSearchKeys(submissionId, datasetSearch);
  }

  /**
   * Get all submissions that are pending security review (are unreviewed).
   *
   * @return {*}  {Promise<SubmissionRecordWithSecurityAndRootFeatureType[]>}
   * @memberof SubmissionService
   */
  async getUnreviewedSubmissionsForAdmins(): Promise<SubmissionRecordWithSecurityAndRootFeatureType[]> {
    return this.submissionRepository.getUnreviewedSubmissionsForAdmins();
  }

  /**
   * Get all submissions that have completed security review (are reviewed).
   *
   * @return {*}  {Promise<SubmissionRecordWithSecurityAndRootFeatureType[]>}
   * @memberof SubmissionService
   */
  async getReviewedSubmissionsForAdmins(): Promise<SubmissionRecordWithSecurityAndRootFeatureType[]> {
    return this.submissionRepository.getReviewedSubmissionsForAdmins();
  }

  /**
   * Get all submissions that have completed security review and are published.
   *
   * @return {*}  {Promise<SubmissionRecordWithSecurityAndRootFeatureType[]>}
   * @memberof SubmissionService
   */
  async getPublishedSubmissionsForAdmins(): Promise<SubmissionRecordWithSecurityAndRootFeatureType[]> {
    return this.submissionRepository.getPublishedSubmissionsForAdmins();
  }

  /**
   * Get a submission record by id (with security status).
   *
   * @param {number} submissionId
   * @return {*}  {Promise<SubmissionRecordWithSecurity>}
   * @memberof SubmissionService
   */
  async getSubmissionRecordBySubmissionIdWithSecurity(submissionId: number): Promise<SubmissionRecordWithSecurity> {
    return this.submissionRepository.getSubmissionRecordBySubmissionIdWithSecurity(submissionId);
  }

  /**
   * Get all published submissions.
   *
   * @return {*}  {Promise<SubmissionRecordPublished[]>}
   * @memberof SubmissionService
   */
  async getPublishedSubmissions(): Promise<SubmissionRecordPublished[]> {
    return this.submissionRepository.getPublishedSubmissions();
  }

  /**
   * Retrieves submission features with type and name.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<
   *     {
   *       feature_type_name: string;
   *       feature_type_display_name: string;
   *       features: SubmissionFeatureRecordWithTypeAndSecurity[];
   *     }[]
   *   >}
   * @memberof SubmissionService
   */
  async getSubmissionFeaturesBySubmissionId(submissionId: number): Promise<
    {
      feature_type_name: string;
      feature_type_display_name: string;
      features: SubmissionFeatureRecordWithTypeAndSecurity[];
    }[]
  > {
    const uncategorizedFeatures = await this.submissionRepository.getSubmissionFeaturesBySubmissionId(submissionId);

    const categorizedFeatures: Record<string, SubmissionFeatureRecordWithTypeAndSecurity[]> = {};

    for (const feature of uncategorizedFeatures) {
      const featureCategoryArray = categorizedFeatures[feature.feature_type_name];

      if (featureCategoryArray) {
        // Append to existing array of matching feature type
        categorizedFeatures[feature.feature_type_name] = featureCategoryArray.concat(feature);
      } else {
        // Create new array for feature type
        categorizedFeatures[feature.feature_type_name] = [feature];
      }
    }

    const submissionFeatures = Object.entries(categorizedFeatures).map(([featureType, submissionFeatures]) => ({
      feature_type_name: featureType,
      feature_type_display_name: submissionFeatures[0].feature_type_display_name,
      features: submissionFeatures
    }));

    return submissionFeatures;
  }

  /**
   * Get all messages for a submission.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<SubmissionMessageRecord[]>}
   * @memberof SubmissionService
   */
  async getMessages(submissionId: number): Promise<SubmissionMessageRecord[]> {
    return this.submissionRepository.getMessages(submissionId);
  }

  /**
   * Creates submission message records for a submission.
   *
   * @param {number} submissionId
   * @param {(Pick<SubmissionMessageRecord, 'submission_message_type_id' | 'label' | 'message' | 'data'>[])} messages
   * @return {*}  {Promise<void>}
   * @memberof SubmissionService
   */
  async createMessages(
    submissionId: number,
    messages: Pick<SubmissionMessageRecord, 'submission_message_type_id' | 'label' | 'message' | 'data'>[]
  ): Promise<void> {
    // Add submission_id to message object
    const messagesToInsert = messages.map((message) => ({ ...message, submission_id: submissionId }));

    return this.submissionRepository.createMessages(messagesToInsert);
  }

  /**
   * Patch a submission record.
   *
   * @param {number} submissionId
   * @param {PatchSubmissionRecord} patch
   * @return {*}  {Promise<SubmissionRecord>}
   * @memberof SubmissionServiceF
   */
  async patchSubmissionRecord(submissionId: number, patch: PatchSubmissionRecord): Promise<SubmissionRecord> {
    return this.submissionRepository.patchSubmissionRecord(submissionId, patch);
  }

  /**
   * Get the root submission feature record for a submission.
   *
   * @param {number} submissionId
   * @return {*}  {(Promise<SubmissionFeatureRecord>)}
   * @memberof SubmissionService
   */
  async getSubmissionRootFeature(submissionId: number): Promise<SubmissionFeatureRecord> {
    return this.submissionRepository.getSubmissionRootFeature(submissionId);
  }

  /**
   *  Download Submission with all associated Features
   *
   * @param {number} submissionId
   * @return {*}  {Promise<SubmissionFeatureDownloadRecord[]>}
   * @memberof SubmissionService
   */
  async downloadSubmission(submissionId: number): Promise<SubmissionFeatureDownloadRecord[]> {
    return this.submissionRepository.downloadSubmission(submissionId);
  }

  /**
   *  Download Published Submission with all associated Features
   *
   * @param {number} submissionId
   * @return {*}  {Promise<SubmissionFeatureDownloadRecord[]>}
   * @memberof SubmissionService
   */
  async downloadPublishedSubmission(submissionId: number): Promise<SubmissionFeatureDownloadRecord[]> {
    return this.submissionRepository.downloadPublishedSubmission(submissionId);
  }
}
