import { Buffer } from 'buffer';
import * as tar from 'tar-stream';

/**
 * Read `features.json` into memory from a Buffer
 *
 * @param buffer
 * @returns
 */
export async function extractFeaturesJson(buffer: Buffer): Promise<any> {
  return new Promise((resolve, reject) => {
    const extract = tar.extract();

    let features: any;

    extract.on('entry', (header, stream, next) => {
      if (header.name === 'features.json') {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        stream.on('end', () => {
          try {
            features = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            resolve(features);
          } catch (err) {
            reject(err);
          }
          next();
        });
      } else {
        stream.on('end', next);
        stream.resume();
      }
    });

    extract.on('finish', () => {
      if (!features) {
        reject(new Error('features.json not found in tarball'));
      }
    });

    extract.end(buffer);
  });
}
