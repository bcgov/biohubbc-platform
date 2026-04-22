import { createHash, type Hash } from 'node:crypto';
import { Transform, type TransformCallback } from 'node:stream';

/**
 * Pass-through Transform that computes a SHA-256 digest and total byte count
 * over the bytes flowing through it.
 *
 * Used by the download pipeline to capture authoritative `artifact.checksum_sha256`
 * and `artifact.byte_size` while streaming Parquet output to S3. Hashing after
 * upload would require re-downloading the object to compute the digest — doing
 * it in the same pipe keeps the digest matched to the exact bytes uploaded and
 * avoids the S3 round-trip.
 *
 * Call `getResult()` only after the stream has ended; calling it earlier returns
 * a partial digest over the bytes seen so far (the underlying `Hash` is final-
 * ized by the call).
 *
 * @return {{ transform: Transform; getResult: () => { sha256Hex: string; byteCount: number } }}
 *   The pass-through `transform` to pipe through, and a `getResult` closure that
 *   returns the final sha256 hex digest and total byte count.
 */
export function createHashCountStream(): {
  transform: Transform;
  getResult: () => { sha256Hex: string; byteCount: number };
} {
  const hash: Hash = createHash('sha256');
  let byteCount = 0;

  const transform = new Transform({
    transform(chunk: Buffer, _encoding, callback: TransformCallback) {
      hash.update(chunk);
      byteCount += chunk.length;
      callback(null, chunk);
    }
  });

  return {
    transform,
    getResult: () => ({ sha256Hex: hash.digest('hex'), byteCount })
  };
}
