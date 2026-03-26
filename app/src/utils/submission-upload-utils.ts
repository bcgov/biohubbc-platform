import axios from 'axios';
import { PresignedUrl } from 'interfaces/useSubmissionsApi.interface';

/**
 * TAR file constants
 */
const TAR_HEADER_SIZE = 512;
const TAR_BLOCK_SIZE = 512;
const DEFAULT_FILE_MODE = '0000644';
const DEFAULT_OWNER_ID = '0000000';
const DEFAULT_GROUP_ID = '0000000';
const REGULAR_FILE_TYPE = '0';

/**
 * Interface for file data used in TAR creation
 */
interface TarFileData {
  /** The name of the file as it will appear in the TAR archive */
  name: string;
  /** The binary content of the file */
  content: Uint8Array;
}

/**
 * Interface for multipart upload result
 */
export interface UploadResult {
  /** The part number in the multipart upload sequence */
  PartNumber: number;
  /** The ETag returned by the server for this part */
  ETag: string;
}

/**
 * Creates a standard TAR header for a file according to POSIX TAR format.
 * The header is exactly 512 bytes and contains metadata about the file including
 * name, size, permissions, timestamps, and a checksum for integrity verification.
 *
 * @param filename - The name of the file
 * @param fileSize - The size of the file in bytes
 * @returns A 512-byte Uint8Array containing the properly formatted TAR header
 * @throws {Error} When filename is too long or fileSize is negative
 */
const createTarHeader = (filename: string, fileSize: number): Uint8Array => {
  if (filename.length > 100) {
    throw new Error(`Filename too long: ${filename} (max 100 characters)`);
  }

  if (fileSize < 0) {
    throw new Error(`Invalid file size: ${fileSize}`);
  }

  const header = new Uint8Array(TAR_HEADER_SIZE);
  const encoder = new TextEncoder();

  // Filename (100 bytes, null-terminated)
  header.set(encoder.encode(filename).slice(0, 100), 0);

  // File mode (8 bytes)
  header.set(encoder.encode(DEFAULT_FILE_MODE), 100);

  // Owner ID (8 bytes)
  header.set(encoder.encode(DEFAULT_OWNER_ID), 108);

  // Group ID (8 bytes)
  header.set(encoder.encode(DEFAULT_GROUP_ID), 116);

  // File size (12 bytes, octal representation)
  header.set(encoder.encode(fileSize.toString(8).padStart(11, '0') + '\0'), 124);

  // Modification time (12 bytes, current time in octal)
  const mtime =
    Math.floor(Date.now() / 1000)
      .toString(8)
      .padStart(11, '0') + '\0';
  header.set(encoder.encode(mtime), 136);

  // Checksum placeholder (8 spaces)
  header.set(encoder.encode('        '), 148);

  // Type flag (1 byte) - regular file
  header.set(encoder.encode(REGULAR_FILE_TYPE), 156);

  // Calculate and set checksum
  const checksum = calculateChecksum(header);
  header.set(encoder.encode(checksum.toString(8).padStart(6, '0') + '\0 '), 148);

  return header;
};

/**
 * Calculates the checksum for a TAR header by summing all bytes.
 * This is used for integrity verification when reading TAR archives.
 * The checksum field itself should be filled with spaces before calculation.
 *
 * @param header - The 512-byte TAR header with checksum field as spaces
 * @returns The calculated checksum as a number
 */
const calculateChecksum = (header: Uint8Array): number => {
  let checksum = 0;
  for (let i = 0; i < TAR_HEADER_SIZE; i++) {
    checksum += header[i];
  }
  return checksum;
};

/**
 * Creates a complete TAR archive from multiple files according to POSIX TAR format.
 * Each file gets a 512-byte header followed by its content, padded to 512-byte boundaries.
 * The archive is terminated with two 512-byte zero blocks as per TAR specification.
 *
 * @param files - Array of file objects with name and content properties (must not be empty)
 * @returns Complete TAR archive as a single Uint8Array ready for upload or storage
 * @throws {Error} When files array is empty or any file is missing name/content
 */
export const createTarData = (files: TarFileData[]): Uint8Array => {
  if (!files || files.length === 0) {
    throw new Error('At least one file is required');
  }

  const chunks: Uint8Array[] = [];

  for (const file of files) {
    if (!file.name || !file.content) {
      throw new Error('Each file must have a name and content');
    }

    chunks.push(createTarHeader(file.name, file.content.length));
    chunks.push(file.content);

    const padding = TAR_BLOCK_SIZE - (file.content.length % TAR_BLOCK_SIZE);
    if (padding < TAR_BLOCK_SIZE) {
      chunks.push(new Uint8Array(padding));
    }
  }

  // End-of-archive markers
  chunks.push(new Uint8Array(TAR_BLOCK_SIZE));
  chunks.push(new Uint8Array(TAR_BLOCK_SIZE));

  return concatenateChunks(chunks);
};

/**
 * Efficiently concatenates multiple Uint8Array chunks into a single array.
 * Pre-calculates the total length to avoid multiple array reallocations,
 * making this more memory-efficient than repeated concatenation operations.
 *
 * @param chunks - Array of Uint8Array chunks to concatenate
 * @returns Single Uint8Array containing all chunks in sequence
 */
const concatenateChunks = (chunks: Uint8Array[]): Uint8Array => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
};

/**
 * Splits a TAR file into byte ranges using exact backend per-part byte instructions.
 *
 * Example:
 * - backend parts: [{part:1,size:5MiB}, {part:2,size:5MiB}, {part:3,size:3MiB}]
 * - client slices the tarball as [0..5MiB), [5..10MiB), [10..13MiB)
 *
 * @param fileSize - The total TAR archive size in bytes
 * @param orderedPresignedParts - Presigned parts sorted by part number
 * @returns Array of byte ranges ready for slicing from a File
 * @throws {Error} When instructions are invalid or do not match file size
 */
const splitTarFileIntoRanges = (
  fileSize: number,
  orderedPresignedParts: PresignedUrl[]
): Array<{ partNumber: number; url: string; start: number; end: number }> => {
  if (!orderedPresignedParts.length) {
    throw new Error('Part count must be positive');
  }

  const expectedBytes = orderedPresignedParts.reduce((sum, part) => sum + part.partSizeBytes, 0);
  if (expectedBytes !== fileSize) {
    // Defensive check: prevents uploading malformed part payloads when
    // backend instructions and client file size do not line up.
    throw new Error('Part instructions do not match file size.');
  }

  const ranges: Array<{ partNumber: number; url: string; start: number; end: number }> = [];
  let start = 0;

  for (const part of orderedPresignedParts) {
    if (!Number.isFinite(part.partSizeBytes) || part.partSizeBytes <= 0) {
      throw new Error(`Invalid part size for part ${part.partNumber}.`);
    }

    const end = start + part.partSizeBytes;
    ranges.push({ partNumber: part.partNumber, url: part.url, start, end });
    start = end;
  }

  return ranges;
};

/**
 * Uploads a single data chunk to a presigned URL using HTTP PUT.
 * Sets appropriate headers for TAR content and includes timeout handling.
 * The ETag from the response is cleaned (quotes removed) for easier handling.
 *
 * @param url - The presigned URL to upload to
 * @param chunk - The Blob slice chunk to upload
 * @param partNumber - The part number for this chunk in the multipart sequence
 * @returns Promise resolving to upload result with part number and ETag
 * @throws {Error} When upload fails, times out, or ETag is missing
 */
const uploadChunk = async (url: string, chunk: Blob, partNumber: number): Promise<UploadResult> => {
  const response = await axios.put(url, chunk, {
    headers: { 'Content-Type': 'application/x-tar' },
    timeout: 30000
  });

  if (response.status !== 200) {
    throw new Error(`Upload failed with status ${response.status}: ${response.statusText}`);
  }

  const etag = response.headers.etag || response.headers.ETag;
  if (!etag) {
    throw new Error('No ETag returned from upload');
  }

  return {
    PartNumber: partNumber,
    ETag: etag.replaceAll('"', '')
  };
};

/**
 * Uploads a TAR archive using multipart upload with presigned URLs.
 * Slices the TAR file into Blob chunks matching backend byte instructions,
 * then uploads chunks in parallel batches to respect concurrency limits.
 * Progress can be tracked via optional callback function.
 *
 * @param presignedParts - Array of presigned part instructions for multipart upload
 * @param tarFile - The complete TAR archive file to upload (must not be empty)
 * @param options - Configuration options for upload behavior
 * @param options.concurrencyLimit - Maximum number of simultaneous uploads (default: 4)
 * @param options.onProgress - Callback function called after each batch completion
 * @returns Promise resolving to array of upload results sorted by part number
 * @throws {Error} When URLs/data are invalid, upload fails, or concurrency limit is invalid
 */
export const uploadMultipartTar = async (
  presignedParts: PresignedUrl[],
  tarFile: File,
  options: {
    concurrencyLimit?: number;
    onProgress?: (completedParts: number, totalParts: number) => void;
  } = {}
): Promise<UploadResult[]> => {
  const { concurrencyLimit = 4, onProgress } = options;

  if (!presignedParts.length) {
    throw new Error('Presigned parts are required');
  }

  if (!tarFile || tarFile.size <= 0) {
    throw new Error('TAR data is required');
  }

  if (concurrencyLimit <= 0) {
    throw new Error('Concurrency limit must be positive');
  }

  // Apply backend-provided ordering so PartNumber values line up exactly with
  // what was signed during URL provisioning.
  const orderedPresignedParts = [...presignedParts].sort((a, b) => a.partNumber - b.partNumber);
  const ranges = splitTarFileIntoRanges(tarFile.size, orderedPresignedParts);
  const results: UploadResult[] = [];

  for (let i = 0; i < ranges.length; i += concurrencyLimit) {
    const batch = ranges.slice(i, i + concurrencyLimit);

    // Upload each batch in parallel while preserving deterministic part numbers.
    const batchResults = await Promise.all(
      batch.map((part) => uploadChunk(part.url, tarFile.slice(part.start, part.end), part.partNumber))
    );

    results.push(...batchResults);
    onProgress?.(results.length, ranges.length);
  }

  return results.sort((a, b) => a.PartNumber - b.PartNumber);
};
