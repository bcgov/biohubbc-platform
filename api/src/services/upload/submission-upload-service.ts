import { IDBConnection } from '../../database/db';
import { ApiConflictError, ApiGeneralError } from '../../errors/api-error';
import { HTTP400, HTTP409 } from '../../errors/http-error';
import {
  CreateSubmissionUpload,
  SubmissionUpload,
  SubmissionUploadFilters,
  TicketSubmissionUpload,
  UpdateSubmissionUpload
} from '../../models/submission-upload';
import {
  SubmissionUploadReviewStatus,
  UpdateSubmissionUploadReviewStatus
} from '../../models/submission-upload-review-status';
import { publishComputeSubmissionFeatureClosureJob } from '../../queue/publisher';
import { BlueprintRepository } from '../../repositories/blueprint-repository';
import { SubmissionUploadRepository } from '../../repositories/upload/submission-upload-repository';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { TeamService } from '../access-policy/team-service';
import { DBService } from '../db-service';
import { SubmissionUploadReconciliationService } from '../reconciliation/submission-upload-reconciliation-service';
import { SubmissionValidationService } from '../submission-validation-service';
import { SubmissionUploadReviewStatusService } from './submission-upload-review-status-service';

export class SubmissionUploadService extends DBService {
  submissionUploadRepository: SubmissionUploadRepository;
  blueprintRepository: BlueprintRepository;
  submissionUploadReviewStatusService: SubmissionUploadReviewStatusService;
  teamService: TeamService;

  /** Mutable dependency bag used by tests to stub queue publication under ESM. */
  static readonly dependencies = {
    publishComputeSubmissionFeatureClosureJob
  };

  /**
   * Creates an instance of SubmissionUploadService.
   *
   * @param {IDBConnection} connection Database connection object
   * @memberof SubmissionUploadService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionUploadRepository = new SubmissionUploadRepository(connection);
    this.blueprintRepository = new BlueprintRepository(connection);
    this.submissionUploadReviewStatusService = new SubmissionUploadReviewStatusService(connection);
    this.teamService = new TeamService(connection);
  }

  /**
   * Resolve the Blueprint a new upload should be pinned to.
   *
   * Resolution order:
   * 1. If a `blueprint_id` was supplied, validate it is currently available (`record_end_date IS
   *    NULL`) and use it. An unavailable id is a client error (HTTP 400).
   * 2. Otherwise inherit the most recent prior upload's Blueprint for the same submission, so
   *    re-submissions stay stable when the system default Blueprint changes.
   * 3. Otherwise (no prior upload) fall back to the active default Blueprint.
   *
   * @param {number} submissionId - The submission the upload belongs to.
   * @param {number | null} [requestedBlueprintId] - Optional caller-supplied Blueprint id.
   * @returns {Promise<number>} - The resolved `blueprint_id` to store on the upload.
   * @throws {HTTP400} If a requested Blueprint id is not available.
   * @throws {ApiGeneralError} If no Blueprint can be resolved (no prior upload and no default).
   * @memberof SubmissionUploadService
   */
  async resolveBlueprintIdForUpload(submissionId: number, requestedBlueprintId?: number | null): Promise<number> {
    if (requestedBlueprintId != null) {
      const blueprintId = await this.blueprintRepository.findActiveBlueprintById(requestedBlueprintId);

      if (blueprintId === null) {
        throw new HTTP400('Requested Blueprint is not available', [
          'SubmissionUploadService->resolveBlueprintIdForUpload',
          `blueprint_id ${requestedBlueprintId} does not exist or is no longer available for new uploads`
        ]);
      }

      return blueprintId;
    }

    const priorBlueprintId = await this.submissionUploadRepository.findMostRecentBlueprintIdBySubmissionId(
      submissionId
    );

    if (priorBlueprintId !== null) {
      return priorBlueprintId;
    }

    const defaultBlueprintId = await this.blueprintRepository.findDefaultBlueprintId();

    if (defaultBlueprintId === null) {
      throw new ApiGeneralError('No default Blueprint is configured', [
        'SubmissionUploadService->resolveBlueprintIdForUpload',
        `submission_id ${submissionId} has no prior upload and no active default Blueprint exists`
      ]);
    }

    return defaultBlueprintId;
  }

  /**
   * Retrieves a single submission_upload record by its ID.
   *
   * @param {string} submissionUploadId The ID of the submission upload artifact
   * @returns {Promise<SubmissionUpload>} The submission upload artifact record
   * @memberof SubmissionUploadService
   */
  async getSubmissionUpload(submissionUploadId: string): Promise<SubmissionUpload> {
    return this.submissionUploadRepository.getSubmissionUpload(submissionUploadId);
  }

  /**
   * Retrieves and row-locks a single submission_upload record by its ID.
   *
   * Use this in transactional worker gates to prevent concurrent jobs from
   * starting for the same submission_upload_id.
   *
   * @param {string} submissionUploadId The ID of the submission upload artifact
   * @returns {Promise<SubmissionUpload>} The locked submission upload record
   * @memberof SubmissionUploadService
   */
  async getSubmissionUploadWithLock(submissionUploadId: string): Promise<SubmissionUpload> {
    return this.submissionUploadRepository.getSubmissionUploadWithLock(submissionUploadId);
  }

  /**
   * Retrieves a submission_upload record only if it belongs to the submission identified by the given UUID.
   * Use this to validate path parameters (submissionId + submissionUploadId) before acting on an upload.
   *
   * @param {string} submissionUuid Submission UUID from path (submission.uuid)
   * @param {string} submissionUploadId Submission upload ID from path
   * @returns {Promise<SubmissionUpload>} The submission upload record
   * @throws {ApiNotFoundError} If the submission or upload does not exist, or the upload does not belong to the submission (mapped to 404 by error handler)
   * @memberof SubmissionUploadService
   */
  async getSubmissionUploadBySubmissionUuid(
    submissionUuid: string,
    submissionUploadId: string
  ): Promise<SubmissionUpload> {
    return this.submissionUploadRepository.getSubmissionUploadBySubmissionUuid(submissionUuid, submissionUploadId);
  }

  /**
   * Retrieves all submission_upload records for the given submission, with filters and pagination.
   *
   * @param {number} submissionId
   * @param {SubmissionUploadFilters} filters
   * @param {ApiPaginationOptions} pagination
   * @returns {Promise<SubmissionUpload[]>} Array of all submission upload artifacts
   * @memberof SubmissionUploadService
   */
  async getSubmissionUploadsBySubmissionId(
    submissionId: number,
    filters?: SubmissionUploadFilters,
    pagination?: ApiPaginationOptions
  ): Promise<SubmissionUpload[]> {
    return this.submissionUploadRepository.getSubmissionUploadsBySubmissionId(submissionId, filters, pagination);
  }

  /**
   * Find ticket-scoped submission upload timeline records.
   *
   * @param {string} ticketId Ticket UUID.
   * @returns {Promise<TicketSubmissionUpload[]>} Submission uploads linked to the ticket.
   * @memberof SubmissionUploadService
   */
  async findSubmissionUploadsByTicketId(ticketId: string): Promise<TicketSubmissionUpload[]> {
    return this.submissionUploadRepository.findSubmissionUploadsByTicketId(ticketId);
  }

  /**
   * Retrieves a submission_upload record by upload_id (reverse lookup).
   *
   * @param {string} uploadId The upload_id to look up
   * @returns {Promise<SubmissionUpload | null>} The submission upload record
   * @memberof SubmissionUploadService
   */
  async getSubmissionUploadByUploadId(uploadId: string): Promise<SubmissionUpload> {
    return this.submissionUploadRepository.getSubmissionUploadByUploadId(uploadId);
  }

  /**
   * Create a dedicated access team and insert a new submission_upload record.
   *
   * @param {CreateSubmissionUpload} submissionUpload The artifact data to insert
   * @param {number} requestorSystemUserId Authenticated user who initiated the upload
   * @param {number[]} [submitterSystemUserIds] Additional users who may access the upload
   * @returns {Promise<{ submission_upload_artipfact_id: string }>} Newly created artifact ID
   * @memberof SubmissionUploadService
   */
  async insertSubmissionUpload(
    submissionUpload: CreateSubmissionUpload,
    requestorSystemUserId: number,
    submitterSystemUserIds: number[] = []
  ): Promise<{ submission_upload_id: string }> {
    const team = await this.teamService.createTeam({
      name: `Submission Upload Team ${submissionUpload.upload_id}`,
      description: `Auto-generated access team for submission upload ${submissionUpload.upload_id}.`,
      system_user_ids: [...new Set([requestorSystemUserId, ...submitterSystemUserIds])]
    });

    return this.submissionUploadRepository.insertSubmissionUpload({
      ...submissionUpload,
      team_id: team.team_id
    });
  }

  /**
   * Updates an existing submission_upload record by ID.
   *
   * @param {string} submissionUploadId The ID of the artifact to update
   * @param {UpdateSubmissionUpload} submissionUpload Fields to update
   * @returns {Promise<{ submission_upload_id: string }>} Updated artifact ID
   * @memberof SubmissionUploadService
   */
  async updateSubmissionUpload(
    submissionUploadId: string,
    submissionUpload: UpdateSubmissionUpload
  ): Promise<{ submission_upload_id: string }> {
    return this.submissionUploadRepository.updateSubmissionUpload(submissionUploadId, submissionUpload);
  }

  /**
   * Validate a status transition against an allowed current-status set.
   *
   * @private
   * @param {string} submissionUploadId Submission upload identifier.
   * @param {SubmissionUpload['status']} currentStatus Current persisted status.
   * @param {SubmissionUpload['status']} nextStatus Target status for transition.
   * @param {SubmissionUpload['status'][]} allowedCurrentStatuses Allowed source statuses.
   * @returns {void}
   * @memberof SubmissionUploadService
   */
  private assertSubmissionUploadStatusTransition(
    submissionUploadId: string,
    currentStatus: SubmissionUpload['status'],
    nextStatus: SubmissionUpload['status'],
    allowedCurrentStatuses: SubmissionUpload['status'][]
  ): void {
    if (!allowedCurrentStatuses.includes(currentStatus)) {
      throw new ApiConflictError('Invalid submission upload status transition', [
        'SubmissionUploadService->transitionSubmissionUploadStatus',
        { submissionUploadId, currentStatus, nextStatus, allowedCurrentStatuses }
      ]);
    }
  }

  /**
   * Transition submission upload status after asserting the current status is allowed.
   *
   * @param {string} submissionUploadId
   * @param {SubmissionUpload['status']} nextStatus
   * @param {SubmissionUpload['status'][]} allowedCurrentStatuses
   * @returns {Promise<void>}
   */
  async transitionSubmissionUploadStatus(
    submissionUploadId: string,
    nextStatus: SubmissionUpload['status'],
    allowedCurrentStatuses: SubmissionUpload['status'][]
  ): Promise<void> {
    const current = await this.getSubmissionUpload(submissionUploadId);

    this.assertSubmissionUploadStatusTransition(submissionUploadId, current.status, nextStatus, allowedCurrentStatuses);

    await this.updateSubmissionUpload(submissionUploadId, { status: nextStatus });
  }

  /**
   * Transition to ingested when process stage completes successfully.
   * - ingesting -> ingested
   * - ingested -> ingested (no-op)
   * - all other statuses -> conflict
   *
   * @param {string} submissionUploadId Submission upload scope.
   * @returns {Promise<void>}
   */
  async transitionSubmissionUploadToIngested(submissionUploadId: string): Promise<void> {
    const current = await this.getSubmissionUpload(submissionUploadId);

    if (current.status === 'ingested') {
      return;
    }

    this.assertSubmissionUploadStatusTransition(submissionUploadId, current.status, 'ingested', ['ingesting']);
    await this.updateSubmissionUpload(submissionUploadId, { status: 'ingested' });
  }

  /**
   * Transition to invalid for deterministic validation failure.
   * - any active processing stage -> invalid
   * - invalid -> invalid (no-op)
   * - all other statuses -> conflict
   *
   * @param {string} submissionUploadId Submission upload scope.
   * @returns {Promise<void>}
   */
  async transitionSubmissionUploadToInvalid(submissionUploadId: string): Promise<void> {
    const current = await this.getSubmissionUpload(submissionUploadId);

    if (current.status === 'invalid') {
      return;
    }

    this.assertSubmissionUploadStatusTransition(submissionUploadId, current.status, 'invalid', [
      'uploaded',
      'ingesting',
      'ingested',
      'reconciling',
      'reconciled',
      'promoting',
      'promoted',
      'indexing'
    ]);
    await this.updateSubmissionUpload(submissionUploadId, { status: 'invalid' });
  }

  /**
   * Transition to indexing when the indexing stage starts.
   * - ingested -> indexing
   * - indexing -> indexing (no-op)
   * - all other statuses -> conflict
   *
   * @param {string} submissionUploadId Submission upload scope.
   * @returns {Promise<void>}
   */
  async transitionSubmissionUploadToIndexing(submissionUploadId: string): Promise<void> {
    const current = await this.getSubmissionUpload(submissionUploadId);

    if (current.status === 'indexing') {
      return;
    }

    this.assertSubmissionUploadStatusTransition(submissionUploadId, current.status, 'indexing', ['ingested']);
    await this.updateSubmissionUpload(submissionUploadId, { status: 'indexing' });
  }

  /**
   * Transition to indexed when the indexing stage completes successfully.
   * - indexing -> indexed
   * - indexed -> indexed (no-op)
   * - all other statuses -> conflict
   *
   * @param {string} submissionUploadId Submission upload scope.
   * @returns {Promise<void>}
   */
  async transitionSubmissionUploadToIndexed(submissionUploadId: string): Promise<void> {
    const current = await this.getSubmissionUpload(submissionUploadId);

    if (current.status === 'indexed') {
      return;
    }

    this.assertSubmissionUploadStatusTransition(submissionUploadId, current.status, 'indexed', ['indexing']);
    await this.updateSubmissionUpload(submissionUploadId, { status: 'indexed' });
  }

  /**
   * Transition an ingested upload into reconciliation, allowing idempotent resume.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<void>}
   * @memberof SubmissionUploadService
   */
  async transitionSubmissionUploadToReconciling(submissionUploadId: string): Promise<void> {
    const current = await this.getSubmissionUpload(submissionUploadId);
    if (current.status === 'reconciling') {
      return;
    }
    this.assertSubmissionUploadStatusTransition(submissionUploadId, current.status, 'reconciling', ['ingested']);
    await this.updateSubmissionUpload(submissionUploadId, { status: 'reconciling' });
  }

  /**
   * Complete reconciliation for a submission upload.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<void>}
   * @memberof SubmissionUploadService
   */
  async transitionSubmissionUploadToReconciled(submissionUploadId: string): Promise<void> {
    const current = await this.getSubmissionUpload(submissionUploadId);
    if (current.status === 'reconciled') {
      return;
    }
    this.assertSubmissionUploadStatusTransition(submissionUploadId, current.status, 'reconciled', ['reconciling']);
    await this.updateSubmissionUpload(submissionUploadId, { status: 'reconciled' });
  }

  /**
   * Transition a reconciled upload into feature promotion.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<void>}
   * @memberof SubmissionUploadService
   */
  async transitionSubmissionUploadToPromoting(submissionUploadId: string): Promise<void> {
    const current = await this.getSubmissionUpload(submissionUploadId);
    if (current.status === 'promoting') {
      return;
    }
    this.assertSubmissionUploadStatusTransition(submissionUploadId, current.status, 'promoting', ['reconciled']);
    await this.updateSubmissionUpload(submissionUploadId, { status: 'promoting' });
  }

  /**
   * Complete feature promotion.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<void>}
   * @memberof SubmissionUploadService
   */
  async transitionSubmissionUploadToPromoted(submissionUploadId: string): Promise<void> {
    const current = await this.getSubmissionUpload(submissionUploadId);
    if (current.status === 'promoted') {
      return;
    }
    this.assertSubmissionUploadStatusTransition(submissionUploadId, current.status, 'promoted', ['promoting']);
    await this.updateSubmissionUpload(submissionUploadId, { status: 'promoted' });
  }

  /**
   * Record a review decision and apply its submission-feature lifecycle effects.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @param {UpdateSubmissionUploadReviewStatus} data Requested review decision.
   * @returns {Promise<SubmissionUploadReviewStatus>} Persisted review status.
   */
  async updateSubmissionUploadReviewStatus(
    submissionUploadId: string,
    data: UpdateSubmissionUploadReviewStatus
  ): Promise<SubmissionUploadReviewStatus> {
    const upload = await this.getSubmissionUploadWithLock(submissionUploadId);

    const reviewStatusService = new SubmissionUploadReviewStatusService(this.connection);
    const currentReviewStatus = await reviewStatusService.getSubmissionUploadReviewStatus(submissionUploadId);

    if (data.status === 'approved') {
      return this.approveSubmissionUpload(upload, currentReviewStatus);
    }

    return this.recordNonApprovalStatus(upload, currentReviewStatus, data.status);
  }

  /**
   * Validate and apply an approval, or return the existing decision idempotently.
   *
   * @param {SubmissionUpload} upload Locked submission upload.
   * @param {SubmissionUploadReviewStatus} currentReviewStatus Current review decision.
   * @returns {Promise<SubmissionUploadReviewStatus>} Approved review status.
   */
  private async approveSubmissionUpload(
    upload: SubmissionUpload,
    currentReviewStatus: SubmissionUploadReviewStatus
  ): Promise<SubmissionUploadReviewStatus> {
    if (currentReviewStatus.status === 'approved') {
      return currentReviewStatus;
    }

    await this.assertSubmissionUploadCanBeApproved(upload);
    const submissionUploadReconciliationService = new SubmissionUploadReconciliationService(this.connection);
    await submissionUploadReconciliationService.activateSubmissionUploadReconciliation(upload.submission_upload_id);

    const submissionUploadReviewStatusService = new SubmissionUploadReviewStatusService(this.connection);
    const approvedStatus = await submissionUploadReviewStatusService.insertSubmissionUploadReviewStatus({
      submission_upload_id: upload.submission_upload_id,
      status: 'approved'
    });

    await this.publishSubmissionFeatureClosure(upload, approvedStatus.submission_upload_status_id);
    return approvedStatus;
  }

  /** Queue closure for one feature-state revision. */
  private async publishSubmissionFeatureClosure(upload: SubmissionUpload, closureRevision: number): Promise<void> {
    await SubmissionUploadService.dependencies.publishComputeSubmissionFeatureClosureJob(
      this.connection,
      {
        submissionId: upload.submission_id,
        submissionUploadId: upload.submission_upload_id
      },
      { singletonKey: `closure-recompute-${upload.submission_upload_id}-${closureRevision}` }
    );
  }

  /**
   * Apply revocation when needed and persist a non-approval decision.
   *
   * @param {SubmissionUpload} upload Locked submission upload.
   * @param {SubmissionUploadReviewStatus} currentReviewStatus Current review decision.
   * @param {Exclude<UpdateSubmissionUploadReviewStatus['status'], 'approved'>} status Requested decision.
   * @returns {Promise<SubmissionUploadReviewStatus>} Persisted review status.
   */
  private async recordNonApprovalStatus(
    upload: SubmissionUpload,
    currentReviewStatus: SubmissionUploadReviewStatus,
    status: Exclude<UpdateSubmissionUploadReviewStatus['status'], 'approved'>
  ): Promise<SubmissionUploadReviewStatus> {
    const submissionUploadReviewStatusService = new SubmissionUploadReviewStatusService(this.connection);
    const reviewStatus = await submissionUploadReviewStatusService.insertSubmissionUploadReviewStatus({
      submission_upload_id: upload.submission_upload_id,
      status
    });

    if (currentReviewStatus.status === 'approved') {
      const submissionUploadReconciliationService = new SubmissionUploadReconciliationService(this.connection);
      await submissionUploadReconciliationService.revokeSubmissionUploadReconciliation(upload.submission_upload_id);
      await this.publishSubmissionFeatureClosure(upload, reviewStatus.submission_upload_status_id);
    }

    return reviewStatus;
  }

  /**
   * Assert that upload processing and automated validation have completed before feature activation.
   *
   * @param {SubmissionUpload} upload Locked submission upload.
   * @returns {Promise<void>}
   */
  private async assertSubmissionUploadCanBeApproved(upload: SubmissionUpload): Promise<void> {
    if (upload.status !== 'indexed') {
      throw new HTTP400('Submission upload must be indexed before approval');
    }

    const submissionValidationService = new SubmissionValidationService(this.connection);
    const validation = await submissionValidationService.getSubmissionValidationBySubmissionUploadId(
      upload.submission_upload_id
    );

    if (validation?.status !== 'completed') {
      throw new HTTP400('Submission upload validation must be completed before approval');
    }
  }

  /**
   * Soft-deletes a single active submission_upload record by ID.
   *
   * @param {string} submissionUploadId The ID of the record to soft-delete
   * @returns {Promise<void>}
   * @memberof SubmissionUploadService
   */
  async softDeleteSubmissionUpload(submissionUploadId: string): Promise<void> {
    return this.submissionUploadRepository.softDeleteSubmissionUpload(submissionUploadId);
  }

  /**
   * Soft-deletes all active submission_upload records for a given submission.
   *
   * @param {number} submissionId The submission whose uploads should be soft-deleted
   * @returns {Promise<number>} The number of records soft-deleted
   * @memberof SubmissionUploadService
   */
  async softDeleteSubmissionUploadsBySubmissionId(submissionId: number): Promise<number> {
    return this.submissionUploadRepository.softDeleteSubmissionUploadsBySubmissionId(submissionId);
  }

  /**
   * Delete an unreviewed submission upload and retire its dedicated access team.
   *
   * Verifies that the upload belongs to the submission, requires its current review status to be
   * `submitted`, soft-deletes the upload, records the `deleted` status, and soft-deletes its team.
   * The caller is responsible for running this method in a transaction.
   *
   * @param {string} submissionUuid Submission UUID from the request path.
   * @param {string} submissionUploadId Submission upload UUID from the request path.
   * @returns {Promise<void>}
   * @throws {HTTP409} If the upload has already been reviewed.
   * @memberof SubmissionUploadService
   */
  async deleteSubmissionUpload(submissionUuid: string, submissionUploadId: string): Promise<void> {
    const submissionUpload = await this.getSubmissionUploadBySubmissionUuid(submissionUuid, submissionUploadId);
    const reviewStatus = await this.submissionUploadReviewStatusService.getSubmissionUploadReviewStatus(
      submissionUploadId
    );

    if (reviewStatus.status !== 'submitted') {
      throw new HTTP409(
        `Cannot delete a submission upload with status "${reviewStatus.status}". Only uploads with status "submitted" may be deleted.`
      );
    }

    await this.submissionUploadRepository.deleteSubmissionUpload(submissionUploadId);
    // Record the status directly rather than routing through updateSubmissionUploadReviewStatus: that
    // method drives reconciliation/activation of the upload's features, which a delete must not trigger.
    await this.submissionUploadReviewStatusService.insertSubmissionUploadReviewStatus({
      submission_upload_id: submissionUploadId,
      status: 'deleted'
    });
    await this.teamService.deleteTeam(submissionUpload.team_id);
  }
}
