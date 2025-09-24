import axios, { AxiosResponse } from 'axios';

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
  partNumber: number;
  /** The ETag returned by the server for this part */
  etag: string;
  /** The full HTTP response from the upload request */
  response: AxiosResponse;
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

  try {
    // Filename (100 bytes, null-terminated)
    const nameBytes = encoder.encode(filename).slice(0, 100);
    header.set(nameBytes, 0);

    // File mode (8 bytes)
    header.set(encoder.encode(DEFAULT_FILE_MODE), 100);

    // Owner ID (8 bytes)
    header.set(encoder.encode(DEFAULT_OWNER_ID), 108);

    // Group ID (8 bytes)
    header.set(encoder.encode(DEFAULT_GROUP_ID), 116);

    // File size (12 bytes, octal representation)
    const sizeOctal = fileSize.toString(8).padStart(11, '0') + '\0';
    header.set(encoder.encode(sizeOctal), 124);

    // Modification time (12 bytes, current time in octal)
    const currentTime = Math.floor(Date.now() / 1000);
    const mtime = currentTime.toString(8).padStart(11, '0') + '\0';
    header.set(encoder.encode(mtime), 136);

    // Checksum placeholder (8 spaces)
    header.set(encoder.encode('        '), 148);

    // Type flag (1 byte) - regular file
    header.set(encoder.encode(REGULAR_FILE_TYPE), 156);

    // Calculate and set checksum
    const checksum = calculateChecksum(header);
    const checksumStr = checksum.toString(8).padStart(6, '0') + '\0 ';
    header.set(encoder.encode(checksumStr), 148);

    return header;
  } catch (error) {
    throw new Error(`Failed to create TAR header for ${filename}: ${error}`);
  }
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
 * Converts a File object to a Uint8Array by reading it as an ArrayBuffer.
 * This is useful for processing files selected via HTML file input elements
 * before creating TAR archives or performing other binary operations.
 *
 * @param file - The File object to convert (cannot be null/undefined)
 * @returns Promise that resolves to the file content as Uint8Array
 * @throws {Error} When file is null/undefined or reading fails
 */
export const fileToUint8Array = (file: File): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('File is required'));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'));
      }
    };

    reader.onerror = () => {
      reject(new Error(`Failed to read file: ${reader.error?.message || 'Unknown error'}`));
    };

    reader.readAsArrayBuffer(file);
  });
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

    // Add header
    const header = createTarHeader(file.name, file.content.length);
    chunks.push(header);

    // Add file content
    chunks.push(file.content);

    // Add padding to align to 512-byte boundary
    const paddingSize = TAR_BLOCK_SIZE - (file.content.length % TAR_BLOCK_SIZE);
    if (paddingSize < TAR_BLOCK_SIZE) {
      chunks.push(new Uint8Array(paddingSize));
    }
  }

  // Add two 512-byte zero blocks to mark end of archive
  chunks.push(new Uint8Array(TAR_BLOCK_SIZE));
  chunks.push(new Uint8Array(TAR_BLOCK_SIZE));

  // Combine all chunks into single Uint8Array
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
 * Splits TAR data into equal-sized chunks for multipart upload operations.
 * Each chunk (except possibly the last) will be approximately the same size,
 * calculated by dividing the total data length by the number of desired chunks.
 *
 * @param tarData - The complete TAR archive data to split
 * @param numChunks - Number of chunks to create (must be positive)
 * @returns Array of Uint8Array chunks ready for parallel upload
 * @throws {Error} When numChunks is zero or negative
 */
const splitTarDataIntoChunks = (tarData: Uint8Array, numChunks: number): Uint8Array[] => {
  if (numChunks <= 0) {
    throw new Error('Number of chunks must be positive');
  }

  if (numChunks === 1) {
    return [tarData];
  }

  const chunkSize = Math.ceil(tarData.length / numChunks);
  const chunks: Uint8Array[] = [];

  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, tarData.length);
    chunks.push(tarData.slice(start, end));
  }

  return chunks;
};

/**
 * Uploads a single data chunk to a presigned URL using HTTP PUT.
 * Sets appropriate headers for TAR content and includes timeout handling.
 * The ETag from the response is cleaned (quotes removed) for easier handling.
 *
 * @param url - The presigned URL to upload to
 * @param chunk - The data chunk to upload
 * @param partNumber - The part number for this chunk in the multipart sequence
 * @returns Promise resolving to upload result with part number, ETag, and response
 * @throws {Error} When upload fails, times out, or ETag is missing
 */
const uploadChunk = async (url: string, chunk: Uint8Array, partNumber: number): Promise<UploadResult> => {
  try {
    const response = await axios.put(url, chunk, {
      headers: {
        'Content-Type': 'application/x-tar'
      },
      timeout: 30000 // 30 second timeout
    });

    if (response.status !== 200) {
      throw new Error(`Upload failed with status ${response.status}: ${response.statusText}`);
    }

    const etag = response.headers.etag || response.headers.ETag;
    if (!etag) {
      throw new Error('No ETag returned from upload');
    }

    return {
      partNumber,
      etag: etag.replace(/"/g, ''), // Remove quotes from ETag
      response
    };
  } catch (error) {
    throw new Error(`Upload failed for part ${partNumber}: ${error}`);
  }
};

/**
 * Uploads a TAR archive using multipart upload with presigned URLs.
 * Splits the TAR data into chunks matching the number of URLs provided,
 * then uploads chunks in parallel batches to respect concurrency limits.
 * Progress can be tracked via optional callback function.
 *
 * @param presignedUrls - Array of presigned URLs for multipart upload (must not be empty)
 * @param tarData - The complete TAR archive data to upload (must not be empty)
 * @param options - Configuration options for upload behavior
 * @param options.concurrencyLimit - Maximum number of simultaneous uploads (default: 4)
 * @param options.onProgress - Callback function called after each batch completion
 * @returns Promise resolving to array of upload results sorted by part number
 * @throws {Error} When URLs/data are invalid, upload fails, or concurrency limit is invalid
 */
export const uploadMultipartTar = async (
  presignedUrls: string[],
  tarData: Uint8Array,
  options: {
    concurrencyLimit?: number;
    onProgress?: (completedParts: number, totalParts: number) => void;
  } = {}
): Promise<UploadResult[]> => {
  const { concurrencyLimit = 4, onProgress } = options;

  if (!presignedUrls || presignedUrls.length === 0) {
    throw new Error('Presigned URLs are required');
  }

  if (!tarData || tarData.length === 0) {
    throw new Error('TAR data is required');
  }

  if (concurrencyLimit <= 0) {
    throw new Error('Concurrency limit must be positive');
  }

  // Split TAR data into chunks matching the number of presigned URLs
  const chunks = splitTarDataIntoChunks(tarData, presignedUrls.length);
  const results: UploadResult[] = [];

  // Process uploads in batches to respect concurrency limit
  for (let i = 0; i < presignedUrls.length; i += concurrencyLimit) {
    const urlBatch = presignedUrls.slice(i, i + concurrencyLimit);
    const dataBatch = chunks.slice(i, i + concurrencyLimit);

    const batchPromises = urlBatch.map((url, index) => uploadChunk(url, dataBatch[index], i + index + 1));

    try {
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Report progress if callback provided
      onProgress?.(results.length, presignedUrls.length);
    } catch (error) {
      throw new Error(`Batch upload failed: ${error}`);
    }
  }

  // Sort results by part number to maintain order
  return results.sort((a, b) => a.partNumber - b.partNumber);
};
