import { CreateMultipartUploadCommand, UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { _getObjectStoreBucketName, _getS3Client } from './file-utils';

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

  const PART_SIZE = 100 * 1024 * 1024;
  const partCount = Math.ceil(expectedSizeBytes / PART_SIZE);

  const s3Client = _getS3Client();

  // Create multipart upload
  const createUploadResp = await s3Client.send(
    new CreateMultipartUploadCommand({
      Bucket: _getObjectStoreBucketName(),
      Key: key,
      ContentType: contentType
    })
  );

  const uploadId = createUploadResp.UploadId;
  if (!uploadId) {
    throw new Error('Failed to create multipart upload');
  }

  // Generate presigned URLs for all parts
  const presignedUrls = await Promise.all(
    Array.from({ length: partCount }, async (_, i) => {
      const partNumber = i + 1;
      const uploadPartCommand = new UploadPartCommand({
        Bucket: _getObjectStoreBucketName(),
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber
      });

      const url = await getSignedUrl(s3Client, uploadPartCommand, {
        expiresIn: 3600
      });

      return { partNumber, url };
    })
  );

  return {
    uploadId,
    presignedUrls,
    partSizeBytes: PART_SIZE,
    partCount
  };
}
