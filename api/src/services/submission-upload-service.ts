import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { IDBConnection } from '../database/db';
import { QuarantineStatusEnum } from '../models/quarantine';
import { ArtifactRepository } from '../repositories/artifact-repository';
import { _getQuarantineObjectStoreBucketName, _getQuarantineS3Client } from '../utils/file-utils';
import { generateMultipartUploadPresignedUrls } from '../utils/submission-upload-utils';
import { DBService } from './db-service';
import { QuarantineService } from './quarantine-service';
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
   * Completes a multipart upload and triggers malware scan
   *
   * @param {CompleteMultipartUploadParams} params
   */
  async completeMultipartUpload(params: CompleteMultipartUploadParams) {
    const { uploadId, key, parts, quarantineId } = params;
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

    // Update quarantine record with S3 URI and change status to trigger scan
    await this.quarantineService.updateQuarantineRecord(quarantineId, {
      uri: s3Uri,
      status: QuarantineStatusEnum.PENDING
    });

    // Generate UUID for submission
    const submissionUuid = uuidv4();

    // Insert the submission record (linked to quarantine)
    const submission = await this.submissionService.insertSubmissionRecordWithPotentialConflict({
      uuid: submissionUuid,
      quarantine_id: quarantineId,
      name: submissionMetadata.name,
      description: submissionMetadata.description,
      comment: submissionMetadata.comment || '',
      system_user_id: this.connection.systemUserId(),
      system_user_identifier: this.connection.systemUserIdentifier()
    });

    return {
      success: true,
      quarantineId,
      submissionId: submission.submission_id,
      submissionUuid,
      location: result.Location,
      bucket: result.Bucket,
      key: result.Key,
      etag: result.ETag
    };
  }
}
