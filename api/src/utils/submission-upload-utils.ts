import { CreateMultipartUploadCommand, UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { _getQuarantineObjectStoreBucketName, _getQuarantineS3Client } from './file-utils';
import { MultipartUploadParams, MultipartUploadResult } from './submission-upload-utils.interface';

const MIN_PART_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_PARTS = 10000;

/**
 * Generate a presigned upload URL that clients can use to write data to S3 directly, bypassing the API
 *
 * @param {MultipartUploadParams} params
 * @export
 * @return {*}
 */
export async function generateMultipartUploadPresignedUrls(
  params: MultipartUploadParams
): Promise<MultipartUploadResult> {
  const { key, contentType, expectedSizeBytes } = params;

  const partSizeBytes = Math.max(MIN_PART_SIZE, Math.ceil(expectedSizeBytes / MAX_PARTS));
  const partCount = Math.ceil(expectedSizeBytes / partSizeBytes);

  const s3Client = _getQuarantineS3Client();

  // Create multipart upload
  const { UploadId } = await s3Client.send(
    new CreateMultipartUploadCommand({
      Bucket: _getQuarantineObjectStoreBucketName(),
      Key: key,
      ContentType: contentType
    })
  );

  if (!UploadId) {
    throw new Error('Failed to create multipart upload');
  }

  // Generate presigned URLs for all parts
  const presignedUrls = await Promise.all(
    Array.from({ length: partCount }, async (_, i) => {
      const partNumber = i + 1;
      const uploadPartCommand = new UploadPartCommand({
        Bucket: _getQuarantineObjectStoreBucketName(),
        Key: key,
        UploadId,
        PartNumber: partNumber
      });

      const url = await getSignedUrl(s3Client, uploadPartCommand, {
        expiresIn: 3600
      });

      return { partNumber, url };
    })
  );

  return {
    uploadId: UploadId,
    presignedUrls,
    partSizeBytes,
    partCount
  };
}
