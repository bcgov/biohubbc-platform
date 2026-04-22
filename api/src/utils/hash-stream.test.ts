import { expect } from 'chai';
import { describe, it } from 'mocha';
import { createHash } from 'node:crypto';
import { PassThrough } from 'node:stream';
import { createHashCountStream } from './hash-stream';

describe('createHashCountStream', () => {
  it('computes SHA-256 hex digest and byte count matching reference values over a known buffer', async () => {
    const input = Buffer.from('the quick brown fox jumps over the lazy dog', 'utf8');
    const expectedDigest = createHash('sha256').update(input).digest('hex');

    const { transform, getResult } = createHashCountStream();
    const source = new PassThrough();

    const drain = new Promise<void>((resolve) => {
      transform.on('data', () => {
        /* drain the transform so chunks flow through */
      });
      transform.on('end', () => resolve());
    });

    source.pipe(transform);
    source.end(input);
    await drain;

    const result = getResult();
    expect(result.sha256Hex).to.equal(expectedDigest);
    expect(result.byteCount).to.equal(input.length);
  });

  it('sums byte counts across multiple chunks', async () => {
    const chunks = [Buffer.from('aaa', 'utf8'), Buffer.from('bbbb', 'utf8'), Buffer.from('ccccc', 'utf8')];
    const combined = Buffer.concat(chunks);
    const expectedDigest = createHash('sha256').update(combined).digest('hex');

    const { transform, getResult } = createHashCountStream();
    const source = new PassThrough();

    const drain = new Promise<void>((resolve) => {
      transform.on('data', () => {
        /* drain */
      });
      transform.on('end', () => resolve());
    });

    source.pipe(transform);
    for (const chunk of chunks) {
      source.write(chunk);
    }
    source.end();
    await drain;

    const result = getResult();
    expect(result.sha256Hex).to.equal(expectedDigest);
    expect(result.byteCount).to.equal(combined.length);
  });

  it('returns the empty-input digest and byteCount=0 when no bytes flow through', async () => {
    const emptyDigest = createHash('sha256').digest('hex');

    const { transform, getResult } = createHashCountStream();
    const source = new PassThrough();

    const drain = new Promise<void>((resolve) => {
      transform.on('data', () => {
        /* drain */
      });
      transform.on('end', () => resolve());
    });

    source.pipe(transform);
    source.end();
    await drain;

    const result = getResult();
    expect(result.sha256Hex).to.equal(emptyDigest);
    expect(result.byteCount).to.equal(0);
  });
});
