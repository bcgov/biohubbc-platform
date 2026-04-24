import { CreateMultipartUploadCommand, UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  S3_MULTIPART_MAX_PARTS,
  S3_MULTIPART_MAX_PART_SIZE_BYTES,
  S3_MULTIPART_MIN_PART_SIZE_BYTES,
  UPLOAD_PART_SIZE_CAP_BYTES,
  UPLOAD_PART_SIZE_SCALE_START_BYTES,
  UPLOAD_PART_SIZE_SCALE_STEP_BYTES,
  UPLOAD_PART_SIZE_SCALE_STEP_INCREMENT_BYTES,
  UPLOAD_PRESIGNED_URL_BATCH_SIZE,
  UPLOAD_PRESIGNED_URL_EXPIRY_SECONDS,
  UPLOAD_TARGET_PART_COUNT
} from '../constants/upload';
import { getSecurityObjectStoreBucketName, getSecurityS3Client, getSecurityS3ClientPublic } from './file-utils';
import { MultipartLayout, MultipartUploadParams, MultipartUploadResult } from './submission-upload-utils.interface';

/**
 * Validate and normalize upload byte-size input.
 *
 * @param {number} bytes
 * @returns {number}
 */
const normalizeUploadBytes = (bytes: number): number => {
  // The backend computes layout from declared byte-size only. Reject invalid
  // values early so we do not create broken multipart sessions in object storage.
  if (!Number.isFinite(bytes) || bytes < 1) {
    throw new Error('Upload bytes must be a positive finite number.');
  }

  return Math.floor(bytes);
};

/**
 * Compute multipart part size while respecting S3 min-part and max-parts constraints.
 *
 * @param {number} normalizedBytes
 * @returns {number}
 */
const getMultipartPartSize = (normalizedBytes: number): number => {
  // S3 hard constraint: uploads cannot exceed 10,000 parts.
  // Example: 1 TiB / 10,000 ~= 105 MiB minimum part size.
  const s3PartCountFloor = Math.ceil(normalizedBytes / S3_MULTIPART_MAX_PARTS);
  // Fewer requests is typically better for large uploads.
  // Example: 1.34 GiB with TARGET_PARTS=10 -> target part size ~= 137 MiB.
  const targetPartCountSize = Math.min(
    Math.ceil(normalizedBytes / UPLOAD_TARGET_PART_COUNT),
    UPLOAD_PART_SIZE_CAP_BYTES
  );

  // Gentle ramp after 20 MiB so files do not stay near-minimum part size for too long.
  // Example:
  // - 20 MiB -> 5 MiB
  // - 30 MiB -> 6 MiB
  // - 40 MiB -> 7 MiB
  const scaledThresholdSize =
    normalizedBytes <= UPLOAD_PART_SIZE_SCALE_START_BYTES
      ? S3_MULTIPART_MIN_PART_SIZE_BYTES
      : S3_MULTIPART_MIN_PART_SIZE_BYTES +
        Math.ceil((normalizedBytes - UPLOAD_PART_SIZE_SCALE_START_BYTES) / UPLOAD_PART_SIZE_SCALE_STEP_BYTES) *
          UPLOAD_PART_SIZE_SCALE_STEP_INCREMENT_BYTES;
  const cappedScaledThresholdSize = Math.min(scaledThresholdSize, UPLOAD_PART_SIZE_CAP_BYTES);

  // Final chosen size satisfies:
  // - at least S3 minimum (5 MiB),
  // - enough to stay under 10,000 parts,
  // - prefers to stay at/below desired 100 MiB part sizes where possible,
  // - never above S3 max part size (5 GiB).
  return Math.min(
    Math.max(S3_MULTIPART_MIN_PART_SIZE_BYTES, s3PartCountFloor, targetPartCountSize, cappedScaledThresholdSize),
    S3_MULTIPART_MAX_PART_SIZE_BYTES
  );
};

/**
 * Build concrete per-part byte sizes from computed layout.
 *
 * The last part may be smaller than `MIN_PART_SIZE`. When mathematically possible,
 * we rebalance sizes across parts to avoid tiny trailing parts.
 *
 * @param {number} totalBytes
 * @param {number} partCount
 * @param {number} nonFinalPartSize
 * @returns {number[]}
 */
const buildPartSizes = (totalBytes: number, partCount: number, nonFinalPartSize: number): number[] => {
  // Default layout: all non-final parts use the selected part size, and final
  // part holds the remainder.
  // Example: 28 MiB with 6 parts at 5 MiB -> [5,5,5,5,5,3] MiB.
  const sizes = Array.from({ length: partCount }, (_, index) =>
    index === partCount - 1 ? totalBytes - nonFinalPartSize * (partCount - 1) : nonFinalPartSize
  );

  const lastPartSize = sizes[sizes.length - 1];

  // If the final remainder is tiny and we can still keep every non-final part >= 5 MiB,
  // rebalance uniformly.
  // Example: 51 MiB with 11x5 MiB would yield tiny tail. Rebalance to ~4-5 MiB
  // only when total bytes still allows >=5 MiB per non-final part.
  if (
    partCount > 1 &&
    lastPartSize < S3_MULTIPART_MIN_PART_SIZE_BYTES &&
    totalBytes >= partCount * S3_MULTIPART_MIN_PART_SIZE_BYTES
  ) {
    const base = Math.floor(totalBytes / partCount);
    const remainder = totalBytes % partCount;

    return Array.from({ length: partCount }, (_, index) => (index < remainder ? base + 1 : base));
  }

  return sizes;
};

/**
 * Build an UploadPart command for signing.
 *
 * @param {string} bucket
 * @param {string} key
 * @param {string} uploadId
 * @param {number} partNumber
 * @returns {UploadPartCommand}
 */
const buildUploadPartCommand = (bucket: string, key: string, uploadId: string, partNumber: number): UploadPartCommand =>
  new UploadPartCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber
  });

/**
 * Calculate multipart layout for a file size.
 *
 * Guarantees:
 * - `partSizeBytes >= S3_MULTIPART_MIN_PART_SIZE_BYTES`
 * - `partCount <= S3_MULTIPART_MAX_PARTS`
 *
 * @param {number} bytes
 * @return {MultipartLayout}
 */
export function calculateMultipartLayout(bytes: number): MultipartLayout {
  const normalizedBytes = normalizeUploadBytes(bytes);
  const partSizeBytes = getMultipartPartSize(normalizedBytes);
  const partCount = Math.ceil(normalizedBytes / partSizeBytes);

  if (partCount > S3_MULTIPART_MAX_PARTS) {
    throw new Error(`Upload requires more than ${S3_MULTIPART_MAX_PARTS} parts.`);
  }

  return {
    partSizeBytes,
    partCount
  };
}

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
  const { key, contentType, bytes } = params;
  const normalizedBytes = normalizeUploadBytes(bytes);
  const { partSizeBytes, partCount } = calculateMultipartLayout(normalizedBytes);
  const partSizes = buildPartSizes(normalizedBytes, partCount, partSizeBytes);
  const bucket = getSecurityObjectStoreBucketName();

  const s3Client = getSecurityS3Client(); // Internal endpoint for backend operations
  const s3ClientPublic = getSecurityS3ClientPublic(); // Public endpoint for presigned URLs

  // Create multipart upload using internal client
  const { UploadId } = await s3Client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType
    })
  );

  if (!UploadId) {
    throw new Error('Failed to create multipart upload');
  }

  // Generate presigned part URLs in bounded batches to avoid allocating
  // thousands of concurrent signing promises for very large uploads.
  const presignedUrls: Array<{ partNumber: number; url: string; partSizeBytes: number }> = [];

  for (let i = 0; i < partCount; i += UPLOAD_PRESIGNED_URL_BATCH_SIZE) {
    const upperBound = Math.min(i + UPLOAD_PRESIGNED_URL_BATCH_SIZE, partCount);

    const batch = await Promise.all(
      Array.from({ length: upperBound - i }, async (_, offset) => {
        const partNumber = i + offset + 1;
        const uploadPartCommand = buildUploadPartCommand(bucket, key, UploadId, partNumber);

        // Sign UploadPart for this exact part number so the client can upload
        // deterministically without doing its own part-number math.
        const url = await getSignedUrl(s3ClientPublic, uploadPartCommand, {
          expiresIn: UPLOAD_PRESIGNED_URL_EXPIRY_SECONDS
        });

        return { partNumber, url, partSizeBytes: partSizes[partNumber - 1] };
      })
    );

    presignedUrls.push(...batch);
  }

  return {
    uploadId: UploadId,
    presignedUrls,
    partCount
  };
}
