import { IDBConnection } from '../database/db';
import { SubmissionFeatureForReview, SubmissionFilters, SubmissionSummary } from '../models/submission';
import {
  ICreateSubmission,
  ISubmissionModel,
  PatchSubmissionRecord,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE,
  SubmissionFeatureRecord,
  SubmissionFeatureRecordWithTypeAndSecurity,
  SubmissionMessageRecord,
  SubmissionRecord,
  SubmissionRecordPublishedForPublic,
  SubmissionRecordWithSecurity,
  SubmissionRecordWithSecurityAndRootFeatureType,
  SubmissionRepository
} from '../repositories/submission-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { TeamService } from './access-policy/team-service';
import { DBService } from './db-service';

export class SubmissionService extends DBService {
  submissionRepository: SubmissionRepository;
  teamService: TeamService;

  constructor(connection: IDBConnection) {
    super(connection);

    this.submissionRepository = new SubmissionRepository(connection);
    this.teamService = new TeamService(connection);
  }

  /**
   * Lock the submission's feature state for the active transaction.
   *
   * @param {number} submissionId Submission identifier.
   * @returns {Promise<void>} Resolves after acquiring the submission-scoped transaction lock.
   * @memberof SubmissionService
   */
  async lockSubmissionFeatureStateForSubmissionId(submissionId: number): Promise<void> {
    await this.submissionRepository.lockSubmissionFeatureStateForSubmissionId(submissionId);
  }

  /**
   * Insert a new submission record.
   *
   * @param {ICreateSubmission} submissionData
   * @param {number[]} [additionalSystemUserIds] Additional users to add to the submission team
   * @returns {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async insertSubmissionRecord(
    submissionData: ICreateSubmission,
    additionalSystemUserIds: number[] = []
  ): Promise<{ submission_id: number }> {
    const team = await this.teamService.createTeam({
      name: `Submission Team ${submissionData.uuid}`,
      description: `Auto-generated upload-creation team for submission ${submissionData.uuid}.`,
      system_user_ids: [...new Set([submissionData.system_user_id, ...additionalSystemUserIds])]
    });

    return this.submissionRepository.insertSubmissionRecord({
      ...submissionData,
      team_id: team.team_id
    });
  }

  /**
   * Add users to a submission's owning team without replacing existing members.
   *
   * @param {string} teamId Submission team identifier.
   * @param {number[]} systemUserIds System users to add.
   * @returns {Promise<void>}
   */
  async addSubmissionTeamMembers(teamId: string, systemUserIds: number[]): Promise<void> {
    await this.teamService.addTeamMembers(teamId, systemUserIds);
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
   * @param {number} contributorId
   * @returns {Promise<SubmissionRecord>}
   * @memberof SubmissionService
   */
  async insertSubmissionRecordWithPotentialConflict(
    uuid: string,
    name: string,
    description: string,
    comment: string,
    systemUserId: number,
    contributorId: number
  ): Promise<SubmissionRecord> {
    const team = await this.teamService.createTeam({
      name: `Submission Team ${uuid}`,
      description: `Auto-generated upload-creation team for submission ${uuid}.`,
      system_user_ids: [systemUserId]
    });

    return this.submissionRepository.insertSubmissionRecordWithPotentialConflict(
      uuid,
      name,
      description,
      comment,
      systemUserId,
      contributorId,
      team.team_id
    );
  }

  /**
   * Get submission record by id.
   *
   * @param {number} submissionId
   * @returns {Promise<ISubmissionModel>}
   * @memberof SubmissionService
   */
  async getSubmissionRecordBySubmissionId(submissionId: number): Promise<ISubmissionModel> {
    return this.submissionRepository.getSubmissionRecordBySubmissionId(submissionId);
  }

  /**
   * Get submission record by uuid.
   *
   * @param {number} uuid
   * @returns {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async getSubmissionIdByUUID(uuid: string): Promise<{ submission_id: number }> {
    return this.submissionRepository.getSubmissionIdByUUID(uuid);
  }

  /**
   * Insert a submission status record.
   *
   * @param {number} submissionId
   * @param {SUBMISSION_STATUS_TYPE} submissionStatusType
   * @returns {Promise<{
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
   * @returns {Promise<{
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
   * @returns {Promise<{
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
   * Get all submissions that are pending security review (are unreviewed).
   *
   * @returns {Promise<SubmissionRecordWithSecurityAndRootFeatureType[]>}
   * @memberof SubmissionService
   */
  async getUnreviewedSubmissionsForAdmins(): Promise<SubmissionRecordWithSecurityAndRootFeatureType[]> {
    return this.submissionRepository.getUnreviewedSubmissionsForAdmins();
  }

  /**
   * Get all submissions that have completed security review (are reviewed).
   *
   * @returns {Promise<SubmissionRecordWithSecurityAndRootFeatureType[]>}
   * @memberof SubmissionService
   */
  async getReviewedSubmissionsForAdmins(): Promise<SubmissionRecordWithSecurityAndRootFeatureType[]> {
    return this.submissionRepository.getReviewedSubmissionsForAdmins();
  }

  /**
   * Get all submissions that have completed security review and are published.
   *
   * @returns {Promise<SubmissionRecordWithSecurityAndRootFeatureType[]>}
   * @memberof SubmissionService
   */
  async getPublishedSubmissionsForAdmins(): Promise<SubmissionRecordWithSecurityAndRootFeatureType[]> {
    return this.submissionRepository.getPublishedSubmissionsForAdmins();
  }

  /**
   * Get all submissions accessible to the given system user through submission-team membership.
   *
   * @param {number} systemUserId - The system user ID to fetch submissions for.
   * @param {ApiPaginationOptions} pagination
   * @param {SubmissionFilters} [filters]
   * @returns {Promise<SubmissionSummary[]>}
   * @memberof SubmissionService
   */
  async getSubmissionsByUserId(
    systemUserId: number,
    pagination: ApiPaginationOptions,
    filters?: SubmissionFilters
  ): Promise<SubmissionSummary[]> {
    return this.submissionRepository.getSubmissionsByUserId(systemUserId, pagination, filters);
  }

  /**
   * Count submissions accessible to the given system user via team membership with optional search.
   *
   * @param {number} systemUserId
   * @param {SubmissionFilters} [filters]
   * @returns {Promise<number>}
   * @memberof SubmissionService
   */
  async getSubmissionsByUserIdCount(systemUserId: number, filters?: SubmissionFilters): Promise<number> {
    return this.submissionRepository.getSubmissionsByUserIdCount(systemUserId, filters);
  }

  /**
   * Get a submission record by id (with security status).
   *
   * @param {number} submissionId
   * @returns {Promise<SubmissionRecordWithSecurity>}
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
   * @returns {Promise<SubmissionRecordPublishedForPublic[]>}
   * @memberof SubmissionService
   */
  async getPublishedSubmissions(): Promise<SubmissionRecordPublishedForPublic[]> {
    return this.submissionRepository.getPublishedSubmissions();
  }

  /**
   * Retrieves submission feature records with type, name, and security data included.
   *
   * @param {number} submissionId
   * @returns {Promise<
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
   * Fetch the flattened array of features in the given submission with optional pagination
   *
   * @param {number} submissionId ID of the submission whose features should be returned.
   * @param {ApiPaginationOptions} [pagination] Optional pagination and sorting options.
   * @param {number | null} [systemUserId] Optional user context; omit only for administrative queries.
   * @returns {Promise<SubmissionFeatureForReview[]>} Active submission features visible to the requesting user.
   * @memberof SubmissionService
   */
  async getSubmissionFeatures(
    submissionId: number,
    pagination?: ApiPaginationOptions,
    systemUserId?: number | null
  ): Promise<SubmissionFeatureForReview[]> {
    return this.submissionRepository.getSubmissionFeatures(submissionId, pagination, systemUserId);
  }

  /**
   * Fetch the total count of features in the given submission
   *
   * @param {number} submissionId ID of the submission whose features should be counted.
   * @param {number | null} [systemUserId] Optional user context; omit only for administrative queries.
   * @returns {Promise<number>} Number of matching active submission features visible to the requesting user.
   * @memberof SubmissionService
   */
  async getSubmissionFeaturesCount(submissionId: number, systemUserId?: number | null): Promise<number> {
    return this.submissionRepository.getSubmissionFeaturesCount(submissionId, systemUserId);
  }

  /**
   * Get all messages for a submission.
   *
   * @param {number} submissionId
   * @returns {Promise<SubmissionMessageRecord[]>}
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
   * @returns {Promise<void>}
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
   * @returns {Promise<SubmissionRecord>}
   * @memberof SubmissionServiceF
   */
  async patchSubmissionRecord(submissionId: number, patch: PatchSubmissionRecord): Promise<SubmissionRecord> {
    return this.submissionRepository.patchSubmissionRecord(submissionId, patch);
  }

  /**
   * Get the root submission feature record for a submission.
   *
   * @param {number} submissionId
   * @returns {(Promise<SubmissionFeatureRecord>)}
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
   * @returns {Promise<SubmissionFeatureRecord[]>}
   * @memberof SubmissionService
   */
  async findSubmissionFeatures(criteria?: {
    submissionId?: number;
    systemUserId?: number;
    featureTypeNames?: string[];
  }): Promise<SubmissionFeatureRecord[]> {
    return this.submissionRepository.findSubmissionFeatures(criteria);
  }
}
