import chai, { expect } from 'chai';
import { randomBytes, randomUUID } from 'node:crypto';
import { PassThrough, Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as tar from 'tar-stream';
import { IngestionValidationError } from '../errors/submission-errors';
import { BucketType, ObjectStorageService } from '../services/object-storage/object-storage-service';
import { streamSubmissionArchive } from './biohub-tar-parser';

chai.use(sinonChai);

async function createTestTar(files: { name: string; content: string | Buffer }[]): Promise<Buffer> {
  const prefix = randomUUID();

  return new Promise((resolve) => {
    const pack = tar.pack();
    const chunks: Buffer[] = [];
    pack.on('data', (chunk: Buffer) => chunks.push(chunk));
    pack.on('end', () => resolve(Buffer.concat(chunks)));
    pack.entry({ name: `${prefix}/`, type: 'directory', size: 0 }, '');

    for (const file of files) {
      pack.entry({ name: `${prefix}/${file.name}`, size: Buffer.byteLength(file.content) }, file.content);
    }

    pack.finalize();
  });
}

async function createTarWithSparseMediaEntry(): Promise<Buffer> {
  return new Promise((resolve) => {
    const pack = tar.pack();
    const chunks: Buffer[] = [];
    const content = Buffer.from('jpeg-data');
    const sparseHeader = {
      name: 'files/images/GNUSparseFile.0/img-001.jpg',
      size: content.byteLength,
      type: 'file',
      pax: {
        'GNU.sparse.major': '1',
        'GNU.sparse.minor': '0',
        'GNU.sparse.name': 'files/images/img-001.jpg',
        'GNU.sparse.realsize': '8192'
      }
    } as tar.Headers & { pax: Record<string, string> };

    pack.on('data', (chunk: Buffer) => chunks.push(chunk));
    pack.on('end', () => resolve(Buffer.concat(chunks)));
    pack.entry(sparseHeader, content);
    pack.finalize();
  });
}

function bufferToStream(buffer: Buffer): Readable {
  return Readable.from(buffer);
}

describe('biohub-tar-parser', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('streamSubmissionArchive', () => {
    for (const archiveFormat of ['tar', 'tar.gz'] as const) {
      it(`streams ${archiveFormat} features, codesets, and media in one pass`, async () => {
        const tarBuffer = await createTestTar([
          {
            name: 'features/survey.json',
            content: JSON.stringify([{ id: 'feature-1', type: 'survey', properties: {}, content: [], parent: null }])
          },
          {
            name: 'codes/agency.json',
            content: JSON.stringify({
              agency: {
                key: 'agency',
                label: 'Agency',
                external_id: 'agency',
                description: 'Agency codes',
                codes: {
                  x: {
                    key: 'x',
                    label: 'X',
                    external_id: 'x',
                    description: 'Code X'
                  }
                }
              }
            })
          },
          { name: 'files/photo.jpg', content: 'jpeg-data' }
        ]);

        const uploadStreamStub = sinon.stub(ObjectStorageService.prototype, 'uploadStream').resolves();

        const featureBatchSizes: number[] = [];
        let codesetPayloadCount = 0;
        let mediaPayloadCount = 0;
        const mediaPaths: string[] = [];
        const result = await streamSubmissionArchive(
          bufferToStream(archiveFormat === 'tar.gz' ? gzipSync(tarBuffer) : tarBuffer),
          {
            archiveFormat,
            objectStorageService: new ObjectStorageService(),
            s3KeyPrefix: 'submissions/42/media',
            featureBatchSize: 100,
            featureMaxBatchBytes: 1024 * 1024,
            mediaBatchSize: 100,
            mediaMaxBatchBytes: 1024 * 1024,
            mediaConcurrency: 2,
            ingestFeatureBatch: async (blocks) => {
              featureBatchSizes.push(blocks.length);
            },
            ingestCodesets: async () => {
              codesetPayloadCount += 1;
            },
            ingestMediaBatch: async (uploadedFiles) => {
              mediaPayloadCount += uploadedFiles.length;
              mediaPaths.push(...uploadedFiles.map((file) => file.path));
            }
          }
        );

        expect(uploadStreamStub.calledOnce).to.be.true;
        expect(uploadStreamStub.firstCall.args[0]).to.equal(BucketType.MAIN);
        expect(uploadStreamStub.firstCall.args[3]).to.equal('submissions/42/media/files/photo.jpg');
        expect(result.featureCount).to.equal(1);
        expect(result.uploadedCount).to.equal(1);
        expect(result.codesetFileCount).to.equal(1);
        expect(featureBatchSizes).to.deep.equal([1]);
        expect(codesetPayloadCount).to.equal(1);
        expect(mediaPayloadCount).to.equal(1);
        expect(mediaPaths).to.deep.equal(['files/photo.jpg']);
      });
    }

    for (const failure of ['truncated', 'checksum', 'not-gzip', 'source', 'callback'] as const) {
      it(`rejects ${failure} failures in a gzip archive and closes the source`, async () => {
        const retryableError = Object.assign(new Error('External operation failed'), { code: 'ECONNRESET' });
        const tarBuffer = await createTestTar([
          {
            name: 'features/survey.json',
            content: JSON.stringify({ id: 'feature-1', type: 'survey', properties: {}, content: [], parent: null })
          }
        ]);
        let compressed = gzipSync(tarBuffer);
        if (failure === 'truncated') {
          compressed = compressed.subarray(0, compressed.length - 8);
        } else if (failure === 'checksum') {
          compressed[compressed.length - 8] ^= 0xff;
        } else if (failure === 'not-gzip') {
          compressed = tarBuffer;
        }
        const source = Readable.from(
          (async function* () {
            // Small chunks exercise streaming across gzip header and trailer boundaries.
            for (let offset = 0; offset < compressed.length; offset += 3) {
              yield compressed.subarray(offset, offset + 3);
              if (failure === 'source') {
                throw retryableError;
              }
            }
          })()
        );
        let caughtError: unknown;
        try {
          await streamSubmissionArchive(source, {
            archiveFormat: 'tar.gz',
            objectStorageService: new ObjectStorageService(),
            s3KeyPrefix: 'submissions/42/media',
            featureBatchSize: 1,
            featureMaxBatchBytes: 1024,
            mediaBatchSize: 1,
            mediaMaxBatchBytes: 1024,
            mediaConcurrency: 1,
            ingestFeatureBatch: async () => {
              if (failure === 'callback') {
                throw retryableError;
              }
            },
            ingestCodesets: async () => undefined,
            ingestMediaBatch: async () => undefined
          });
        } catch (error) {
          caughtError = error;
        }
        if (failure === 'source' || failure === 'callback') {
          expect(caughtError).to.equal(retryableError);
        } else {
          expect(caughtError).to.be.instanceOf(IngestionValidationError);
        }
        expect(source.destroyed).to.be.true;
      });
    }

    for (const entryType of ['features', 'codes'] as const) {
      for (const failure of ['checksum', 'source'] as const) {
        it(`settles pending ${entryType} writes before propagating ${failure} errors`, async () => {
          const feature = { id: 'one', type: 'survey', properties: {}, content: [], parent: null };
          const content = entryType === 'features' ? feature : {};
          const compressed = gzipSync(
            await createTestTar([{ name: `${entryType}/one.json`, content: JSON.stringify(content) }])
          );
          compressed[compressed.length - 8] ^= 0xff;
          let startWrite!: () => void;
          let finishWrite!: () => void;
          const writeStarted = new Promise<void>((resolve) => {
            startWrite = resolve;
          });
          const writeReleased = new Promise<void>((resolve) => {
            finishWrite = resolve;
          });
          const events: string[] = [];
          const persist = async () => {
            events.push('write started');
            startWrite();
            await writeReleased;
            events.push('write finished');
          };
          const sourceError = new Error('Storage connection failed');
          const source = Readable.from(
            (async function* () {
              yield compressed.subarray(0, compressed.length - 8);
              await writeStarted;
              if (failure === 'source') {
                throw sourceError;
              }
              yield compressed.subarray(compressed.length - 8);
            })()
          );
          // This observer must be attached before the source starts. Ignore the
          // expected source error here; the parser result is asserted below.
          const sourceClosed = new Promise<void>((resolve) => source.once('close', resolve));
          let caughtError: unknown;
          const processing = (async () => {
            try {
              await streamSubmissionArchive(source, {
                archiveFormat: 'tar.gz',
                objectStorageService: new ObjectStorageService(),
                s3KeyPrefix: 'submissions/42/media',
                featureBatchSize: 1,
                featureMaxBatchBytes: 1024,
                mediaBatchSize: 1,
                mediaMaxBatchBytes: 1024,
                mediaConcurrency: 1,
                ingestFeatureBatch: persist,
                ingestCodesets: persist,
                ingestMediaBatch: async () => undefined
              });
            } catch (error) {
              caughtError = error;
              events.push('parser rejected');
            }
          })();
          try {
            await writeStarted;
            await sourceClosed;
            await new Promise<void>((resolve) => setImmediate(resolve));
            expect(events).to.deep.equal(['write started']);
          } finally {
            finishWrite();
            await processing;
          }
          expect(events).to.deep.equal(['write started', 'write finished', 'parser rejected']);
          if (failure === 'source') {
            expect(caughtError).to.equal(sourceError);
          } else {
            expect(caughtError).to.be.instanceOf(IngestionValidationError);
          }
        });
      }
    }

    for (const failure of ['truncated-media', 'upload'] as const) {
      it(`stops media uploads after ${failure} failure`, async () => {
        const tarBuffer = await createTestTar([{ name: 'files/photo.jpg', content: randomBytes(128 * 1024) }]);
        const compressed = gzipSync(tarBuffer);
        const source = bufferToStream(
          failure === 'truncated-media' ? compressed.subarray(0, compressed.length / 2) : compressed
        );
        let streamedBytes = 0;
        const uploadStub = sinon
          .stub(ObjectStorageService.prototype, 'uploadStream')
          .callsFake(async (_bucket, stream) => {
            if (failure === 'upload') {
              throw new Error('Upload failed');
            }
            for await (const chunk of stream) {
              streamedBytes += chunk.length;
            }
          });
        const ingestMediaBatch = sinon.stub().resolves();
        let caughtError: unknown;
        try {
          await streamSubmissionArchive(source, {
            archiveFormat: 'tar.gz',
            objectStorageService: new ObjectStorageService(),
            s3KeyPrefix: 'submissions/42/media',
            featureBatchSize: 1,
            featureMaxBatchBytes: 1024,
            mediaBatchSize: 1,
            mediaMaxBatchBytes: 1024,
            mediaConcurrency: 1,
            ingestFeatureBatch: async () => undefined,
            ingestCodesets: async () => undefined,
            ingestMediaBatch
          });
        } catch (error) {
          caughtError = error;
        }
        expect(caughtError).to.be.instanceOf(Error);
        expect(uploadStub.calledOnce).to.be.true;
        if (failure === 'truncated-media') {
          expect(streamedBytes).to.be.greaterThan(0);
        }
        expect(ingestMediaBatch.called).to.be.false;
        expect(source.destroyed).to.be.true;
      });
    }

    it('settles an incomplete JSON entry when a concurrent media upload fails', async () => {
      const payload = JSON.stringify({
        id: 'one',
        type: 'survey',
        properties: { description: 'a'.repeat(8192) },
        content: [],
        parent: null
      });
      const tarBuffer = await createTestTar([
        { name: 'files/photo.jpg', content: 'photo' },
        { name: 'features/one.json', content: payload }
      ]);
      const source = new PassThrough();
      let finishReadingMedia!: () => void;
      let failUpload!: () => void;
      const mediaRead = new Promise<void>((resolve) => {
        finishReadingMedia = resolve;
      });
      const uploadReleased = new Promise<void>((resolve) => {
        failUpload = resolve;
      });
      const uploadError = new Error('Media upload failed');
      sinon.stub(ObjectStorageService.prototype, 'uploadStream').callsFake(async (_bucket, stream) => {
        for await (const chunk of stream) {
          expect(chunk.length).to.be.greaterThan(0);
        }
        finishReadingMedia();
        await uploadReleased;
        throw uploadError;
      });
      let caughtError: unknown;
      const processing = (async () => {
        try {
          await streamSubmissionArchive(source, {
            objectStorageService: new ObjectStorageService(),
            s3KeyPrefix: 'submissions/42/media',
            featureBatchSize: 1,
            featureMaxBatchBytes: 1024,
            mediaBatchSize: 1,
            mediaMaxBatchBytes: 1024,
            mediaConcurrency: 2,
            ingestFeatureBatch: async () => undefined,
            ingestCodesets: async () => undefined,
            ingestMediaBatch: async () => undefined
          });
        } catch (error) {
          caughtError = error;
        }
      })();
      // Leave the JSON body incomplete so its reader is waiting when the earlier
      // media upload fails. Cancellation must wake that reader before settling.
      source.write(tarBuffer.subarray(0, tarBuffer.indexOf(payload) + 10));
      await mediaRead;
      await new Promise<void>((resolve) => setImmediate(resolve));
      failUpload();
      await processing;
      expect(caughtError).to.equal(uploadError);
      expect(source.destroyed).to.be.true;
    });

    it('flushes feature batches when byte threshold is reached', async () => {
      const tarBuffer = await createTestTar([
        {
          name: 'features/survey-a.json',
          content: JSON.stringify([
            {
              id: 'feature-1',
              type: 'survey',
              properties: { description: 'x'.repeat(200) },
              content: [],
              parent: null
            }
          ])
        },
        {
          name: 'features/survey-b.json',
          content: JSON.stringify([
            {
              id: 'feature-2',
              type: 'survey',
              properties: { description: 'y'.repeat(200) },
              content: [],
              parent: null
            }
          ])
        }
      ]);

      const featureBatchSizes: number[] = [];
      const result = await streamSubmissionArchive(bufferToStream(tarBuffer), {
        objectStorageService: new ObjectStorageService(),
        s3KeyPrefix: 'submissions/42/media',
        featureBatchSize: 100,
        featureMaxBatchBytes: 100,
        mediaBatchSize: 100,
        mediaMaxBatchBytes: 1024 * 1024,
        mediaConcurrency: 2,
        ingestFeatureBatch: async (blocks) => {
          featureBatchSizes.push(blocks.length);
        },
        ingestCodesets: async () => undefined,
        ingestMediaBatch: async () => undefined
      });

      expect(result.featureCount).to.equal(2);
      expect(featureBatchSizes).to.deep.equal([1, 1]);
    });

    it('uses GNU sparse PAX name as the media archive path', async () => {
      const tarBuffer = await createTarWithSparseMediaEntry();
      const uploadStreamStub = sinon.stub(ObjectStorageService.prototype, 'uploadStream').resolves();
      const mediaPaths: string[] = [];

      const result = await streamSubmissionArchive(bufferToStream(tarBuffer), {
        objectStorageService: new ObjectStorageService(),
        s3KeyPrefix: 'submissions/42/media',
        featureBatchSize: 100,
        featureMaxBatchBytes: 1024 * 1024,
        mediaBatchSize: 100,
        mediaMaxBatchBytes: 1024 * 1024,
        mediaConcurrency: 2,
        ingestFeatureBatch: async () => undefined,
        ingestCodesets: async () => undefined,
        ingestMediaBatch: async (uploadedFiles) => {
          mediaPaths.push(...uploadedFiles.map((file) => file.path));
        }
      });

      expect(uploadStreamStub.calledOnce).to.be.true;
      expect(uploadStreamStub.firstCall.args[3]).to.equal('submissions/42/media/files/images/img-001.jpg');
      expect(result.uploadedCount).to.equal(1);
      expect(mediaPaths).to.deep.equal(['files/images/img-001.jpg']);
    });

    it('throws on malformed feature payloads', async () => {
      const tarBuffer = await createTestTar([
        {
          name: 'features/bad.json',
          content: JSON.stringify([{ type: 'survey', properties: { name: 'Missing id' } }])
        }
      ]);

      try {
        await streamSubmissionArchive(bufferToStream(tarBuffer), {
          objectStorageService: new ObjectStorageService(),
          s3KeyPrefix: 'submissions/42/media',
          featureBatchSize: 100,
          featureMaxBatchBytes: 1024 * 1024,
          mediaBatchSize: 100,
          mediaMaxBatchBytes: 1024 * 1024,
          mediaConcurrency: 2,
          ingestFeatureBatch: async () => undefined,
          ingestCodesets: async () => undefined,
          ingestMediaBatch: async () => undefined
        });
        expect.fail('expected streamSubmissionArchive to throw');
      } catch (error) {
        expect((error as Error).message).to.include('Feature entry failed shallow validation');
      }
    });
  });
});
