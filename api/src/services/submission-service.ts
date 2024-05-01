import { JSONPath } from 'jsonpath-plus';
import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import { SubmissionFeatureSearchKeyValues } from '../repositories/search-index-respository';
import {
  ISubmissionFeature,
  ISubmissionJobQueueRecord,
  ISubmissionModel,
  ISubmissionRecord,
  PatchSubmissionRecord,
  SubmissionFeatureDownloadRecord,
  SubmissionFeatureRecord,
  SubmissionFeatureRecordWithTypeAndSecurity,
  SubmissionFeatureSignedUrlPayload,
  SubmissionMessageRecord,
  SubmissionRecord,
  SubmissionRecordPublishedForPublic,
  SubmissionRecordWithSecurity,
  SubmissionRecordWithSecurityAndRootFeatureType,
  SubmissionRepository,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE
} from '../repositories/submission-repository';
import { getS3SignedURL } from '../utils/file-utils';
import { getLogger } from '../utils/logger';
import { DBService } from './db-service';
import { SearchIndexService } from './search-index-service';

const defaultLog = getLogger('submission-service');

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
   * @param {string} description A description of the submission. Should not contain any sensitive information.
   * @param {string} comment An internal comment/description of the submission for administrative purposes. May contain
   * sensitive information. Should never be shared with the general public.
   * @param {number} systemUserId
   * @param {string} systemUserIdentifier
   * @return {*}  {Promise<SubmissionRecord>}
   * @memberof SubmissionService
   */
  async insertSubmissionRecordWithPotentialConflict(
    uuid: string,
    name: string,
    description: string,
    comment: string,
    systemUserId: number,
    systemUserIdentifier: string
  ): Promise<SubmissionRecord> {
    return this.submissionRepository.insertSubmissionRecordWithPotentialConflict(
      uuid,
      name,
      description,
      comment,
      systemUserId,
      systemUserIdentifier
    );
  }

  /**
   * Insert submission features.
   *
   * @param {number} submissionId
   * @param {ISubmissionFeature[]} submissionFeatures
   * @return {*}  {Promise<void>}
   * @memberof SubmissionService
   */
  async insertSubmissionFeatureRecords(submissionId: number, submissionFeatures: ISubmissionFeature[]): Promise<void> {
    try {
      // Generate paths to all non-null nodes which contain a 'child_features' property
      const submissionFeatureJsonPaths: string[] = JSONPath({
        path: '$..[?(@ && @.child_features)]',
        flatten: true,
        resultType: 'path',
        json: submissionFeatures
      });

      // Store a mapping of jsonPath to submission_feature_id
      const parentSubmissionFeatureIdMap: Map<string, number> = new Map();

      // Match the last path segment of a jsonPath that ends with 'child_features[<index>]'
      const matchLastJsonPathSegment = /\['child_features'\]\[\d+\]$/;

      for (const jsonPath of submissionFeatureJsonPaths) {
        // Fetch a submissionFeature object
        const node: ISubmissionFeature[] = JSONPath({ path: jsonPath, resultType: 'value', json: submissionFeatures });

        if (!node?.length) {
          continue;
        }

        // We expect the 'path' to resolve an array of 1 item
        const featureNode = node[0];

        // Get the parent jsonPath by stripping the last path segment from the current jsonPath
        const parentJsonPath = jsonPath.replace(matchLastJsonPathSegment, '');

        // Get the submission_feature_id of the parent submissionFeature object, or null if the current node is the root
        const parentSubmissionFeatureId = parentSubmissionFeatureIdMap.get(parentJsonPath) || null;

        // Validate the submissionFeature object
        const response = await this.submissionRepository.insertSubmissionFeatureRecord(
          submissionId,
          parentSubmissionFeatureId,
          featureNode.id,
          featureNode.type,
          featureNode.properties
        );

        // Cache the submission_feature_id for the current jsonPath
        parentSubmissionFeatureIdMap.set(jsonPath, response.submission_feature_id);
      }

      defaultLog.debug({ label: 'insertSubmissionFeatureRecords', message: 'success' });
    } catch (error) {
      defaultLog.error({ label: 'validateSubmissionFeatures', message: 'error', error });
      throw error;
    }
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
   * Note: This method is used by the public API. Sensitive data should not be included in the response.
   *
   * @return {*}  {Promise<SubmissionRecordPublishedForPublic[]>}
   * @memberof SubmissionService
   */
  async getPublishedSubmissions(): Promise<SubmissionRecordPublishedForPublic[]> {
    return this.submissionRepository.getPublishedSubmissions();
  }

  /**
   * Retrieves submission feature records with type, name, and security data included.
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
   * Retrieves submission features with type and name.
   *
   * Note: This method replaces the original feature data object with one built from only the search key values (from
   * the `search_<type>` tables).
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
  async getSubmissionFeaturesWithSearchKeyValuesBySubmissionId(submissionId: number): Promise<
    {
      feature_type_name: string;
      feature_type_display_name: string;
      features: SubmissionFeatureRecordWithTypeAndSecurity[];
    }[]
  > {
    const uncategorizedFeatures = await this.submissionRepository.getSubmissionFeaturesBySubmissionId(submissionId);

    const searchIndexService = new SearchIndexService(this.connection);
    const submissionFeatureSearchKeyValues = await searchIndexService.getSearchKeyValuesBySubmissionId(submissionId);

    const categorizedFeatures: Record<string, SubmissionFeatureRecordWithTypeAndSecurity[]> = {};

    for (const feature of uncategorizedFeatures) {
      const featureCategoryArray = categorizedFeatures[feature.feature_type_name];

      const featureSearchKeyValueData = submissionFeatureSearchKeyValues
        .filter((item) => item.submission_feature_id === feature.submission_feature_id)
        .reduce((acc, obj) => {
          acc[obj.feature_property_name] = obj.value;
          return acc;
        }, {} as Record<SubmissionFeatureSearchKeyValues['feature_property_name'], SubmissionFeatureSearchKeyValues['value']>);

      const featureWithSearchkeyValues = {
        ...feature,
        data: featureSearchKeyValueData // overwrite original data with search key values
      };

      if (featureCategoryArray) {
        // Append to existing array of matching feature type
        categorizedFeatures[featureWithSearchkeyValues.feature_type_name] =
          featureCategoryArray.concat(featureWithSearchkeyValues);
      } else {
        // Create new array for feature type
        categorizedFeatures[featureWithSearchkeyValues.feature_type_name] = [featureWithSearchkeyValues];
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
   * Get a submission feature record by uuid.
   *
   * @param {string} submissionFeatureUuid
   * @return {*}  {Promise<SubmissionFeatureRecord>}
   * @memberof SubmissionService
   */
  async getSubmissionFeatureByUuid(submissionFeatureUuid: string): Promise<SubmissionFeatureRecord> {
    return this.submissionRepository.getSubmissionFeatureByUuid(submissionFeatureUuid);
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
   * Find and return all submission feature records that match the provided criteria.
   *
   * @param {{
   *     submissionId?: number;
   *     systemUserId?: number;
   *     featureTypeNames?: string[];
   *   }} [criteria]
   * @return {*}  {Promise<SubmissionFeatureRecord[]>}
   * @memberof SubmissionService
   */
  async findSubmissionFeatures(criteria?: {
    submissionId?: number;
    systemUserId?: number;
    featureTypeNames?: string[];
  }): Promise<SubmissionFeatureRecord[]> {
    return this.submissionRepository.findSubmissionFeatures(criteria);
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

  /**
   * Generates a signed URL for a submission_feature's (artifact) key value pair
   * ie: "artifact_key": "artifact/test-file.txt"
   *
   * Note: admin's can generate signed urls for secure submission_features
   *
   * @async
   * @param {SubmissionFeatureSignedUrlPayload} payload
   * @throws {ApiGeneralError}
   * @memberof SubmissionService
   * @returns {Promise<string>} signed URL
   */
  async getSubmissionFeatureSignedUrl(payload: SubmissionFeatureSignedUrlPayload): Promise<string> {
    const artifactKey = payload.isAdmin
      ? await this.submissionRepository.getAdminSubmissionFeatureArtifactKey(payload)
      : await this.submissionRepository.getSubmissionFeatureArtifactKey(payload);

    const signedUrl = await getS3SignedURL(artifactKey);

    if (!signedUrl) {
      throw new ApiGeneralError(
        `Failed to generate signed URL for "${payload.submissionFeatureObj.key}":"${payload.submissionFeatureObj.value}"`,
        ['SubmissionRepository->getSubmissionFeatureSignedUrl', 'getS3SignedUrl returned NULL']
      );
    }

    return signedUrl;
  }
}
