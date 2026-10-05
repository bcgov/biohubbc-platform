import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import dayjs from 'dayjs';
import { v4 } from 'uuid';
import { ArtifactStatusEnum } from '../../models/artifact';
import { ProcessStatusStatusEnum } from '../../models/process-status';
import { SecurityStatusEnum } from '../../models/security-status';
import {
  CreateExistingSubmissionArchiveUploadInput,
  CreateSubmissionArchiveUploadInput,
  SubmissionUploadSubmitter
} from '../../models/submission-upload';
import { UploadStatusEnum } from '../../models/upload';
import { publishMalwareScanJob } from '../../queue/publisher';
import { ICreateSubmission } from '../../repositories/submission-repository';
import { getSecurityObjectStoreBucketName, getSecurityS3Client } from '../../utils/file-utils';
import { generateMultipartUploadPresignedUrls } from '../../utils/submission-upload-utils';
import { DBService } from '../db-service';
import { SubmissionService } from '../submission-service';
import { TicketService } from '../ticket-service';
import { UserService } from '../user-service';
import { ArtifactSecurityService } from './artifact-security-service';
import { ArtifactService } from './artifact-service';
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
  artifactSecurityService = new ArtifactSecurityService(this.connection);
  ticketService = new TicketService(this.connection);
  userService = new UserService(this.connection);

  /**
   * Resolve submitters and create a submission upload for the authorized contributor.
   * @param {CreateSubmissionArchiveUploadInput} input - Validated submission request with the contributor ID resolved by authorization middleware.
   * @return {Promise<PresignedUploadUrlResponse>} Multipart upload resources.
   * @memberof UploadIngestionService
   */
  async createSubmissionArchiveUpload(input: CreateSubmissionArchiveUploadInput): Promise<PresignedUploadUrlResponse> {
    const systemUserId = this.connection.systemUserId();
    const submitterSystemUserIds = await this.resolveSubmissionUploadSubmitters(input.submitters ?? []);
    const submission: ICreateSubmission = {
      uuid: v4(),
      system_user_id: systemUserId,
      contributor_id: input.contributorId,
      name: input.name,
      description: input.description,
      comment: input.comment
    };
    return this.startArchiveUpload(input.bytes, submission, submitterSystemUserIds, input.blueprintId);
  }

  /**
   * Resolve additional team members once per identity GUID.
   * @param {SubmissionUploadSubmitter[]} submitters - Requested additional submitters.
   * @return {Promise<number[]>} System user identifiers for submission and upload teams.
   * @memberof UploadIngestionService
   */
  private async resolveSubmissionUploadSubmitters(submitters: SubmissionUploadSubmitter[]): Promise<number[]> {
    const resolvedGuids = new Set<string>();
    const uniqueSubmitters = submitters.filter(({ guid }) => {
      const normalizedGuid = guid.toLowerCase();
      if (resolvedGuids.has(normalizedGuid)) {
        return false;
      }
      resolvedGuids.add(normalizedGuid);
      return true;
    });

    // Finish all work on the shared connection before the caller can roll back or release it.
    const results = await Promise.allSettled(
      uniqueSubmitters.map(async ({ guid, identifier, identitySource }) => {
        const submitter = await this.userService.ensureSystemUser(guid, identifier, identitySource);
        return submitter.system_user_id;
      })
    );

    return results.map((result) => {
      if (result.status === 'rejected') {
        throw result.reason;
      }
      return result.value;
    });
  }

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
   * Requires prior middleware authorization for submission-team access or administrator access.
   * Validates owning-contributor membership before changing the submission.
   * Resolves additional submitters and adds them to both teams.
   * The Blueprint defaults to the submission's most recent prior upload Blueprint when omitted.
   *
   * @param {CreateExistingSubmissionArchiveUploadInput} input - Submission UUID, archive size, optional
   * submitter identities, and optional Blueprint selection.
   * @returns {Promise<PresignedUploadUrlResponse>}
   * @throws {ApiNotFoundError} If no submission exists for the given UUID (mapped to 404 by error handler).
   * @memberof UploadIngestionService
   */
  async startArchiveUploadForExistingSubmissionByUuid(
    input: CreateExistingSubmissionArchiveUploadInput
  ): Promise<PresignedUploadUrlResponse> {
    const { bytes, submissionUuid, blueprintId } = input;
    await this.submissionService.assertSubmissionContributorWriteAccess(submissionUuid);
    const byUuid = await this.submissionService.getSubmissionIdByUUID(submissionUuid);
    const submissionRecord = await this.submissionService.getSubmissionRecordBySubmissionId(byUuid.submission_id);

    const authenticatedSystemUserId = this.connection.systemUserId();
    const submitterSystemUserIds = await this.resolveSubmissionUploadSubmitters(input.submitters ?? []);
    const submissionTeamSystemUserIds = [authenticatedSystemUserId, ...submitterSystemUserIds];
    await this.submissionService.addSubmissionTeamMembers(submissionRecord.team_id, submissionTeamSystemUserIds);

    return this._startArchiveUploadForSubmission(
      bytes,
      byUuid.submission_id,
      submissionRecord.uuid,
      [authenticatedSystemUserId],
      submitterSystemUserIds,
      submissionRecord.comment ?? null,
      blueprintId
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

    // 4. Create placeholder artifact for archive
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

    // 5. Create upload_archive metadata
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
   * archive artifact(s) for malware scanning. The endpoint must first authorize the upload
   * creator and owning contributor through the Upload discriminator.
   *
   * @param {CompleteMultipartUploadParams} params
   * @returns {Promise<void>}
   */
  async completeArchiveUpload(params: CompleteMultipartUploadParams): Promise<void> {
    const { uploadId, s3UploadId, key, parts } = params;

    // 1. Validate multipart identity and upload state after middleware authorization
    await this.uploadService.validateUploadCompletion(uploadId, s3UploadId);

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
}
