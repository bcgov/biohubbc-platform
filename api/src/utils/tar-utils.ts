import { Readable } from 'stream';
import tar from 'tar-stream';

/**
 * Extracts a single file from a TAR/PAX archive stream.
 * Stops reading once the file is found.
 *
 * @param inputStream - Readable stream of the TAR archive
 * @param fileName - File inside the TAR to extract, e.g., "features.json"
 * @returns Parsed JSON content if fileName is "features.json", or raw Buffer otherwise
 */
export async function extractFileFromTarStream(inputStream: Readable, fileName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const extract = tar.extract();
    let found = false;

    extract.on('entry', (header, stream, next) => {
      if (header.name === fileName) {
        found = true;
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('end', () => {
          resolve(Buffer.concat(chunks));
          extract.destroy(); // Stop parsing further entries
        });
        stream.on('error', reject);
      } else {
        stream.resume(); // Skip other entries
        stream.on('end', next);
      }
    });

    extract.on('finish', () => {
      if (!found) reject(new Error(`${fileName} not found in tarball`));
    });

    inputStream.pipe(extract);
  });
}

/**
 * Convenience function specifically for features.json
 *
 * NOTE: Return type is any because the content of the features.json file is unknown when initially read.
 */
export async function extractFeaturesJsonFromStream(inputStream: Readable): Promise<any> {
  const fileBuffer = await extractFileFromTarStream(inputStream, 'features.json');
  const parsed = JSON.parse(fileBuffer.toString('utf-8'));

  return parsed;
}
