import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import dayjs from 'dayjs';
import { SYSTEM_ROLE } from '../../constants/roles';
import { HTTP401, HTTP403 } from '../../errors/http-error';
import { ArtifactStatusEnum } from '../../models/artifact';
import { ProcessStatusStatusEnum } from '../../models/process-status';
import { SecurityStatusEnum } from '../../models/security-status';
import { Upload, UploadStatusEnum } from '../../models/upload';
import { publishMalwareScanJob } from '../../queue/publisher';
import { ICreateSubmission } from '../../repositories/submission-repository';
import { getSecurityObjectStoreBucketName, getSecurityS3Client } from '../../utils/file-utils';
import { generateMultipartUploadPresignedUrls } from '../../utils/submission-upload-utils';
import { TeamAuthorizationService } from '../authorization/team-authorization-service';
import { DBService } from '../db-service';
import { SubmissionService } from '../submission-service';
import { TicketService } from '../ticket-service';
import { UserService } from '../user-service';
import { ArtifactSecurityService } from './artifact-security-service';
import { ArtifactService } from './artifact-service';
import { SubmissionUploadReviewService } from './submission-upload-review-service';
import { SubmissionUploadReviewStatusService } from './submission-upload-review-status-service';
import { SubmissionUploadService } from './submission-upload-service';
import { UploadArchiveService } from './upload-archive-service';
import { UploadArtifactService } from './upload-artifact-service';
import { CompleteMultipartUploadParams, PresignedUploadUrlResponse } from './upload-ingestion-service.interface';
import { UploadService } from './upload-service';

/**
 * Service responsible for ingesting archive-based uploads.
 *
 * Responsibilities:
 * - Create submission + upload intent
 * - Initialize multipart archive uploads
 * - Finalize uploads after client completion
 */
export class UploadIngestionService extends DBService {
  submissionService = new SubmissionService(this.connection);
  uploadService = new UploadService(this.connection);
  uploadArtifactService = new UploadArtifactService(this.connection);
  artifactService = new ArtifactService(this.connection);
  uploadArchiveService = new UploadArchiveService(this.connection);
  submissionUploadService = new SubmissionUploadService(this.connection);
  submissionUploadReviewService = new SubmissionUploadReviewService(this.connection);
  submissionUploadReviewStatusService = new SubmissionUploadReviewStatusService(this.connection);
  artifactSecurityService = new ArtifactSecurityService(this.connection);
  ticketService = new TicketService(this.connection);
  teamAuthorizationService = new TeamAuthorizationService(this.connection);
  userService = new UserService(this.connection);

  /**
   * Mutable dependency bag used by tests to avoid stubbing module namespace exports under ESM.
   */
  static readonly dependencies = {
    publishMalwareScanJob,
    generateMultipartUploadPresignedUrls,
    getSecurityS3Client,
    getSecurityObjectStoreBucketName
  };

  /**
   * Create a new archive upload along with a new submission record.
   *
   * @param {number} bytes
   * @param {ICreateSubmission} submission
   * @param {number[]} [submitterSystemUserIds] Optional additional people who may access this submission and upload.
   * @param {number | null} [requestedBlueprintId] Optional Blueprint to pin the upload to; defaults to
   * the system default Blueprint when omitted (new submissions have no prior upload to inherit from).
   * @returns {Promise<PresignedUploadUrlResponse>}
   */
  async startArchiveUpload(
    bytes: number,
    submission: ICreateSubmission,
    submitterSystemUserIds: number[] = [],
    requestedBlueprintId?: number | null
  ): Promise<PresignedUploadUrlResponse> {
    // 1. Create submission (intent) and its upload-creation team.
    const { submission_id } = await this.submissionService.insertSubmissionRecord(submission, submitterSystemUserIds);

    // 2. Use UUID from submission table only (not submission_upload or submission_upload_status)
    const submissionRecord = await this.submissionService.getSubmissionRecordBySubmissionId(submission_id);
    const submissionUuidFromTable = submissionRecord.uuid;

    return this._startArchiveUploadForSubmission(
      bytes,
      submission_id,
      submissionUuidFromTable,
      [submission.system_user_id],
      submitterSystemUserIds,
      submission.comment,
      requestedBlueprintId
    );
  }

  /**
   * Create a new archive upload for an existing submission (append mode).
   * Does not create a new submission record. Identifies submission by UUID.
   *
   * @param {number} bytes
   * @param {string} submissionUuid - Submission UUID (submission.uuid).
   * @param {number[]} [submitterSystemUserIds] Optional additional people who may access this submission and upload.
   * @param {number | null} [requestedBlueprintId] Optional Blueprint to pin the upload to; defaults to
   * the submission's most recent prior upload Blueprint when omitted.
   * @returns {Promise<PresignedUploadUrlResponse>}
   * @throws {ApiNotFoundError} If no submission exists for the given UUID (mapped to 404 by error handler).
   */
  async startArchiveUploadForExistingSubmissionByUuid(
    bytes: number,
    submissionUuid: string,
    submitterSystemUserIds: number[] = [],
    requestedBlueprintId?: number | null
  ): Promise<PresignedUploadUrlResponse> {
    const byUuid = await this.submissionService.getSubmissionIdByUUID(submissionUuid);
    const submissionRecord = await this.submissionService.getSubmissionRecordBySubmissionId(byUuid.submission_id);

    const authenticatedSystemUserId = this.connection.systemUserId();
    const authenticatedUser = await this.userService.getUserById(authenticatedSystemUserId);
    const isSystemAdministrator = authenticatedUser.role_names.includes(SYSTEM_ROLE.SYSTEM_ADMIN);
    const canCreateUpload =
      isSystemAdministrator ||
      (await this.teamAuthorizationService.isUserAuthorizedForTeamEntity(authenticatedSystemUserId, {
        entity: 'submission',
        submissionId: byUuid.submission_id
      }));

    if (!canCreateUpload) {
      throw new HTTP403('Authenticated user is not authorized to create an upload for this submission');
    }

    const submissionTeamSystemUserIds = [authenticatedSystemUserId, ...submitterSystemUserIds];
    await this.submissionService.addSubmissionTeamMembers(submissionRecord.team_id, submissionTeamSystemUserIds);

    return this._startArchiveUploadForSubmission(
      bytes,
      byUuid.submission_id,
      submissionRecord.uuid,
      [authenticatedSystemUserId],
      submitterSystemUserIds,
      submissionRecord.comment ?? null,
      requestedBlueprintId
    );
  }

  /**
   * Internal helper: creates a new upload session, submission_upload record, review status,
   * artifact, upload_archive, and presigned URLs for the given submissionId.
   *
   * @param {number} bytes
   * @param {number} submissionId - Integer PK for DB operations
   * @param {string} submissionUuid - Submission UUID; used when building the response.
   * @param {number[]} systemUserIds - System users to associate with the upload's ticket.
   * @param {number[]} submitterSystemUserIds - Additional users to add to the upload's dedicated
   * access team. The authenticated requestor is always added by the upload service.
   * @param {string | null} [comment] - Optional upload comment.
   * @param {number | null} [requestedBlueprintId] - Optional Blueprint to pin the upload to; resolved
   * to provided → most recent prior upload → system default.
   * @returns {Promise<PresignedUploadUrlResponse>}
   */
  async _startArchiveUploadForSubmission(
    bytes: number,
    submissionId: number,
    submissionUuid: string,
    systemUserIds: number[],
    submitterSystemUserIds: number[],
    comment?: string | null,
    requestedBlueprintId?: number | null
  ): Promise<PresignedUploadUrlResponse> {
    // 0. Pin the Blueprint this upload will be indexed with (provided → prior upload → default).
    const blueprint_id = await this.submissionUploadService.resolveBlueprintIdForUpload(
      submissionId,
      requestedBlueprintId
    );

    // 1. Create upload session
    const { upload_id } = await this.uploadService.insertUpload({
      upload_status: UploadStatusEnum.PENDING,
      record_end_date: dayjs().add(30, 'minute').toISOString(),
      s3_upload_id: null
    });

    // 2. Create ticket for admin visibility into this upload
    const ticket = await this.ticketService.createTicket({
      subject: 'New Submission',
      description: `Submission ID: ${submissionId}. Submission UUID: ${submissionUuid}. Upload UUID: ${upload_id}`,
      priority: 'medium',
      systemUserIds
    });

    // 3. Bind submission → upload. The service creates its dedicated access team.
    const { submission_upload_id } = await this.submissionUploadService.insertSubmissionUpload(
      {
        submission_id: submissionId,
        upload_id,
        ticket_id: ticket.ticket_id,
        status: 'uploaded',
        blueprint_id,
        comment: comment ?? null
      },
      this.connection.systemUserId(),
      submitterSystemUserIds
    );

    // 4. Create pending validation/security review tasks for this upload
    await this.submissionUploadReviewService.createDefaultReviewsForUpload(
      submissionId,
      submission_upload_id,
      this.connection.systemUserId()
    );

    // 5. Create initial review status (submitted = unreviewed)
    await this.submissionUploadReviewStatusService.insertSubmissionUploadReviewStatus({
      submission_upload_id,
      status: 'submitted'
    });

    // 6. Create placeholder artifact for archive
    const key = `submissions/${submissionId}/uploads/${upload_id}.tar`;
    const artifact = await this.artifactService.insertArtifact({
      bucket: getSecurityObjectStoreBucketName(),
      artifact_status: ArtifactStatusEnum.PENDING,
      object_key: key,
      byte_size: bytes,
      checksum_sha256: null,
      uploaded_at: null,
      format: 'tar'
    });

    // 7. Create upload_archive metadata
    const { upload_archive_id } = await this.uploadArchiveService.insertUploadArchive({
      upload_id,
      artifact_id: artifact.artifact_id,
      archive_status: ProcessStatusStatusEnum.DRAFT
    });

    // 8. Initialize multipart upload
    const {
      uploadId: s3UploadId,
      presignedUrls,
      partCount
    } = await UploadIngestionService.dependencies.generateMultipartUploadPresignedUrls({
      key,
      contentType: 'application/x-tar',
      bytes
    });

    // 9. Persist S3 upload ID
    await this.uploadService.updateUpload(upload_id, { s3_upload_id: s3UploadId });

    // 10. Return the submission UUID for client use.
    return {
      submissionUuid,
      submissionUploadId: submission_upload_id,
      uploadId: upload_id,
      uploadArchiveId: upload_archive_id,
      s3UploadId,
      key,
      partCount,
      presignedUrls
    };
  }

  /**
   * Finalize a multipart archive upload after all parts have been uploaded.
   *
   * This completes the upload in the security bucket and enqueues the
   * archive artifact(s) for malware scanning.
   *
   * @param {CompleteMultipartUploadParams} params
   * @returns {Promise<void>}
   */
  async completeArchiveUpload(params: CompleteMultipartUploadParams): Promise<void> {
    const { uploadId, s3UploadId, key, parts } = params;

    // 1. Ensure the caller is allowed to complete this upload
    await this._authorizeUploadCompletion(uploadId, s3UploadId);

    // Update upload status, artifact statuses, and create security records
    const [, , securityRecords] = await Promise.all([
      // 2. Update upload status to completed
      this.uploadService.updateUpload(uploadId, {
        upload_status: UploadStatusEnum.COMPLETED
      }),
      // 3. Mark all artifacts as uploaded
      this.artifactService.updateArtifactsByUploadId(uploadId, {
        artifact_status: ArtifactStatusEnum.UPLOADED,
        uploaded_at: dayjs().toISOString()
      }),
      // 4. Create artifact_security records for malware scanning
      this.artifactSecurityService.insertArtifactSecurityByUploadId(uploadId, {
        security: SecurityStatusEnum.PENDING
      }),
      // 5. Block archives for extraction until malware scan completes
      this.uploadArchiveService.updateUploadArchivesByUploadId(uploadId, {
        archive_status: ProcessStatusStatusEnum.BLOCKED
      })
    ]);

    // 6. Complete the multipart upload in the security bucket
    const s3Client = UploadIngestionService.dependencies.getSecurityS3Client();
    await s3Client.send(
      new CompleteMultipartUploadCommand({
        Bucket: UploadIngestionService.dependencies.getSecurityObjectStoreBucketName(),
        Key: key,
        UploadId: s3UploadId,
        MultipartUpload: { Parts: parts }
      })
    );

    // 7. Publish malware scan jobs for each artifact_security record
    await Promise.all(
      securityRecords.map((record) =>
        UploadIngestionService.dependencies.publishMalwareScanJob(this.connection, {
          artifactSecurityId: record.artifact_security_id
        })
      )
    );
  }

  /**
   * Ensure the caller is allowed to finalize this upload.
   *
   * @param {string} uploadId - The unique identifier for the upload in the system
   * @param {string} s3UploadId - The S3 multipart upload ID, used to verify client intent
   * @returns {Promise<Upload>} - Returns the upload record if authorization succeeds
   * @throws {HTTP401} - Throws if the caller is not authorized to complete the upload
   */
  async _authorizeUploadCompletion(uploadId: string, s3UploadId: string): Promise<Upload> {
    const upload = await this.uploadService.getUpload(uploadId);

    const now = dayjs();

    // Determine if the caller is authorized to complete the upload
    const authorized =
      // Ensure the S3 upload ID matches
      // Prevents clients from completing someone else's upload by providing a different S3 ID
      upload.s3_upload_id === s3UploadId &&
      // Ensure the caller is the same user who created the upload
      // Only the creator of the upload can finalize it
      upload.create_user === this.connection.systemUserId() &&
      // Ensure the upload is still valid (not expired)
      // Prevents completing uploads that have passed their allowed time window
      now.isBefore(upload.record_end_date) &&
      // Ensure the upload status is PENDING
      // Only uploads that are in a pending state can be finalized; completed or failed uploads cannot
      upload.upload_status === UploadStatusEnum.PENDING;

    // If any of the above checks fail, the caller is unauthorized
    if (!authorized) {
      throw new HTTP401('Access Denied');
    }

    // Return the upload record for further processing
    return upload;
  }
}
