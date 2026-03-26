import { CreateMultipartUploadCommand, UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getSecurityObjectStoreBucketName, getSecurityS3Client, getSecurityS3ClientPublic } from './file-utils';
import { MultipartLayout, MultipartUploadParams, MultipartUploadResult } from './submission-upload-utils.interface';

const MIN_PART_SIZE = 5 * 1024 * 1024; // 5 MiB
const MAX_PART_SIZE = 5 * 1024 * 1024 * 1024; // 5 GiB
const SCALE_START_BYTES = 20 * 1024 * 1024; // Start scaling above 20 MiB
const SCALE_STEP_BYTES = 10 * 1024 * 1024; // Increase every 10 MiB
const SCALE_STEP_PART_SIZE_BYTES = 1024 * 1024; // +1 MiB per step
const TARGET_PARTS = 10; // Heuristic: prefer ~10 or fewer part uploads
const MAX_PARTS = 10000;
const PRESIGNED_URL_BATCH_SIZE = 200;
const PRESIGNED_URL_EXPIRY_SECONDS = 3600;

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
  const s3PartCountFloor = Math.ceil(normalizedBytes / MAX_PARTS);
  // Fewer requests is typically better for large uploads.
  // Example: 1.34 GiB with TARGET_PARTS=10 -> target part size ~= 137 MiB.
  const targetPartCountSize = Math.ceil(normalizedBytes / TARGET_PARTS);

  // Gentle ramp after 20 MiB so files do not stay near-minimum part size for too long.
  // Example:
  // - 20 MiB -> 5 MiB
  // - 30 MiB -> 6 MiB
  // - 40 MiB -> 7 MiB
  const scaledThresholdSize =
    normalizedBytes <= SCALE_START_BYTES
      ? MIN_PART_SIZE
      : MIN_PART_SIZE +
        Math.ceil((normalizedBytes - SCALE_START_BYTES) / SCALE_STEP_BYTES) * SCALE_STEP_PART_SIZE_BYTES;

  // Final chosen size satisfies:
  // - at least S3 minimum (5 MiB),
  // - enough to stay under 10,000 parts,
  // - never above S3 max part size (5 GiB).
  return Math.min(Math.max(MIN_PART_SIZE, s3PartCountFloor, targetPartCountSize, scaledThresholdSize), MAX_PART_SIZE);
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
  if (partCount > 1 && lastPartSize < MIN_PART_SIZE && totalBytes >= partCount * MIN_PART_SIZE) {
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
 * - `partSizeBytes >= MIN_PART_SIZE`
 * - `partCount <= MAX_PARTS`
 *
 * @param {number} bytes
 * @return {MultipartLayout}
 */
export function calculateMultipartLayout(bytes: number): MultipartLayout {
  const normalizedBytes = normalizeUploadBytes(bytes);
  const partSizeBytes = getMultipartPartSize(normalizedBytes);
  const partCount = Math.ceil(normalizedBytes / partSizeBytes);

  if (partCount > MAX_PARTS) {
    throw new Error(`Upload requires more than ${MAX_PARTS} parts.`);
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

  for (let i = 0; i < partCount; i += PRESIGNED_URL_BATCH_SIZE) {
    const upperBound = Math.min(i + PRESIGNED_URL_BATCH_SIZE, partCount);

    const batch = await Promise.all(
      Array.from({ length: upperBound - i }, async (_, offset) => {
        const partNumber = i + offset + 1;
        const uploadPartCommand = buildUploadPartCommand(bucket, key, UploadId, partNumber);

        // Sign UploadPart for this exact part number so the client can upload
        // deterministically without doing its own part-number math.
        const url = await getSignedUrl(s3ClientPublic, uploadPartCommand, {
          expiresIn: PRESIGNED_URL_EXPIRY_SECONDS
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
