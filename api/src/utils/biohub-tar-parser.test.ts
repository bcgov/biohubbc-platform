import chai, { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as tar from 'tar-stream';
import { BucketType, ObjectStorageService } from '../services/object-storage/object-storage-service';
import {
  buildFeatureDataPayload,
  streamCodesetsFromTarball,
  streamFeaturesFromTarball,
  streamMediaFromTarball
} from './biohub-tar-parser';

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

function bufferToStream(buffer: Buffer): Readable {
  return Readable.from(buffer);
}

describe('biohub-tar-parser', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('buildFeatureDataPayload', () => {
    it('maps flattened feature content into raw submission_feature.data payload', () => {
      const payload = buildFeatureDataPayload({
        id: 'feature-1',
        type: 'dataset',
        properties: { name: 'Dataset A' },
        content: ['feature-2'],
        parent: null
      });

      expect(payload).to.deep.equal({
        id: 'feature-1',
        type: 'dataset',
        properties: { name: 'Dataset A' },
        references: ['feature-2'],
        parent: null
      });
    });
  });

  describe('streamFeaturesFromTarball', () => {
    it('streams features in bounded batches and skips non-feature entries', async () => {
      const tarBuffer = await createTestTar([
        {
          name: 'features/dataset.json',
          content: JSON.stringify([
            { id: 'feature-1', type: 'dataset', properties: { name: 'Dataset A' }, content: [], parent: null },
            { id: 'feature-2', type: 'sample_site', properties: { name: 'Site A' }, content: [], parent: 'feature-1' }
          ])
        },
        { name: 'codes/agency.json', content: JSON.stringify({ agency: { codes: { x: { label: 'X' } } } }) },
        { name: 'files/photo.jpg', content: 'binary-data' }
      ]);

      const batches: Array<Array<{ id: string }>> = [];
      const result = await streamFeaturesFromTarball(bufferToStream(tarBuffer), 1, async (batch) => {
        batches.push(batch as Array<{ id: string }>);
      });

      expect(result.featureCount).to.equal(2);
      expect(batches).to.have.length(2);
      expect(batches[0][0].id).to.equal('feature-1');
      expect(batches[1][0].id).to.equal('feature-2');
    });

    it('throws on shallow-validation failures', async () => {
      const tarBuffer = await createTestTar([
        {
          name: 'features/bad.json',
          content: JSON.stringify([{ type: 'dataset', properties: { name: 'Missing id' } }])
        }
      ]);

      try {
        await streamFeaturesFromTarball(bufferToStream(tarBuffer), 10000, async () => undefined);
        expect.fail('expected streamFeaturesFromTarball to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('Feature entry is missing required string field: id');
      }
    });

    it('flushes a final partial batch at end-of-stream', async () => {
      const tarBuffer = await createTestTar([
        {
          name: 'features/dataset.json',
          content: JSON.stringify([
            { id: 'feature-1', type: 'dataset', properties: { name: 'A' }, content: [], parent: null },
            { id: 'feature-2', type: 'dataset', properties: { name: 'B' }, content: [], parent: null },
            { id: 'feature-3', type: 'dataset', properties: { name: 'C' }, content: [], parent: null }
          ])
        }
      ]);

      const batchSizes: number[] = [];
      await streamFeaturesFromTarball(bufferToStream(tarBuffer), 2, async (batch) => {
        batchSizes.push(batch.length);
      });

      expect(batchSizes).to.deep.equal([2, 1]);
    });

    it('propagates invalid JSON parse failures', async () => {
      const tarBuffer = await createTestTar([{ name: 'features/bad.json', content: '{ not valid json' }]);

      try {
        await streamFeaturesFromTarball(bufferToStream(tarBuffer), 10000, async () => undefined);
        expect.fail('expected streamFeaturesFromTarball to throw');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }
    });

    it('propagates batch callback errors', async () => {
      const tarBuffer = await createTestTar([
        {
          name: 'features/dataset.json',
          content: JSON.stringify([
            { id: 'feature-1', type: 'dataset', properties: { name: 'A' }, content: [], parent: null }
          ])
        }
      ]);

      try {
        await streamFeaturesFromTarball(bufferToStream(tarBuffer), 10000, async () => {
          throw new Error('batch insert failed');
        });
        expect.fail('expected streamFeaturesFromTarball to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('batch insert failed');
      }
    });
  });

  describe('streamCodesetsFromTarball', () => {
    it('streams and parses codes/*.json payloads independently', async () => {
      const tarBuffer = await createTestTar([
        {
          name: 'codes/agency.json',
          content: JSON.stringify({
            categories: {
              agency: {
                label: 'Agency',
                codes: {
                  aarde: { label: 'Aarde Environmental Ltd.' }
                }
              }
            }
          })
        },
        {
          name: 'features/dataset.json',
          content: JSON.stringify([{ id: 'feature-1', type: 'dataset', properties: {} }])
        }
      ]);

      const payloads: Record<string, unknown>[] = [];
      await streamCodesetsFromTarball(bufferToStream(tarBuffer), async (codesets) => {
        payloads.push(codesets as unknown as Record<string, unknown>);
      });

      expect(payloads).to.have.length(1);
      expect(payloads[0]).to.have.property('agency');
    });
  });

  describe('streamMediaFromTarball', () => {
    it('streams media entries to object storage and reports uploaded files', async () => {
      const tarBuffer = await createTestTar([
        { name: 'files/photo.jpg', content: 'jpeg-data' },
        { name: 'files/report.pdf', content: 'pdf-data' },
        {
          name: 'features/dataset.json',
          content: JSON.stringify([{ id: 'feature-1', type: 'dataset', properties: {} }])
        }
      ]);

      const uploadStreamStub = sinon.stub(ObjectStorageService.prototype, 'uploadStream').resolves();
      const uploaded: Array<{ fileName: string; s3Key: string; byteSize: number }> = [];

      const result = await streamMediaFromTarball(
        bufferToStream(tarBuffer),
        new ObjectStorageService(),
        'submissions/42/media',
        async (uploadedFile) => {
          uploaded.push(uploadedFile);
        }
      );

      expect(result.uploadedCount).to.equal(2);
      expect(uploadStreamStub.callCount).to.equal(2);
      expect(uploadStreamStub.firstCall.args[0]).to.equal(BucketType.MAIN);
      expect(uploaded.map((item) => item.fileName)).to.deep.equal(['photo.jpg', 'report.pdf']);
      expect(uploaded[0].s3Key).to.equal('submissions/42/media/photo.jpg');
      expect(uploaded[0].byteSize).to.equal(Buffer.byteLength('jpeg-data'));
    });
  });
});
