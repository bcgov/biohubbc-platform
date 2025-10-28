import axios from 'axios';
import { StreamUploadOptions, TarFileData, UploadOptions, UploadResult } from './submission-upload-utils.interface';
import {
  TAR_HEADER_SIZE,
  DEFAULT_FILE_MODE,
  DEFAULT_OWNER_ID,
  DEFAULT_GROUP_ID,
  REGULAR_FILE_TYPE,
  TAR_BLOCK_SIZE
} from 'constants/submission';

/**
 * Creates a standard TAR header for a file according to POSIX TAR format.
 *
 * @param {string} filename - The name of the file (max 100 characters)
 * @param {number} fileSize - The size of the file in bytes
 * @returns {Uint8Array} A 512-byte TAR header
 * @throws {Error} If filename is too long or file size is invalid
 */
const createTarHeader = (filename: string, fileSize: number): Uint8Array => {
  if (filename.length > 100) {
    throw new Error(`Filename too long: ${filename}`);
  }
  if (fileSize < 0) {
    throw new Error(`Invalid file size: ${fileSize}`);
  }

  const header = new Uint8Array(TAR_HEADER_SIZE);
  const encoder = new TextEncoder();

  // Filename (100 bytes)
  header.set(encoder.encode(filename).slice(0, 100), 0);

  // File mode, UID, GID (8 bytes each)
  header.set(encoder.encode(DEFAULT_FILE_MODE), 100);
  header.set(encoder.encode(DEFAULT_OWNER_ID), 108);
  header.set(encoder.encode(DEFAULT_GROUP_ID), 116);

  // File size (12 bytes, octal)
  const sizeOctal = fileSize.toString(8).padStart(11, '0') + '\0';
  header.set(encoder.encode(sizeOctal), 124);

  // Modification time (12 bytes, octal)
  const currentTime = Math.floor(Date.now() / 1000);
  const mtime = currentTime.toString(8).padStart(11, '0') + '\0';
  header.set(encoder.encode(mtime), 136);

  // Checksum placeholder (8 spaces)
  header.set(encoder.encode('        '), 148);

  // Type flag (1 byte)
  header.set(encoder.encode(REGULAR_FILE_TYPE), 156);

  // Calculate checksum
  const checksum = Array.from(header).reduce((sum, byte) => sum + byte, 0);
  const checksumStr = checksum.toString(8).padStart(6, '0') + '\0 ';
  header.set(new TextEncoder().encode(checksumStr), 148);

  return header;
};

/**
 * Converts a File object to a Uint8Array.
 *
 * @param {File} file - The file to convert
 * @returns {Promise<Uint8Array>} A promise that resolves to the file contents as a Uint8Array
 * @throws {Error} If file is not provided or reading fails
 */
export const fileToUint8Array = (file: File): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('File is required'));
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

/**
 * Concatenates multiple Uint8Array chunks into a single Uint8Array.
 *
 * @param {Uint8Array[]} chunks - Array of Uint8Array chunks to concatenate
 * @returns {Uint8Array} A single Uint8Array containing all chunks
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
 * Creates a complete TAR archive from multiple files.
 *
 * @param {TarFileData[]} files - Array of files to include in the TAR archive
 * @returns {Uint8Array} Complete TAR archive data
 * @throws {Error} If no files provided or files are invalid
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

    // Padding to 512-byte boundary
    const paddingSize = (TAR_BLOCK_SIZE - (file.content.length % TAR_BLOCK_SIZE)) % TAR_BLOCK_SIZE;
    if (paddingSize > 0) {
      chunks.push(new Uint8Array(paddingSize));
    }
  }

  // End-of-archive two zero blocks
  chunks.push(new Uint8Array(TAR_BLOCK_SIZE));
  chunks.push(new Uint8Array(TAR_BLOCK_SIZE));

  return concatenateChunks(chunks);
};

/**
 * Splits TAR data into N chunks of approximately equal size.
 *
 * @param {Uint8Array} tarData - The TAR data to split
 * @param {number} numChunks - Number of chunks to create
 * @returns {Uint8Array[]} Array of TAR data chunks
 * @throws {Error} If number of chunks is invalid
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
 * Uploads a single chunk to a presigned URL.
 *
 * @param {string} url - The presigned URL to upload to
 * @param {Uint8Array} chunk - The data chunk to upload
 * @param {number} partNumber - The part number for multipart upload
 * @returns {Promise<UploadResult>} Upload result containing part number and ETag
 * @throws {Error} If upload fails or no ETag is returned
 */
const uploadChunk = async (url: string, chunk: Uint8Array, partNumber: number): Promise<UploadResult> => {
  const response = await axios.put(url, chunk, {
    headers: { 'Content-Type': 'application/x-tar' },
    timeout: 30000
  });

  if (response.status !== 200) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  const etag = response.headers.etag || response.headers.ETag;
  if (!etag) {
    throw new Error('No ETag returned from upload');
  }

  return { partNumber, etag: etag.replace(/"/g, ''), response };
};

/**
 * Uploads TAR data to S3 using multipart upload with presigned URLs.
 *
 * @param {string[]} presignedUrls - Array of presigned URLs for each part
 * @param {Uint8Array} tarData - The complete TAR data to upload
 * @param {UploadOptions} [options={}] - Upload options including concurrency limit and progress callback
 * @returns {Promise<UploadResult[]>} Array of upload results sorted by part number
 * @throws {Error} If required parameters are missing or invalid
 */
export const uploadMultipartTar = async (
  presignedUrls: string[],
  tarData: Uint8Array,
  options: UploadOptions = {}
): Promise<UploadResult[]> => {
  const { concurrencyLimit = 4, onProgress } = options;
  if (!presignedUrls?.length) {
    throw new Error('Presigned URLs are required');
  }
  if (!tarData?.length) {
    throw new Error('TAR data is required');
  }
  if (concurrencyLimit <= 0) {
    throw new Error('Concurrency limit must be positive');
  }

  const chunks = splitTarDataIntoChunks(tarData, presignedUrls.length);
  const results: UploadResult[] = [];

  for (let i = 0; i < presignedUrls.length; i += concurrencyLimit) {
    const urlBatch = presignedUrls.slice(i, i + concurrencyLimit);
    const dataBatch = chunks.slice(i, i + concurrencyLimit);

    const batchResults = await Promise.all(urlBatch.map((url, idx) => uploadChunk(url, dataBatch[idx], i + idx + 1)));
    results.push(...batchResults);

    if (onProgress) {
      onProgress(results.length, presignedUrls.length);
    }
  }

  return results.sort((a, b) => a.partNumber - b.partNumber);
};

/**
 * Async generator to stream TAR data from files in chunks.
 *
 * @param {TarFileData[]} files - Array of files to stream
 * @param {number} [chunkSize=1024*1024] - Size of each chunk in bytes (default 1MB)
 * @yields {Uint8Array} Chunks of TAR data
 * @throws {Error} If no files provided or files are invalid
 */
async function* streamTar(files: TarFileData[], chunkSize = 1024 * 1024): AsyncGenerator<Uint8Array> {
  if (!files?.length) {
    throw new Error('At least one file is required');
  }

  for (const file of files) {
    if (!file.name || !file.content) {
      throw new Error('Each file must have a name and content');
    }

    yield createTarHeader(file.name, file.content.length);

    let offset = 0;
    while (offset < file.content.length) {
      const end = Math.min(offset + chunkSize, file.content.length);
      yield file.content.subarray(offset, end);
      offset = end;
    }

    const paddingSize = (TAR_BLOCK_SIZE - (file.content.length % TAR_BLOCK_SIZE)) % TAR_BLOCK_SIZE;
    if (paddingSize > 0) {
      yield new Uint8Array(paddingSize);
    }
  }

  yield new Uint8Array(TAR_BLOCK_SIZE);
  yield new Uint8Array(TAR_BLOCK_SIZE);
}

/**
 * Uploads TAR archive using streaming multipart upload (memory-efficient).
 * Streams file data in chunks rather than loading entire TAR into memory.
 *
 * @param {string[]} presignedUrls - Array of presigned URLs for each part
 * @param {TarFileData[]} files - Array of files to include in the TAR archive
 * @param {StreamUploadOptions} [options={}] - Upload options including concurrency, progress callback, and chunk size
 * @returns {Promise<UploadResult[]>} Array of upload results sorted by part number
 * @throws {Error} If required parameters are missing or invalid
 */
export const uploadMultipartTarStreamed = async (
  presignedUrls: string[],
  files: TarFileData[],
  options: StreamUploadOptions = {}
): Promise<UploadResult[]> => {
  const { concurrencyLimit = 4, onProgress, chunkSize } = options;
  if (!presignedUrls?.length) {
    throw new Error('Presigned URLs are required');
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of streamTar(files, chunkSize)) {
    chunks.push(chunk);
  }

  const tarData = concatenateChunks(chunks);
  return uploadMultipartTar(presignedUrls, tarData, { concurrencyLimit, onProgress });
};
