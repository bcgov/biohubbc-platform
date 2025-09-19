import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { v4 } from 'uuid';
import { IDBConnection } from '../database/db';
import { HTTP400 } from '../errors/http-error';
import { ArtifactRepository } from '../repositories/artifact-repository';
import { _getObjectStoreBucketName, _getS3Client } from '../utils/file-utils';
import { generateMultipartUploadPresignedUrls } from '../utils/submission-upload-utils';
import { SubmissionService } from './submission-service';

const MAX_FILE_SIZE_BYTES = 1073741824;

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
   * @param expectedSizeBytes
   */
  async getTarUploadPresignedUrls(expectedSizeBytes: number) {
    // TODO: Generate a submission record stub with status = 'REQUESTED' and use its ID
    const submissionId = v4();

    if (expectedSizeBytes > MAX_FILE_SIZE_BYTES || expectedSizeBytes < 1) {
      throw new HTTP400('Invalid file size: must be between 1 byte and 1 GB');
    }

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

    const s3Client = _getS3Client();

    // Sort parts by part number to ensure correct order
    const sortedParts = parts.sort((a, b) => a.partNumber - b.partNumber);

    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: _getObjectStoreBucketName(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts.map((p) => ({
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
