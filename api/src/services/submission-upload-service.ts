import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { v4 } from 'uuid';
import { IDBConnection } from '../database/db';
import { HTTP400, HTTP403 } from '../errors/http-error';
import { QuarantineStatusEnum } from '../models/quarantine';
import { ArtifactRepository } from '../repositories/artifact-repository';
import { _getQuarantineObjectStoreBucketName, _getQuarantineS3Client } from '../utils/file-utils';
import { generateMultipartUploadPresignedUrls } from '../utils/submission-upload-utils';
import { DBService } from './db-service';
import { QuarantineService } from './quarantine/quarantine-service';
import { SubmissionService } from './submission-service';
import { CompleteMultipartUploadParams, PresignedUploadUrlResponse } from './submission-upload-service.interface';

export class SubmissionUploadService extends DBService {
  submissionService: SubmissionService;
  quarantineService: QuarantineService;
  artifactRepository: ArtifactRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionService = new SubmissionService(connection);
    this.quarantineService = new QuarantineService(connection);
    this.artifactRepository = new ArtifactRepository(connection);
  }

  /**
   * Authorizes an upload completion request by verifying:
   * - The quarantine record exists
   * - The uploadId matches the stored upload_id
   * - The quarantine is in draft status
   * - The user owns the quarantine record
   *
   * @param {string} quarantineId
   * @param {string} uploadId
   * @throws {HTTP404} If quarantine record not found
   * @throws {HTTP403} If uploadId doesn't match or user doesn't own the record
   * @throws {HTTP400} If quarantine is not in draft status
   * @memberof SubmissionUploadService
   */
  async authorizeUpload(quarantineId: string, uploadId: string): Promise<void> {
    const quarantine = await this.quarantineService.getQuarantineRecord(quarantineId);

    // Verify the uploadId matches
    if (!quarantine.upload_id || quarantine.upload_id !== uploadId) {
      throw new HTTP403('Upload ID does not match quarantine record');
    }

    // Verify the quarantine is in draft status (hasn't been completed yet)
    if (quarantine.status !== QuarantineStatusEnum.DRAFT) {
      throw new HTTP400('Quarantine upload has already been completed or is in an invalid state');
    }
  }

  /**
   * Initializes a new multipart upload for a .tar file associated with a submission
   *
   * @param {number} expectedSizeBytes
   * @returns {Promise<PresignedUploadUrlResponse>}
   */
  async getTarUploadPresignedUrls(expectedSizeBytes: number): Promise<PresignedUploadUrlResponse> {
    // Generate the quarantine record with status 'draft' (waiting for upload)
    const { quarantine_id: quarantineId } = await this.quarantineService.insertQuarantineRecord({
      status: QuarantineStatusEnum.DRAFT
    });

    // Use quarantineId as the key
    const key = `quarantine/${quarantineId}.tar`;
    const contentType = 'application/x-tar';

    // Generate multipart upload
    const { uploadId, presignedUrls, partSizeBytes, partCount } = await generateMultipartUploadPresignedUrls({
      key,
      contentType,
      expectedSizeBytes
    });

    // Update the quarantine record with the uploadId
    await this.quarantineService.updateQuarantineRecord(quarantineId, {
      upload_id: uploadId
    });

    return {
      quarantineId,
      uploadId,
      key,
      partSizeBytes,
      partCount,
      presignedUrls
    };
  }

  /**
   * Completes a multipart upload and triggers further processing
   *
   * @param {CompleteMultipartUploadParams} params
   */
  async completeMultipartUpload(params: CompleteMultipartUploadParams) {
    const { systemUserId, systemUserIdentifier, uploadId, key, parts, quarantineId, metadata } = params;
    const s3Client = _getQuarantineS3Client();
    const bucket = _getQuarantineObjectStoreBucketName();

    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((p) => ({
          PartNumber: p.partNumber,
          ETag: p.etag
        }))
      }
    });

    // Complete the S3 upload
    const result = await s3Client.send(completeCommand);
    const s3Uri = `s3://${bucket}/${key}`;

    // Update quarantine record with S3 URI and change status to PENDING to trigger malware scan
    await this.quarantineService.updateQuarantineRecord(quarantineId, {
      uri: s3Uri,
      status: QuarantineStatusEnum.PENDING
    });

    // Insert the submission record (linked to quarantine)
    const submission = await this.submissionService.insertSubmissionRecordWithPotentialConflict({
      uuid: metadata.uid ?? v4(),
      quarantine_id: quarantineId,
      name: metadata.name,
      description: metadata.description,
      comment: metadata.comment,
      system_user_id: systemUserId,
      system_user_identifier: systemUserIdentifier
    });

    return {
      quarantineId,
      submissionId: submission.submission_id,
      location: result.Location,
      bucket: result.Bucket,
      key: result.Key,
      etag: result.ETag
    };
  }
}
