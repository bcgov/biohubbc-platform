import chai, { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as tar from 'tar-stream';
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
    it('streams features, codesets, and media in one pass', async () => {
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
      const result = await streamSubmissionArchive(bufferToStream(tarBuffer), {
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
      });

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
