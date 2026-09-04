import { ACTIVE_UPLOAD_PROCESSING_STAGES } from '../../constants/submission-upload';
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
import { SubmissionUploadProcessingStatusHistoryItem } from '../../models/submission-upload-processing-status';
import {
  SubmissionUploadReviewStatus,
  UpdateSubmissionUploadReviewStatus
} from '../../models/submission-upload-review-status';
import { publishComputeSubmissionFeatureClosureJob } from '../../queue/publisher';
import { BlueprintRepository } from '../../repositories/blueprint-repository';
import { SubmissionUploadProcessingStatusRepository } from '../../repositories/upload/submission-upload-processing-status-repository';
import { SubmissionUploadRepository } from '../../repositories/upload/submission-upload-repository';
import { getLogger } from '../../utils/logger';
import { getSupersededProcessingStatuses } from '../../utils/submission-upload-status';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { TeamService } from '../access-policy/team-service';
import { DBService } from '../db-service';
import { SubmissionUploadReconciliationService } from '../reconciliation/submission-upload-reconciliation-service';
import { SubmissionFeatureClosureService } from '../submission-feature-closure-service';
import { SubmissionService } from '../submission-service';
import { SubmissionValidationService } from '../submission-validation-service';
import { SubmissionUploadReviewStatusService } from './submission-upload-review-status-service';

const defaultLog = getLogger('services/upload/submission-upload-service');

export class SubmissionUploadService extends DBService {
  submissionUploadRepository: SubmissionUploadRepository;
  submissionUploadProcessingStatusRepository: SubmissionUploadProcessingStatusRepository;
  blueprintRepository: BlueprintRepository;
  submissionUploadReviewStatusService: SubmissionUploadReviewStatusService;
  teamService: TeamService;
  submissionService: SubmissionService;
  submissionFeatureClosureService: SubmissionFeatureClosureService;

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
    this.submissionUploadProcessingStatusRepository = new SubmissionUploadProcessingStatusRepository(connection);
    this.blueprintRepository = new BlueprintRepository(connection);
    this.submissionUploadReviewStatusService = new SubmissionUploadReviewStatusService(connection);
    this.teamService = new TeamService(connection);
    this.submissionService = new SubmissionService(connection);
    this.submissionFeatureClosureService = new SubmissionFeatureClosureService(connection);
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
   * Create a dedicated access team, insert a new submission_upload record and record its initial
   * processing status so the status history starts at the upload's first status.
   *
   * @param {CreateSubmissionUpload} submissionUpload The artifact data to insert
   * @param {number} requestorSystemUserId Authenticated user who initiated the upload
   * @param {number[]} [submitterSystemUserIds] Additional users who may access the upload
   * @returns {Promise<{ submission_upload_id: string }>} Newly created submission upload ID.
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

    // Match approval's row-lock-before-submission-lock order. The insert then atomically links the
    // latest upload as its predecessor; the advisory lock also serializes concurrent first uploads.
    await this.submissionUploadRepository.lockSubmissionUploadsForSubmissionId(submissionUpload.submission_id);
    await this.submissionService.lockSubmissionFeatureStateForSubmissionId(submissionUpload.submission_id);

    const inserted = await this.submissionUploadRepository.insertSubmissionUpload({
      ...submissionUpload,
      team_id: team.team_id
    });

    await this.submissionUploadProcessingStatusRepository.insertSubmissionUploadProcessingStatus(
      inserted.submission_upload_id,
      submissionUpload.status
    );

    return inserted;
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
    await this.assertSubmissionUploadCanBeChanged(submissionUploadId);
    return this.submissionUploadRepository.updateSubmissionUpload(submissionUploadId, submissionUpload);
  }

  /**
   * Validate a status transition against an allowed current-status set.
   *
   * @private
   * @param {string} submissionUploadId Submission upload identifier.
   * @param {SubmissionUpload['status']} currentStatus Current persisted status.
   * @param {SubmissionUpload['status'][]} allowedCurrentStatuses Allowed source statuses.
   * @returns {void}
   * @memberof SubmissionUploadService
   */
  private assertStatusCanChange(
    submissionUploadId: string,
    currentStatus: SubmissionUpload['status'],
    allowedCurrentStatuses: SubmissionUpload['status'][]
  ): void {
    if (!allowedCurrentStatuses.includes(currentStatus)) {
      throw new ApiConflictError('Invalid submission upload status transition', [
        'SubmissionUploadService->transitionSubmissionUploadStatus',
        { submissionUploadId, currentStatus, allowedCurrentStatuses }
      ]);
    }
  }

  /**
   * Transition submission upload status after asserting the current status is allowed.
   *
   * This is the only path that writes `submission_upload.status`. On one connection it locks the
   * active upload row, validates the transition, end-dates the history rows the new status
   * supersedes, updates the current status and inserts the new history row. The caller owns the
   * transaction, so a failure at any step rolls back every write together. A transition to the
   * status the upload already holds is a no-op that writes nothing.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @param {SubmissionUpload['status']} nextStatus Status to persist after validation.
   * @param {SubmissionUpload['status'][]} allowedCurrentStatuses Current statuses permitted to make the transition.
   * @returns {Promise<void>} Resolves after the validated status transition and its history row are persisted.
   * @memberof SubmissionUploadService
   */
  async transitionSubmissionUploadStatus(
    submissionUploadId: string,
    nextStatus: SubmissionUpload['status'],
    allowedCurrentStatuses: SubmissionUpload['status'][]
  ): Promise<void> {
    const current = await this.getSubmissionUploadWithLock(submissionUploadId);

    if (current.status === nextStatus) {
      return;
    }

    this.assertStatusCanChange(submissionUploadId, current.status, allowedCurrentStatuses);

    const supersededCount =
      await this.submissionUploadProcessingStatusRepository.endActiveSubmissionUploadProcessingStatuses(
        submissionUploadId,
        getSupersededProcessingStatuses(nextStatus)
      );

    if (supersededCount > 0) {
      defaultLog.info({
        label: 'transitionSubmissionUploadStatus',
        message: 'Superseded processing status history rows',
        submissionUploadId,
        currentStatus: current.status,
        nextStatus,
        supersededCount
      });
    }

    await this.submissionUploadRepository.updateSubmissionUploadStatus(submissionUploadId, nextStatus);
    await this.submissionUploadProcessingStatusRepository.insertSubmissionUploadProcessingStatus(
      submissionUploadId,
      nextStatus
    );
  }

  /**
   * Transition to ingesting when the process stage starts.
   * - uploaded -> ingesting
   * - ingesting -> ingesting (no-op, idempotent retry)
   * - all other statuses -> conflict
   *
   * @param {string} submissionUploadId Submission upload scope.
   * @returns {Promise<void>} Resolves after transition to `ingesting`, including an idempotent no-op.
   * @memberof SubmissionUploadService
   */
  async transitionSubmissionUploadToIngesting(submissionUploadId: string): Promise<void> {
    await this.transitionSubmissionUploadStatus(submissionUploadId, 'ingesting', ['uploaded']);
  }

  /**
   * Transition to ingested when process stage completes successfully.
   * - ingesting -> ingested
   * - ingested -> ingested (no-op)
   * - all other statuses -> conflict
   *
   * @param {string} submissionUploadId Submission upload scope.
   * @returns {Promise<void>} Resolves after transition to `ingested`, including an idempotent no-op.
   * @memberof SubmissionUploadService
   */
  async transitionSubmissionUploadToIngested(submissionUploadId: string): Promise<void> {
    await this.transitionSubmissionUploadStatus(submissionUploadId, 'ingested', ['ingesting']);
  }

  /**
   * Transition to invalid for deterministic validation failure.
   * - any active processing stage -> invalid
   * - invalid -> invalid (no-op)
   * - all other statuses -> conflict
   *
   * @param {string} submissionUploadId Submission upload scope.
   * @returns {Promise<void>} Resolves after transition to `invalid`, including an idempotent no-op.
   * @memberof SubmissionUploadService
   */
  async transitionSubmissionUploadToInvalid(submissionUploadId: string): Promise<void> {
    await this.transitionSubmissionUploadStatus(submissionUploadId, 'invalid', ACTIVE_UPLOAD_PROCESSING_STAGES);
  }

  /**
   * Transition to failed when a processing job exhausts its retries or its artifact fails scanning.
   * - any non-terminal processing stage -> failed
   * - failed -> failed (no-op)
   * - indexed / invalid -> conflict
   *
   * @param {string} submissionUploadId Submission upload scope.
   * @returns {Promise<void>} Resolves after transition to `failed`, including an idempotent no-op.
   * @memberof SubmissionUploadService
   */
  async transitionSubmissionUploadToFailed(submissionUploadId: string): Promise<void> {
    await this.transitionSubmissionUploadStatus(submissionUploadId, 'failed', ACTIVE_UPLOAD_PROCESSING_STAGES);
  }

  /**
   * Transition to indexing when the indexing stage starts.
   * - reconciled -> indexing
   * - indexing -> indexing (no-op)
   * - all other statuses -> conflict
   *
   * @param {string} submissionUploadId Submission upload scope.
   * @returns {Promise<void>} Resolves after transition to `indexing`, including an idempotent no-op.
   * @memberof SubmissionUploadService
   */
  async transitionSubmissionUploadToIndexing(submissionUploadId: string): Promise<void> {
    await this.transitionSubmissionUploadStatus(submissionUploadId, 'indexing', ['reconciled']);
  }

  /**
   * Transition to indexed when the indexing stage completes successfully.
   * - indexing -> indexed
   * - indexed -> indexed (no-op)
   * - all other statuses -> conflict
   *
   * @param {string} submissionUploadId Submission upload scope.
   * @returns {Promise<void>} Resolves after transition to `indexed`, including an idempotent no-op.
   * @memberof SubmissionUploadService
   */
  async transitionSubmissionUploadToIndexed(submissionUploadId: string): Promise<void> {
    await this.transitionSubmissionUploadStatus(submissionUploadId, 'indexed', ['indexing']);
  }

  /**
   * Transition an ingested upload into reconciliation, allowing idempotent resume.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<void>} Resolves after transition to `reconciling`, including an idempotent no-op.
   * @memberof SubmissionUploadService
   */
  async transitionSubmissionUploadToReconciling(submissionUploadId: string): Promise<void> {
    await this.transitionSubmissionUploadStatus(submissionUploadId, 'reconciling', ['ingested']);
  }

  /**
   * Complete reconciliation for a submission upload.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<void>} Resolves after transition to `reconciled`, including an idempotent no-op.
   * @memberof SubmissionUploadService
   */
  async transitionSubmissionUploadToReconciled(submissionUploadId: string): Promise<void> {
    await this.transitionSubmissionUploadStatus(submissionUploadId, 'reconciled', ['reconciling']);
  }

  /**
   * Find the active processing status history of an upload that belongs to the given submission.
   *
   * Rows are returned earliest first, in the order the statuses were entered. Superseded rows
   * (end-dated by reprocessing) are excluded.
   *
   * @param {string} submissionUuid Submission UUID from the request path.
   * @param {string} submissionUploadId Submission upload UUID from the request path.
   * @returns {Promise<SubmissionUploadProcessingStatusHistoryItem[]>} Active processing status rows, earliest first.
   * @throws {ApiNotFoundError} If the upload does not exist or does not belong to the submission.
   * @memberof SubmissionUploadService
   */
  async findSubmissionUploadProcessingStatusHistory(
    submissionUuid: string,
    submissionUploadId: string
  ): Promise<SubmissionUploadProcessingStatusHistoryItem[]> {
    await this.getSubmissionUploadBySubmissionUuid(submissionUuid, submissionUploadId);

    const rows = await this.submissionUploadProcessingStatusRepository.findActiveSubmissionUploadProcessingStatuses(
      submissionUploadId
    );

    return rows.map((row) => ({
      submission_upload_status_id: row.submission_upload_status_id,
      submission_upload_id: row.submission_upload_id,
      status: row.status,
      create_date: row.create_date
    }));
  }

  /**
   * Record a review decision and apply its submission-feature lifecycle effects.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @param {UpdateSubmissionUploadReviewStatus} data Requested review decision.
   * @returns {Promise<SubmissionUploadReviewStatus>} Persisted review status.
   * @memberof SubmissionUploadService
   */
  async updateSubmissionUploadReviewStatus(
    submissionUploadId: string,
    data: UpdateSubmissionUploadReviewStatus
  ): Promise<SubmissionUploadReviewStatus> {
    const upload = await this.getSubmissionUploadWithLock(submissionUploadId);

    const currentReviewStatus = await this.submissionUploadReviewStatusService.getSubmissionUploadReviewStatus(
      submissionUploadId
    );

    if (data.status === 'approved') {
      return this.approveSubmissionUpload(upload, currentReviewStatus);
    }

    return this.recordNonApprovalStatus(upload.submission_upload_id, data.status);
  }

  /**
   * Validate and apply an approval, or return the existing decision idempotently.
   *
   * @param {SubmissionUpload} upload Locked submission upload.
   * @param {SubmissionUploadReviewStatus} currentReviewStatus Current review decision.
   * @returns {Promise<SubmissionUploadReviewStatus>} Approved review status.
   * @memberof SubmissionUploadService
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

    // Feature activation changes the graph consumed by authorization. Remove the prior derived snapshot
    // in the same transaction so readers can never combine newly-active features with stale closure
    // self-loops. Until the asynchronous rebuild commits, canonical authorization fails closed.
    await this.submissionFeatureClosureService.invalidateClosureForSubmission(upload.submission_id);

    const approvedStatus = await this.submissionUploadReviewStatusService.insertSubmissionUploadReviewStatus({
      submission_upload_id: upload.submission_upload_id,
      status: 'approved'
    });

    await this.publishSubmissionFeatureClosure(upload, approvedStatus.submission_upload_status_id);
    return approvedStatus;
  }

  /**
   * Queue closure recomputation for one approved feature-state revision.
   *
   * @param {SubmissionUpload} upload Approved submission upload.
   * @param {number} closureRevision Review-status revision used to make the queued job idempotent.
   * @returns {Promise<void>} Resolves after the closure recomputation job has been queued transactionally.
   * @memberof SubmissionUploadService
   */
  private async publishSubmissionFeatureClosure(upload: SubmissionUpload, closureRevision: number): Promise<void> {
    await SubmissionUploadService.dependencies.publishComputeSubmissionFeatureClosureJob(
      this.connection,
      {
        submissionUploadId: upload.submission_upload_id
      },
      { singletonKey: `closure-recompute-${upload.submission_upload_id}-${closureRevision}` }
    );
  }

  /**
   * Persist a non-approval decision.
   *
   * @param {string} submissionUploadId Locked submission upload identifier.
   * @param {Exclude<UpdateSubmissionUploadReviewStatus['status'], 'approved'>} status Requested decision.
   * @returns {Promise<SubmissionUploadReviewStatus>} Persisted review status.
   * @memberof SubmissionUploadService
   */
  private async recordNonApprovalStatus(
    submissionUploadId: string,
    status: Exclude<UpdateSubmissionUploadReviewStatus['status'], 'approved'>
  ): Promise<SubmissionUploadReviewStatus> {
    return this.submissionUploadReviewStatusService.insertSubmissionUploadReviewStatus({
      submission_upload_id: submissionUploadId,
      status
    });
  }

  /**
   * Assert that upload processing and automated validation have completed before feature activation.
   *
   * @param {SubmissionUpload} upload Locked submission upload.
   * @returns {Promise<void>} Resolves when processing and automated validation permit approval.
   * @memberof SubmissionUploadService
   */
  private async assertSubmissionUploadCanBeApproved(upload: SubmissionUpload): Promise<void> {
    if (upload.status !== 'indexed') {
      throw new HTTP400('Submission upload must be indexed before approval');
    }

    if (upload.successor_submission_upload_id) {
      throw new HTTP400('Submission upload has been superseded by a newer upload');
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
   * @returns {Promise<void>} Resolves after the active submission upload has been soft-deleted.
   * @memberof SubmissionUploadService
   */
  async softDeleteSubmissionUpload(submissionUploadId: string): Promise<void> {
    await this.assertSubmissionUploadCanBeChanged(submissionUploadId);
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
    await this.submissionUploadRepository.lockSubmissionUploadsForSubmissionId(submissionId);
    await this.submissionUploadReviewStatusService.assertSubmissionHasNoActivatedFeatures(submissionId);
    return this.submissionUploadRepository.softDeleteSubmissionUploadsBySubmissionId(submissionId);
  }

  /**
   * Assert that a submission upload can still be changed or removed.
   *
   * The upload row is locked before checking review status, matching approval lock ordering and
   * preventing a concurrent approval from racing the immutability check.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<void>} Resolves when the locked upload remains mutable.
   * @throws {HTTP409} When the upload has already been approved.
   * @memberof SubmissionUploadService
   */
  private async assertSubmissionUploadCanBeChanged(submissionUploadId: string): Promise<void> {
    await this.getSubmissionUploadWithLock(submissionUploadId);
    await this.submissionUploadReviewStatusService.assertSubmissionUploadHasNoActivatedFeatures(submissionUploadId);
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
   * @returns {Promise<void>} Resolves after the upload, review status, and dedicated team are retired.
   * @throws {HTTP409} If the upload has already been reviewed.
   * @memberof SubmissionUploadService
   */
  async deleteSubmissionUpload(submissionUuid: string, submissionUploadId: string): Promise<void> {
    const submissionUpload = await this.getSubmissionUploadBySubmissionUuid(submissionUuid, submissionUploadId);
    await this.assertSubmissionUploadCanBeChanged(submissionUploadId);
    const reviewStatus = await this.submissionUploadReviewStatusService.getSubmissionUploadReviewStatus(
      submissionUploadId
    );

    if (reviewStatus.status !== 'submitted') {
      throw new HTTP409(
        `Cannot delete a submission upload with status "${reviewStatus.status}". Only uploads with status "submitted" may be deleted.`
      );
    }

    // Record the status directly rather than routing through updateSubmissionUploadReviewStatus: that
    // method drives reconciliation/activation of the upload's features, which a delete must not trigger.
    await this.submissionUploadReviewStatusService.insertSubmissionUploadReviewStatus({
      submission_upload_id: submissionUploadId,
      status: 'deleted'
    });
    await this.submissionUploadRepository.deleteSubmissionUpload(submissionUploadId);
    await this.teamService.deleteTeam(submissionUpload.team_id);
  }
}
