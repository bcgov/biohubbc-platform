import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { v4 } from 'uuid';
import { IDBConnection } from '../database/db';
import { ArtifactRepository } from '../repositories/artifact-repository';
import { _getQuarantineObjectStoreBucketName, _getQuarantineS3Client } from '../utils/file-utils';
import { generateMultipartUploadPresignedUrls } from '../utils/submission-upload-utils';
import { SubmissionService } from './submission-service';
import { CompleteMultipartUploadParams, PresignedUploadUrlResponse } from './submission-upload-service.interface';

export class SubmissionUploadService {
  submissionService: SubmissionService;
  artifactRepository: ArtifactRepository;

  constructor(connection: IDBConnection) {
    this.submissionService = new SubmissionService(connection);
    this.artifactRepository = new ArtifactRepository(connection);
  }

  /**
   * Initializes a new multipart upload for a .tar file associated with a submission
   *
   * @param {number} expectedSizeBytes
   * @returns {Promise<PresignedUploadUrlResponse>}
   */
  async getTarUploadPresignedUrls(expectedSizeBytes: number): Promise<PresignedUploadUrlResponse> {
    // TODO: Generate a submission record stub with status = 'REQUESTED' and use its ID, instead of v4()
    const submissionId = v4();

    const key = `submissions/${submissionId}.tar`;
    const contentType = 'application/x-tar';

    // Generate multipart upload
    const { uploadId, presignedUrls, partSizeBytes, partCount } = await generateMultipartUploadPresignedUrls({
      key,
      contentType,
      expectedSizeBytes
    });

    return {
      uploadId,
      key,
      partSizeBytes,
      partCount,
      presignedUrls
    };
  }

  /**
   * Completes a multipart upload
   *
   * @param {CompleteMultipartUploadParams} params
   */
  async completeMultipartUpload(params: CompleteMultipartUploadParams) {
    const { uploadId, key, parts } = params;

    const s3Client = _getQuarantineS3Client();

    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: _getQuarantineObjectStoreBucketName(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((p) => ({
          PartNumber: p.partNumber,
          ETag: p.etag
        }))
      }
    });

    const result = await s3Client.send(completeCommand);

    return {
      success: true,
      location: result.Location,
      bucket: result.Bucket,
      key: result.Key,
      etag: result.ETag
    };
  }
}
