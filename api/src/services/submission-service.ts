import { SYSTEM_ROLE } from '../constants/roles';
import { IDBConnection } from '../database/db';
import { ApiNotFoundError } from '../errors/api-error';
import { HTTP400, HTTP403 } from '../errors/http-error';
import { Blueprint } from '../models/blueprint';
import { PolicyEffect } from '../models/policy-statement';
import {
  AdminSubmissionListFilters,
  AdminSubmissionListResponse,
  SubmissionFeatureListFilters,
  SubmissionFeaturePage,
  SubmissionFilters,
  SubmissionSummary
} from '../models/submission';
import { BlueprintRepository } from '../repositories/blueprint-repository';
import {
  ICreateSubmission,
  ISubmissionModel,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE,
  SubmissionFeatureRecord,
  SubmissionMessageRecord,
  SubmissionRecord,
  SubmissionRecordWithSecurity,
  SubmissionRepository
} from '../repositories/submission-repository';
import { SubmissionUploadRepository } from '../repositories/upload/submission-upload-repository';
import { makePaginationResponse } from '../utils/pagination';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { PolicyService } from './access-policy/policy-service';
import { TeamPolicyService } from './access-policy/team-policy-service';
import { TeamService } from './access-policy/team-service';
import { BlueprintService } from './blueprint-service';
import { DBService } from './db-service';
import { UserService } from './user-service';

export class SubmissionService extends DBService {
  submissionRepository: SubmissionRepository;
  blueprintRepository: BlueprintRepository;
  submissionUploadRepository: SubmissionUploadRepository;
  blueprintService: BlueprintService;
  teamService: TeamService;
  policyService: PolicyService;
  teamPolicyService: TeamPolicyService;
  userService: UserService;

  constructor(connection: IDBConnection) {
    super(connection);

    this.submissionRepository = new SubmissionRepository(connection);
    this.blueprintRepository = new BlueprintRepository(connection);
    this.submissionUploadRepository = new SubmissionUploadRepository(connection);
    this.blueprintService = new BlueprintService(connection);
    this.teamService = new TeamService(connection);
    this.policyService = new PolicyService(connection);
    this.teamPolicyService = new TeamPolicyService(connection);
    this.userService = new UserService(connection);
  }

  /**
   * Require owning-contributor membership for submission writes, with a system-administrator exception.
   * Ownership comes from the stored submission. Team access is checked by middleware.
   *
   * @param {string} submissionUuid Submission whose contributor owns the operation.
   * @returns {Promise<void>} Resolves when contributor write access is allowed.
   * @throws {HTTP403} If the caller has no contributor write access.
   */
  async assertSubmissionContributorWriteAccess(submissionUuid: string): Promise<void> {
    const systemUserId = this.connection.systemUserId();
    const contributor = await this.submissionRepository.findSubmissionContributorMembership(
      submissionUuid,
      systemUserId
    );
    if (contributor?.is_member) {
      return;
    }

    const user = await this.userService.getUserById(systemUserId);
    if (!user.role_names.includes(SYSTEM_ROLE.SYSTEM_ADMIN)) {
      throw new HTTP403('No active membership in the submission contributor');
    }
  }

  /**
   * Lock the submission's current feature state for the active transaction.
   *
   * @param {number} submissionId Submission identifier.
   * @returns {Promise<void>} Resolves after acquiring the submission-scoped transaction lock.
   * @memberof SubmissionService
   */
  async lockSubmissionFeatureStateForSubmissionId(submissionId: number): Promise<void> {
    await this.submissionRepository.lockSubmissionFeatureStateForSubmissionId(submissionId);
  }

  /**
   * Insert a new submission record with its team and the team's access policy.
   *
   * The submitter and the additional users form the submission's team, which can read and upload to the submission.
   * Team membership does not reach feature content: an approved policy linked to the team grants it access to every
   * feature in the submission, so the team's feature access is managed like any other policy grant.
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

    const submission = await this.submissionRepository.insertSubmissionRecord({
      ...submissionData,
      team_id: team.team_id
    });

    const policy = await this.policyService.createPolicyWithStatements(
      {
        name: `Submission Policy ${submissionData.uuid}`,
        description: `Auto-generated policy granting the team of submission ${submissionData.uuid} access to its features.`,
        status: 'approved'
      },
      [{ effect: PolicyEffect.ALLOW, submission_feature_urn: `urn:${submission.submission_id}:*:*` }]
    );

    await this.teamPolicyService.createTeamPolicy({ team_id: team.team_id, policy_id: policy.policy_id });

    return submission;
  }

  /**
   * Find the blueprint a submission's next upload uses when the upload request does not name one.
   *
   * The submission's own default applies even after that blueprint is retired. A submission without one falls back
   * to the system default blueprint.
   *
   * @param {number} submissionId Submission identifier.
   * @returns {Promise<number | null>} The default `blueprint_id`, or null when neither default exists.
   * @memberof SubmissionService
   */
  async findSubmissionDefaultBlueprintId(submissionId: number): Promise<number | null> {
    const submission = await this.submissionRepository.getSubmissionRecordBySubmissionId(submissionId);

    if (submission.default_blueprint_id != null) {
      return submission.default_blueprint_id;
    }

    return this.blueprintRepository.findDefaultBlueprintId();
  }

  /**
   * Get the blueprint a submission's next upload uses when the upload request does not name one.
   *
   * @param {number} submissionId Submission identifier.
   * @returns {Promise<Blueprint>} The submission's default blueprint, including a retired one.
   * @throws {ApiNotFoundError} When neither the submission nor the system has a default blueprint.
   * @memberof SubmissionService
   */
  async getSubmissionDefaultBlueprint(submissionId: number): Promise<Blueprint> {
    const defaultBlueprintId = await this.findSubmissionDefaultBlueprintId(submissionId);

    if (defaultBlueprintId === null) {
      throw new ApiNotFoundError('Default Blueprint not found', [
        'SubmissionService->getSubmissionDefaultBlueprint',
        `submission_id ${submissionId} has no default Blueprint and no active default Blueprint exists`
      ]);
    }

    return this.blueprintService.getBlueprint(defaultBlueprintId);
  }

  /**
   * Change the blueprint a submission's future uploads use when the upload request does not name one.
   *
   * Existing uploads keep the blueprint they were created with. The new default must be available now; it keeps
   * applying to this submission if it is retired later.
   *
   * @param {number} submissionId Submission identifier.
   * @param {number} blueprintId The submission's new default blueprint.
   * @returns {Promise<void>} Resolves after the submission's default blueprint has been changed.
   * @throws {HTTP400} When the requested blueprint is not available.
   * @throws {ApiNotFoundError} When the submission does not exist.
   * @memberof SubmissionService
   */
  async updateSubmissionDefaultBlueprint(submissionId: number, blueprintId: number): Promise<void> {
    const availableBlueprintId = await this.blueprintRepository.findActiveBlueprintById(blueprintId);

    if (availableBlueprintId === null) {
      throw new HTTP400('Requested Blueprint is not available', [
        'SubmissionService->updateSubmissionDefaultBlueprint',
        `blueprint_id ${blueprintId} does not exist or is no longer available for new uploads`
      ]);
    }

    await this.submissionRepository.updateSubmissionDefaultBlueprint(submissionId, availableBlueprintId);
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
   * Get one page of every active submission in the system for administrators, with the total matching the filters.
   *
   * @param {AdminSubmissionListFilters} filters - Optional keyword matched against the submission name.
   * @param {ApiPaginationOptions} pagination - Page, page size and sort.
   * @returns {Promise<AdminSubmissionListResponse>} The page of submissions and its pagination totals.
   * @memberof SubmissionService
   */
  async getAdminSubmissionList(
    filters: AdminSubmissionListFilters,
    pagination: ApiPaginationOptions
  ): Promise<AdminSubmissionListResponse> {
    const submissions = await this.submissionRepository.getAdminSubmissionList(filters, pagination);
    const total = await this.submissionRepository.getAdminSubmissionCount(filters);

    return { submissions, pagination: makePaginationResponse(total, pagination) };
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
   * @param {number} submissionId Submission identifier.
   * @param {number | null} systemUserId Caller identity used to filter feature type tabs, or null for anonymous.
   * @returns {Promise<SubmissionRecordWithSecurity>} Submission metadata, visible feature types, and security status.
   * @memberof SubmissionService
   */
  async getSubmissionRecordBySubmissionIdWithSecurity(
    submissionId: number,
    systemUserId: number | null
  ): Promise<SubmissionRecordWithSecurity> {
    return this.submissionRepository.getSubmissionRecordBySubmissionIdWithSecurity(submissionId, systemUserId);
  }

  /**
   * Get one page of a submission's published (approved) features in a lifecycle, with the total.
   *
   * Only features reached by one of the caller's team policy grants are returned. Unreviewed features are not
   * published, so they appear only in their upload's feature list until the upload is approved.
   *
   * @param {number} submissionId ID of the submission whose features should be returned.
   * @param {number} systemUserId Caller whose team policy grants select the features.
   * @param {SubmissionFeatureListFilters} filters Lifecycle of the published features returned.
   * @param {ApiPaginationOptions} pagination Page, page size and sort.
   * @returns {Promise<SubmissionFeaturePage>} The page of features and its pagination totals.
   * @memberof SubmissionService
   */
  async getSubmissionFeaturePage(
    submissionId: number,
    systemUserId: number,
    filters: SubmissionFeatureListFilters,
    pagination: ApiPaginationOptions
  ): Promise<SubmissionFeaturePage> {
    const features = await this.submissionRepository.getSubmissionFeatures(
      submissionId,
      systemUserId,
      filters,
      pagination
    );
    const total = await this.submissionRepository.getSubmissionFeaturesCount(submissionId, systemUserId, filters);

    return { features, pagination: makePaginationResponse(total, pagination) };
  }

  /**
   * Get one page of an upload's features at any lifecycle stage (unreviewed, current or superseded), with the total.
   *
   * Only features reached by one of the caller's team policy grants are returned.
   *
   * @param {number} submissionId Submission the upload belongs to.
   * @param {string} submissionUploadId Upload whose features are returned.
   * @param {number} systemUserId Caller whose team policy grants select the features.
   * @param {ApiPaginationOptions} pagination Page, page size and sort.
   * @returns {Promise<SubmissionFeaturePage>} The page of the upload's features and its pagination totals.
   * @throws {ApiNotFoundError} If the submission has no active upload with the ID.
   * @memberof SubmissionService
   */
  async getSubmissionUploadFeaturePage(
    submissionId: number,
    submissionUploadId: string,
    systemUserId: number,
    pagination: ApiPaginationOptions
  ): Promise<SubmissionFeaturePage> {
    await this.submissionUploadRepository.getSubmissionUploadBySubmissionId(submissionId, submissionUploadId);

    const features = await this.submissionRepository.getSubmissionUploadFeatures(
      submissionId,
      submissionUploadId,
      systemUserId,
      pagination
    );
    const total = await this.submissionRepository.getSubmissionUploadFeaturesCount(
      submissionId,
      submissionUploadId,
      systemUserId
    );

    return { features, pagination: makePaginationResponse(total, pagination) };
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
   * Get the root submission feature record for a submission.
   *
   * @param {number} submissionId
   * @returns {(Promise<SubmissionFeatureRecord>)}
   * @memberof SubmissionService
   */
  async getSubmissionRootFeature(submissionId: number): Promise<SubmissionFeatureRecord> {
    return this.submissionRepository.getSubmissionRootFeature(submissionId);
  }
}
