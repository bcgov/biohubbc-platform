import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import dayjs from 'dayjs';
import { HTTP401 } from '../../errors/http-error';
import { ArtifactStatusEnum } from '../../models/artifact';
import { ProcessStatusStatusEnum } from '../../models/process-status';
import { Upload, UploadStatusEnum } from '../../models/upload';
import { ICreateSubmission } from '../../repositories/submission-repository';
import { getQuarantineObjectStoreBucketName, getQuarantineS3Client } from '../../utils/file-utils';
import { generateMultipartUploadPresignedUrls } from '../../utils/submission-upload-utils';
import { DBService } from '../db-service';
import { SubmissionService } from '../submission-service';
import { ArtifactService } from './artifact-service';
import { SubmissionUploadService } from './submission-upload-service';
import { UploadArchiveService } from './upload-archive-service';
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
  artifactService = new ArtifactService(this.connection);
  uploadArchiveService = new UploadArchiveService(this.connection);
  submissionUploadService = new SubmissionUploadService(this.connection);

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
      status: UploadStatusEnum.PENDING,
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
      bucket: getQuarantineObjectStoreBucketName(),
      status: ArtifactStatusEnum.PENDING,
      object_key: key,
      byte_size: bytes,
      checksum_sha256: null,
      uploaded_at: null
    });

    // 5. Create upload_archive metadata
    const { upload_archive_id } = await this.uploadArchiveService.insertUploadArchive({
      upload_id,
      artifact_id: artifact.artifact_id,
      status: ProcessStatusStatusEnum.DRAFT
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
   * Finalize a multipart upload after all parts have been uploaded.
   *
   * @param {CompleteMultipartUploadCommand} params
   * @returns {Promise<void>}
   */
  async completeArchiveUpload(params: CompleteMultipartUploadParams): Promise<void> {
    const { uploadId, s3UploadId, key, parts } = params;

    await Promise.all([
      // 1. Authorize upload completion - the whole transaction will roll back if authorization fails
      this._authorizeUploadCompletion(uploadId, s3UploadId),
      // 2. Update upload as COMPLETED to prevent re-use
      this.uploadService.updateUpload(uploadId, {
        status: UploadStatusEnum.COMPLETED
      }),
      // 3. Update artifacts as PENDING to trigger processing -> background worker must scan for malware
      this.artifactService.updateArtifactsByUploadId(uploadId, {
        uploaded_at: dayjs().toISOString(),
        status: ArtifactStatusEnum.PENDING
      }),
      // 4. Mark archive as PENDING to trigger processing -> background worker must open the archive and index files
      this.uploadArchiveService.updateUploadArchivesByUploadId(uploadId, {
        status: ProcessStatusStatusEnum.PENDING
      })
    ]);

    // 5. Complete multipart upload in S3
    const s3Client = getQuarantineS3Client();
    await s3Client.send(
      new CompleteMultipartUploadCommand({
        Bucket: getQuarantineObjectStoreBucketName(),
        Key: key,
        UploadId: s3UploadId,
        MultipartUpload: { Parts: parts }
      })
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
      upload.status === UploadStatusEnum.PENDING;

    // If any of the above checks fail, the caller is unauthorized
    if (!authorized) {
      throw new HTTP401('Access Denied');
    }

    // Return the upload record for further processing
    return upload;
  }
}
