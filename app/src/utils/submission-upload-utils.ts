import axios from 'axios';
import { TAR_BLOCK_SIZE, TAR_END_BLOCKS, TAR_HEADER_SIZE } from 'constants/submission';
import { StreamUploadOptions, TarFileData, UploadResult } from './submission-upload-utils.interface';

/**
 * Estimates the total size of a TAR/PAX archive for the given files.
 * Includes file content, headers, padding, and end-of-archive markers.
 *
 * @param files - Array of files to include in the archive
 * @returns Estimated archive size in bytes
 */
export const estimateTarballSize = (files: TarFileData[]): number => {
  let totalSize = 0;

  for (const file of files) {
    // PAX extended header size (if name > 100 chars, add extra header block)
    if (file.name.length > 100) {
      const paxRecords =
        `path=${file.name}\n` + `size=${file.content.length}\n` + `mtime=${Math.floor(Date.now() / 1000)}.000000000\n`;
      const paxRecordsSize = paxRecords.length + 50; // Add buffer for length prefixes
      const paxHeaderSize = TAR_HEADER_SIZE + Math.ceil(paxRecordsSize / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
      totalSize += paxHeaderSize;
    }

    // Regular file header
    totalSize += TAR_HEADER_SIZE;

    // File content (padded to 512-byte boundary)
    const paddedContentSize = Math.ceil(file.content.length / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
    totalSize += paddedContentSize;
  }

  // Two 512-byte zero blocks mark end of archive
  totalSize += TAR_BLOCK_SIZE * TAR_END_BLOCKS;

  return totalSize;
};

/**
 * Converts a File object to a Uint8Array.
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

const concatenateChunks = (chunks: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength) as Uint8Array<ArrayBuffer>;
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
};

/**
 * Writes a string to a buffer at the specified offset
 */
const writeString = (buffer: Uint8Array, str: string, offset: number, length: number): void => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const len = Math.min(bytes.length, length);
  buffer.set(bytes.slice(0, len), offset);
};

/**
 * Writes an octal number to a buffer
 */
const writeOctal = (buffer: Uint8Array, value: number, offset: number, length: number): void => {
  const octal = value.toString(8).padStart(length - 1, '0');
  writeString(buffer, octal, offset, length - 1);
  buffer[offset + length - 1] = 0x20; // space terminator
};

/**
 * Calculates the checksum for a TAR header
 */
const calculateChecksum = (header: Uint8Array): number => {
  let sum = 0;
  for (let i = 0; i < 512; i++) {
    sum += i >= 148 && i < 156 ? 32 : header[i];
  }
  return sum;
};

/**
 * Creates PAX extended header records
 */
const createPaxExtendedHeader = (
  name: string,
  size: number,
  paxHeaders?: Record<string, string>
): Uint8Array | null => {
  const records: string[] = [];

  // Add path if name is too long
  if (name.length > 100) {
    records.push(`path=${name}\n`);
  }

  // Add size
  records.push(`size=${size}\n`);

  // Add modification time
  records.push(`mtime=${Math.floor(Date.now() / 1000)}.000000000\n`);

  // Add custom PAX headers
  if (paxHeaders) {
    for (const [key, value] of Object.entries(paxHeaders)) {
      records.push(`${key}=${value}\n`);
    }
  }

  // If no extended headers needed, return null
  if (records.length === 2 && name.length <= 100) {
    return null;
  }

  // Format records with length prefix
  const formattedRecords = records
    .map((record) => {
      const base = record.length;
      let lengthStr = String(base + 3);
      const totalLen = base + lengthStr.length + 1;
      if (totalLen !== base + 3) {
        lengthStr = String(totalLen);
      }
      return `${lengthStr} ${record}`;
    })
    .join('');

  const encoder = new TextEncoder();
  const recordBytes = encoder.encode(formattedRecords);
  const paddedSize = Math.ceil(recordBytes.length / 512) * 512;
  const paddedData = new Uint8Array(paddedSize);
  paddedData.set(recordBytes);

  // Create header for PAX extended header entry
  const header = new Uint8Array(512);
  const paxHeaderName = `PaxHeaders.0/${name.substring(0, 90)}`;
  writeString(header, paxHeaderName, 0, 100);
  writeOctal(header, 0o644, 100, 8); // mode
  writeOctal(header, 0, 108, 8); // uid
  writeOctal(header, 0, 116, 8); // gid
  writeOctal(header, paddedData.length, 124, 12); // size
  writeOctal(header, Math.floor(Date.now() / 1000), 136, 12); // mtime
  writeString(header, 'x', 156, 1); // type (PAX extended header)
  writeString(header, 'ustar', 257, 6); // magic
  writeString(header, '00', 263, 2); // version

  const checksum = calculateChecksum(header);
  writeOctal(header, checksum, 148, 8);

  return concatenateChunks([header, paddedData]);
};

/**
 * Creates a USTAR file header
 */
const createFileHeader = (name: string, size: number): Uint8Array => {
  const header = new Uint8Array(512);

  // Truncate name if too long (PAX header will have full name)
  const truncatedName = name.substring(0, 100);
  writeString(header, truncatedName, 0, 100);

  writeOctal(header, 0o644, 100, 8); // mode
  writeOctal(header, 0, 108, 8); // uid
  writeOctal(header, 0, 116, 8); // gid
  writeOctal(header, size, 124, 12); // size
  writeOctal(header, Math.floor(Date.now() / 1000), 136, 12); // mtime
  writeString(header, '0', 156, 1); // type (regular file)
  writeString(header, 'ustar', 257, 6); // magic
  writeString(header, '00', 263, 2); // version

  const checksum = calculateChecksum(header);
  writeOctal(header, checksum, 148, 8);

  return header;
};

/**
 * Creates a complete PAX archive with optional extended headers.
 */
export const createPaxData = async (files: TarFileData[]): Promise<Uint8Array> => {
  if (!files?.length) {
    throw new Error('At least one file is required');
  }

  const chunks: Uint8Array[] = [];

  for (const file of files) {
    if (!file.name || !file.content) {
      throw new Error('Each file must have a name and content');
    }

    // Create PAX extended header if needed
    const paxHeader = createPaxExtendedHeader(file.name, file.content.length, file.pax);
    if (paxHeader) {
      chunks.push(paxHeader);
    }

    // Create file header
    const fileHeader = createFileHeader(file.name, file.content.length);
    chunks.push(fileHeader);

    // Pad content to 512-byte boundary
    const paddedSize = Math.ceil(file.content.length / 512) * 512;
    const paddedContent = new Uint8Array(paddedSize);
    paddedContent.set(file.content);
    chunks.push(paddedContent);
  }

  // Add two 512-byte zero blocks to mark end of archive
  chunks.push(new Uint8Array(1024));

  return concatenateChunks(chunks);
};

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
 * Streams TAR creation and upload in chunks for memory efficiency.
 * Builds and uploads the archive incrementally without loading everything into memory.
 */
export const uploadMultipartPaxStreamed = async (
  presignedUrls: string[],
  files: TarFileData[],
  options: StreamUploadOptions
): Promise<UploadResult[]> => {
  if (!presignedUrls?.length) {
    throw new Error('Presigned URLs are required');
  }

  const { onProgress, chunkSize = 10 * 1024 * 1024 } = options; // 10MB default
  const results: UploadResult[] = [];
  let buffer: Uint8Array<ArrayBuffer> = new Uint8Array(0) as Uint8Array<ArrayBuffer>;
  let currentPartIndex = 0;

  const flushBuffer = async () => {
    if (!buffer.length || currentPartIndex >= presignedUrls.length) {
      return;
    }

    const url = presignedUrls[currentPartIndex];
    const partNumber = currentPartIndex + 1;
    const result = await uploadChunk(url, buffer, partNumber);
    results.push(result);

    buffer = new Uint8Array(0) as Uint8Array<ArrayBuffer>;
    currentPartIndex++;

    if (onProgress) {
      onProgress(results.length, presignedUrls.length);
    }
  };

  for (const file of files) {
    if (!file.name || !file.content) {
      throw new Error('Each file must have a name and content');
    }

    // Add PAX extended header if needed
    const paxHeader = createPaxExtendedHeader(file.name, file.content.length, file.pax);
    if (paxHeader) {
      buffer = concatenateChunks([buffer, paxHeader]);
      if (buffer.length >= chunkSize) {
        await flushBuffer();
      }
    }

    // Add file header
    const fileHeader = createFileHeader(file.name, file.content.length);
    buffer = concatenateChunks([buffer, fileHeader]);
    if (buffer.length >= chunkSize) {
      await flushBuffer();
    }

    // Stream file content in chunks
    let offset = 0;
    while (offset < file.content.length) {
      const remainingSpace = chunkSize - buffer.length;
      const slice = file.content.slice(offset, offset + remainingSpace);
      buffer = concatenateChunks([buffer, slice]);
      offset += slice.length;

      if (buffer.length >= chunkSize) {
        await flushBuffer();
      }
    }

    // Add padding for 512-byte block alignment
    const paddingSize = Math.ceil(file.content.length / 512) * 512 - file.content.length;
    if (paddingSize > 0) {
      buffer = concatenateChunks([buffer, new Uint8Array(paddingSize)]);
      if (buffer.length >= chunkSize) {
        await flushBuffer();
      }
    }
  }

  // Add two 512-byte zero blocks to mark end of archive
  buffer = concatenateChunks([buffer, new Uint8Array(1024)]);

  // Flush remaining buffer
  if (buffer.length > 0) {
    await flushBuffer();
  }

  return results.sort((a, b) => a.partNumber - b.partNumber);
};
