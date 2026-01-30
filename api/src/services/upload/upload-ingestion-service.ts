import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import dayjs from 'dayjs';
import { HTTP401 } from '../../errors/http-error';
import { ArtifactStatusEnum } from '../../models/artifact';
import { ProcessStatusStatusEnum } from '../../models/process-status';
import { SecurityStatusEnum } from '../../models/security-status';
import { Upload, UploadStatusEnum } from '../../models/upload';
import { publishMalwareScanJob } from '../../queue/publisher';
import { ICreateSubmission } from '../../repositories/submission-repository';
import { getSecurityObjectStoreBucketName, getSecurityS3Client } from '../../utils/file-utils';
import { generateMultipartUploadPresignedUrls } from '../../utils/submission-upload-utils';
import { DBService } from '../db-service';
import { SubmissionService } from '../submission-service';
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

  /**
   * Create a new archive upload
   *
   * @param {number} bytes
   * @param {ICreateSubmission} submission
   * @returns {Promise<PresignedUploadUrlResponse>}
   */
  async startArchiveUpload(bytes: number, submission: ICreateSubmission): Promise<PresignedUploadUrlResponse> {
    // 1. Create submission (intent)
    const { submission_id } = await this.submissionService.insertSubmissionRecord(submission);

    // 2. Create upload session
    const { upload_id } = await this.uploadService.insertUpload({
      upload_status: UploadStatusEnum.PENDING,
      record_end_date: dayjs().add(30, 'minute').toISOString(),
      s3_upload_id: null
    });

    // 3. Bind submission → upload
    await this.submissionUploadService.insertSubmissionUpload({
      submission_id,
      upload_id
    });

    // 4. Create placeholder artifact for archive
    const key = `submissions/${submission_id}/uploads/${upload_id}.tar`;
    const artifact = await this.artifactService.insertArtifact({
      bucket: getSecurityObjectStoreBucketName(),
      artifact_status: ArtifactStatusEnum.PENDING,
      object_key: key,
      byte_size: bytes,
      checksum_sha256: null,
      uploaded_at: null
    });

    // 5. Create upload_archive metadata
    const { upload_archive_id } = await this.uploadArchiveService.insertUploadArchive({
      upload_id,
      artifact_id: artifact.artifact_id,
      archive_status: ProcessStatusStatusEnum.DRAFT // Draft indicates that the archive record is not ready for processing
    });

    // 6. Initialize multipart upload
    const {
      uploadId: s3UploadId,
      presignedUrls,
      partSizeBytes,
      partCount
    } = await generateMultipartUploadPresignedUrls({
      key,
      contentType: 'application/x-tar',
      bytes
    });

    // 7. Persist S3 upload ID
    await this.uploadService.updateUpload(upload_id, { s3_upload_id: s3UploadId });

    return {
      submissionId: submission_id,
      uploadId: upload_id,
      uploadArchiveId: upload_archive_id,
      s3UploadId,
      key,
      partSizeBytes,
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
    const s3Client = getSecurityS3Client();
    await s3Client.send(
      new CompleteMultipartUploadCommand({
        Bucket: getSecurityObjectStoreBucketName(),
        Key: key,
        UploadId: s3UploadId,
        MultipartUpload: { Parts: parts }
      })
    );

    // 7. Publish malware scan jobs for each artifact_security record
    await Promise.all(
      securityRecords.map((record) => publishMalwareScanJob({ artifactSecurityId: record.artifact_security_id }))
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
