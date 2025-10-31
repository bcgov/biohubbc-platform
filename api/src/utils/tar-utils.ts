import tar from 'tar-stream';

/**
 * Extracts a single file from a TAR/PAX archive stream into memory.
 * Stops reading once the file is found.
 *
 * @param inputStream - Readable stream of the TAR archive
 * @param fileName - File inside the TAR to extract, e.g., "features.json"
 * @returns Buffer of the file contents
 */
export async function extractFileFromTarStream(inputStream: NodeJS.ReadableStream, fileName: string): Promise<Buffer> {
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
          extract.destroy(); // stop reading the tar further
        });
        stream.on('error', reject);
      } else {
        stream.resume();
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
 * Convenience function for features.json
 */
export async function extractFeaturesJsonFromStream(inputStream: NodeJS.ReadableStream): Promise<any[]> {
  const fileBuffer = await extractFileFromTarStream(inputStream, 'features.json');
  return JSON.parse(fileBuffer.toString('utf-8'));
}
