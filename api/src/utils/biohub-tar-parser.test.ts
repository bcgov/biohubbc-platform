import chai, { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as tar from 'tar-stream';
import { FeatureTypeWithProperties } from '../models/feature-type';
import { IFlattenedBlock } from '../models/submission-feature';
import { IngestionRepository } from '../repositories/ingestion/ingestion-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { FeatureValidationService } from '../services/ingestion/feature-validation-service';
import { ValidationErrorType } from '../services/ingestion/feature-validation-service.interface';
import { BucketType, ObjectStorageService } from '../services/object-storage/object-storage-service';
import { extractAndUploadCodesets, extractAndUploadMedia, extractBlocksFromArchive } from './biohub-tar-parser';
import { IExtractedBlocks } from './biohub-tar-parser.interface';

chai.use(sinonChai);

/**
 * Build a real TAR buffer from an array of file entries.
 * Wraps entries under a UUID directory to match real SIMS archive format.
 * Uses tar-stream.pack() so the tests exercise real TAR parsing logic.
 */
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

/** Convert a Buffer into a Readable stream (simulates downloading from S3). */
function bufferToStream(buf: Buffer): Readable {
  return Readable.from(buf);
}

// ---------------------------------------------------------------------------
// Sample block fixtures
// ---------------------------------------------------------------------------
const sampleObservation: IFlattenedBlock = {
  id: 'obs-1',
  type: 'observation',
  properties: { species: 'Ursus arctos', count: 3 },
  content: [],
  parent: 'dataset-root'
};

const sampleObservation2: IFlattenedBlock = {
  id: 'obs-2',
  type: 'observation',
  properties: { species: 'Canis lupus', count: 1 },
  content: [],
  parent: 'dataset-root'
};

const sampleSurvey: IFlattenedBlock = {
  id: 'srv-1',
  type: 'survey',
  properties: { name: 'Spring survey' },
  content: ['obs-1', 'obs-2'],
  parent: null
};

describe('biohub-tar-parser', () => {
  // =========================================================================
  // extractBlocksFromArchive
  // =========================================================================
  describe('extractBlocksFromArchive', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('extracts .dataset-id and returns datasetId', async () => {
      // Verifies: The parser reads .dataset-id and exposes it as datasetId

      // Step 1: Build a TAR with only a .dataset-id entry
      const datasetUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const tarBuf = await createTestTar([{ name: '.dataset-id', content: datasetUuid }]);

      // Step 2: Parse the archive
      const result: IExtractedBlocks = await extractBlocksFromArchive(bufferToStream(tarBuf));

      // Step 3: Verify the datasetId is extracted correctly
      expect(result.datasetId).to.equal(datasetUuid);
    });

    it('parses JSON block files into blocksByType map', async () => {
      // Verifies: JSON files matching block format are grouped by type in blocksByType

      // Step 1: Build TAR with .dataset-id and two observation blocks in a JSON file
      const blocks: IFlattenedBlock[] = [sampleObservation, sampleObservation2];
      const tarBuf = await createTestTar([
        { name: '.dataset-id', content: 'dataset-uuid' },
        { name: 'observation.json', content: JSON.stringify(blocks) }
      ]);

      // Step 2: Parse the archive
      const result = await extractBlocksFromArchive(bufferToStream(tarBuf));

      // Step 3: Verify blocksByType contains the observation key with correct blocks
      expect(result.blocksByType.has('observation')).to.be.true;
      const obsBlocks = result.blocksByType.get('observation')!;
      expect(obsBlocks).to.have.length(2);
      expect(obsBlocks[0].id).to.equal('obs-1');
      expect(obsBlocks[1].id).to.equal('obs-2');
    });

    it('collects allBlocks from all types', async () => {
      // Verifies: allBlocks is the union of blocks across all JSON files

      // Step 1: Build TAR with two different block-type JSON files
      const tarBuf = await createTestTar([
        { name: '.dataset-id', content: 'dataset-uuid' },
        { name: 'observation.json', content: JSON.stringify([sampleObservation]) },
        { name: 'survey.json', content: JSON.stringify([sampleSurvey]) }
      ]);

      // Step 2: Parse the archive
      const result = await extractBlocksFromArchive(bufferToStream(tarBuf));

      // Step 3: Verify allBlocks contains both the observation and survey blocks
      expect(result.allBlocks).to.have.length(2);
      const ids = result.allBlocks.map((b) => b.id);
      expect(ids).to.include('obs-1');
      expect(ids).to.include('srv-1');
    });

    it('parses codes/*.json files into codesets and excludes them from allBlocks', async () => {
      const tarBuf = await createTestTar([
        { name: '.dataset-id', content: 'dataset-uuid' },
        { name: 'observation.json', content: JSON.stringify([sampleObservation]) },
        {
          name: 'codes/agency.json',
          content: JSON.stringify({
            agency: {
              codes: {
                aarde: { label: 'Aarde Environmental Ltd.' }
              }
            }
          })
        }
      ]);

      const result = await extractBlocksFromArchive(bufferToStream(tarBuf));

      expect(result.allBlocks).to.have.length(1);
      expect(result.codesets).to.have.property('agency');
      expect(result.codesets['agency']).to.deep.equal({
        codes: {
          aarde: { label: 'Aarde Environmental Ltd.' }
        }
      });
    });

    it('collects media filenames from files/ entries', async () => {
      // Verifies: Entries under files/ are recorded in mediaFileNames (bare name, no prefix)

      // Step 1: Build TAR with .dataset-id and two media entries
      const tarBuf = await createTestTar([
        { name: '.dataset-id', content: 'dataset-uuid' },
        { name: 'files/photo.jpg', content: 'binary-jpeg-data' },
        { name: 'files/report.pdf', content: 'binary-pdf-data' }
      ]);

      // Step 2: Parse the archive
      const result = await extractBlocksFromArchive(bufferToStream(tarBuf));

      // Step 3: Verify mediaFileNames contains the bare filenames
      expect(result.mediaFileNames.has('photo.jpg')).to.be.true;
      expect(result.mediaFileNames.has('report.pdf')).to.be.true;
      expect(result.mediaFileNames.size).to.equal(2);
    });

    it('drains media streams without buffering and completes without error', async () => {
      // Verifies: Media entries are consumed (drained) so the TAR stream completes,
      //           but no upload/buffering occurs during block extraction

      // Step 1: Build TAR with a large-ish media file
      const largeContent = Buffer.alloc(1024, 0xff);
      const tarBuf = await createTestTar([
        { name: '.dataset-id', content: 'dataset-uuid' },
        { name: 'files/big-image.tiff', content: largeContent }
      ]);

      // Step 2: Parse the archive — should resolve without hanging or error
      const result = await extractBlocksFromArchive(bufferToStream(tarBuf));

      // Step 3: Verify completion and media was recorded
      expect(result.mediaFileNames.has('big-image.tiff')).to.be.true;
    });

    it('handles archive with only JSON files — returns empty mediaFileNames set', async () => {
      // Verifies: When no files/ entries exist, mediaFileNames is an empty Set

      // Step 1: Build TAR with only metadata and JSON
      const tarBuf = await createTestTar([
        { name: '.dataset-id', content: 'dataset-uuid' },
        { name: 'observation.json', content: JSON.stringify([sampleObservation]) }
      ]);

      // Step 2: Parse the archive
      const result = await extractBlocksFromArchive(bufferToStream(tarBuf));

      // Step 3: Verify mediaFileNames is empty
      expect(result.mediaFileNames.size).to.equal(0);
    });

    it('throws error when JSON block file contains malformed JSON', async () => {
      // Verifies: Invalid JSON in a .json entry causes a clear parse error

      // Step 1: Build TAR with a malformed JSON file
      const tarBuf = await createTestTar([
        { name: '.dataset-id', content: 'dataset-uuid' },
        { name: 'observation.json', content: '{ not valid json !!!' }
      ]);

      // Step 2: Attempt to parse — expect rejection
      try {
        await extractBlocksFromArchive(bufferToStream(tarBuf));
        expect.fail('Expected function to throw');
      } catch (error) {
        // Step 3: Verify an error was thrown (specific message depends on implementation)
        expect(error).to.be.instanceOf(Error);
      }
    });

    it('throws error when .dataset-id file is missing from archive', async () => {
      // Verifies: Archive without .dataset-id is rejected as invalid

      // Step 1: Build TAR without .dataset-id
      const tarBuf = await createTestTar([{ name: 'observation.json', content: JSON.stringify([sampleObservation]) }]);

      // Step 2: Attempt to parse — expect rejection
      try {
        await extractBlocksFromArchive(bufferToStream(tarBuf));
        expect.fail('Expected function to throw');
      } catch (error) {
        // Step 3: Verify an error was thrown
        expect(error).to.be.instanceOf(Error);
      }
    });

    it('handles files with no extension — still collects media filename', async () => {
      // Verifies: A file under files/ with no extension is still recorded as media

      // Step 1: Build TAR with an extensionless file
      const tarBuf = await createTestTar([
        { name: '.dataset-id', content: 'dataset-uuid' },
        { name: 'files/LICENSE', content: 'MIT License...' }
      ]);

      // Step 2: Parse the archive
      const result = await extractBlocksFromArchive(bufferToStream(tarBuf));

      // Step 3: Verify extensionless filename is in mediaFileNames
      expect(result.mediaFileNames.has('LICENSE')).to.be.true;
    });

    it('parses codesets from tarball and validates matching code slug values', async () => {
      const featureTypeWithProperties: FeatureTypeWithProperties = {
        featureType: { feature_type_id: 1, name: 'dataset', display_name: 'Dataset' },
        properties: [
          {
            name: 'agency',
            display_name: 'Agency',
            description: '',
            type_name: 'code',
            allow_multiple: false,
            required_value: true,
            calculated_value: false
          }
        ]
      };

      const tarBuf = await createTestTar([
        { name: '.dataset-id', content: 'dataset-uuid' },
        {
          name: 'dataset.json',
          content: JSON.stringify([
            {
              id: 'feature-1',
              type: 'dataset',
              properties: { agency: 'code::agency::aarde' },
              content: [],
              parent: null
            }
          ])
        },
        {
          name: 'codes/agency.json',
          content: JSON.stringify({
            agency: {
              codes: {
                aarde: { label: 'Aarde Environmental Ltd.' }
              }
            }
          })
        }
      ]);

      const parsed = await extractBlocksFromArchive(bufferToStream(tarBuf));

      const mockDBConnection = getMockDBConnection();
      const validationService = new FeatureValidationService(mockDBConnection);
      sinon.stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties').resolves(featureTypeWithProperties);

      const validationResult = await validationService.validateFlatSubmissionFeatures(parsed.allBlocks, parsed.codesets);

      expect(parsed.codesets).to.have.property('agency');
      expect(validationResult.valid).to.be.true;
      expect(validationResult.errors).to.have.length(0);
    });

    it('parses codesets from tarball and returns INVALID_CODE_REFERENCE for unknown slug', async () => {
      const featureTypeWithProperties: FeatureTypeWithProperties = {
        featureType: { feature_type_id: 1, name: 'dataset', display_name: 'Dataset' },
        properties: [
          {
            name: 'agency',
            display_name: 'Agency',
            description: '',
            type_name: 'code',
            allow_multiple: false,
            required_value: true,
            calculated_value: false
          }
        ]
      };

      const tarBuf = await createTestTar([
        { name: '.dataset-id', content: 'dataset-uuid' },
        {
          name: 'dataset.json',
          content: JSON.stringify([
            {
              id: 'feature-1',
              type: 'dataset',
              properties: { agency: 'code::agency::missing' },
              content: [],
              parent: null
            }
          ])
        },
        {
          name: 'codes/agency.json',
          content: JSON.stringify({
            agency: {
              codes: {
                aarde: { label: 'Aarde Environmental Ltd.' }
              }
            }
          })
        }
      ]);

      const parsed = await extractBlocksFromArchive(bufferToStream(tarBuf));

      const mockDBConnection = getMockDBConnection();
      const validationService = new FeatureValidationService(mockDBConnection);
      sinon.stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties').resolves(featureTypeWithProperties);

      const validationResult = await validationService.validateFlatSubmissionFeatures(parsed.allBlocks, parsed.codesets);

      expect(validationResult.valid).to.be.false;
      expect(validationResult.errors.some((error) => error.type === ValidationErrorType.INVALID_CODE_REFERENCE)).to.be
        .true;
    });

    it('parses codesets from tarball and validates allow_multiple code arrays', async () => {
      const featureTypeWithProperties: FeatureTypeWithProperties = {
        featureType: { feature_type_id: 1, name: 'dataset', display_name: 'Dataset' },
        properties: [
          {
            name: 'agencies',
            display_name: 'Agencies',
            description: '',
            type_name: 'code',
            allow_multiple: true,
            required_value: true,
            calculated_value: false
          }
        ]
      };

      const tarBuf = await createTestTar([
        { name: '.dataset-id', content: 'dataset-uuid' },
        {
          name: 'dataset.json',
          content: JSON.stringify([
            {
              id: 'feature-1',
              type: 'dataset',
              properties: { agencies: ['code::agency::aarde', 'code::agency::bio'] },
              content: [],
              parent: null
            }
          ])
        },
        {
          name: 'codes/agency.json',
          content: JSON.stringify({
            agency: {
              codes: {
                aarde: { label: 'Aarde Environmental Ltd.' },
                bio: { label: 'BioHub BC' }
              }
            }
          })
        }
      ]);

      const parsed = await extractBlocksFromArchive(bufferToStream(tarBuf));

      const mockDBConnection = getMockDBConnection();
      const validationService = new FeatureValidationService(mockDBConnection);
      sinon.stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties').resolves(featureTypeWithProperties);

      const validationResult = await validationService.validateFlatSubmissionFeatures(parsed.allBlocks, parsed.codesets);

      expect(validationResult.valid).to.be.true;
      expect(validationResult.errors).to.have.length(0);
    });

    it('parses codesets from tarball and rejects allow_multiple arrays with unknown slugs', async () => {
      const featureTypeWithProperties: FeatureTypeWithProperties = {
        featureType: { feature_type_id: 1, name: 'dataset', display_name: 'Dataset' },
        properties: [
          {
            name: 'agencies',
            display_name: 'Agencies',
            description: '',
            type_name: 'code',
            allow_multiple: true,
            required_value: true,
            calculated_value: false
          }
        ]
      };

      const tarBuf = await createTestTar([
        { name: '.dataset-id', content: 'dataset-uuid' },
        {
          name: 'dataset.json',
          content: JSON.stringify([
            {
              id: 'feature-1',
              type: 'dataset',
              properties: { agencies: ['code::agency::aarde', 'code::agency::missing'] },
              content: [],
              parent: null
            }
          ])
        },
        {
          name: 'codes/agency.json',
          content: JSON.stringify({
            agency: {
              codes: {
                aarde: { label: 'Aarde Environmental Ltd.' }
              }
            }
          })
        }
      ]);

      const parsed = await extractBlocksFromArchive(bufferToStream(tarBuf));

      const mockDBConnection = getMockDBConnection();
      const validationService = new FeatureValidationService(mockDBConnection);
      sinon.stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties').resolves(featureTypeWithProperties);

      const validationResult = await validationService.validateFlatSubmissionFeatures(parsed.allBlocks, parsed.codesets);

      expect(validationResult.valid).to.be.false;
      expect(validationResult.errors.some((error) => error.type === ValidationErrorType.INVALID_CODE_REFERENCE)).to.be
        .true;
    });
  });

  // =========================================================================
  // extractAndUploadMedia
  // =========================================================================
  describe('extractAndUploadMedia', () => {
    let uploadStub: sinon.SinonStub;
    let mockService: ObjectStorageService;

    beforeEach(() => {
      uploadStub = sinon.stub().resolves();
      mockService = { uploadStream: uploadStub } as unknown as ObjectStorageService;
    });

    afterEach(() => {
      sinon.restore();
    });

    it('streams media to S3 with correct key and mimetype', async () => {
      // Verifies: uploadStream is called with BucketType.MAIN, the correct s3Key, and correct mimetype

      // Step 1: Build TAR with a JPEG media file
      const tarBuf = await createTestTar([
        { name: '.dataset-id', content: 'dataset-uuid' },
        { name: 'files/photo.jpg', content: 'fake-jpeg-bytes' }
      ]);

      // Step 2: Call extractAndUploadMedia
      await extractAndUploadMedia(bufferToStream(tarBuf), mockService, 'prefix/123');

      // Step 3: Verify uploadStream was called with correct arguments
      expect(uploadStub).to.have.been.calledOnce;
      const [bucketType, , mimetype, s3Key] = uploadStub.firstCall.args;
      expect(bucketType).to.equal(BucketType.MAIN);
      expect(s3Key).to.equal('prefix/123/photo.jpg');
      expect(mimetype).to.equal('image/jpeg');
    });

    it('extracts bare filename from files/ path', async () => {
      // Verifies: The result map is keyed by bare filename (e.g. "photo.jpg"), not full path

      // Step 1: Build TAR with a nested files/ entry
      const tarBuf = await createTestTar([
        { name: '.dataset-id', content: 'dataset-uuid' },
        { name: 'files/photo.jpg', content: 'jpeg-bytes' }
      ]);

      // Step 2: Call extractAndUploadMedia
      const result = await extractAndUploadMedia(bufferToStream(tarBuf), mockService, 'prefix/123');

      // Step 3: Verify the map key is the bare filename
      expect(result.has('photo.jpg')).to.be.true;
      expect(result.get('photo.jpg')!.fileName).to.equal('photo.jpg');
    });

    it('skips JSON and metadata entries during media extraction', async () => {
      // Verifies: .dataset-id and .json files do NOT trigger uploadStream

      // Step 1: Build TAR with only metadata and JSON (no media)
      const tarBuf = await createTestTar([
        { name: '.dataset-id', content: 'dataset-uuid' },
        { name: 'observation.json', content: JSON.stringify([sampleObservation]) }
      ]);

      // Step 2: Call extractAndUploadMedia
      const result = await extractAndUploadMedia(bufferToStream(tarBuf), mockService, 'prefix/123');

      // Step 3: Verify uploadStream was never called
      expect(uploadStub).to.not.have.been.called;
      expect(result.size).to.equal(0);
    });

    it('records byteSize from TAR header', async () => {
      // Verifies: The IUploadedMediaFile.byteSize matches the TAR entry size

      // Step 1: Build TAR with a known-size media file
      const mediaContent = Buffer.from('hello world — test content');
      const tarBuf = await createTestTar([
        { name: '.dataset-id', content: 'dataset-uuid' },
        { name: 'files/data.csv', content: mediaContent }
      ]);

      // Step 2: Call extractAndUploadMedia
      const result = await extractAndUploadMedia(bufferToStream(tarBuf), mockService, 'prefix/123');

      // Step 3: Verify byteSize matches actual content length
      const uploaded = result.get('data.csv');
      expect(uploaded).to.not.be.undefined;
      expect(uploaded!.byteSize).to.equal(mediaContent.byteLength);
    });

    it('handles archive with no media — returns empty map', async () => {
      // Verifies: When no files/ entries exist, result is an empty Map

      // Step 1: Build TAR with only .dataset-id
      const tarBuf = await createTestTar([{ name: '.dataset-id', content: 'dataset-uuid' }]);

      // Step 2: Call extractAndUploadMedia
      const result = await extractAndUploadMedia(bufferToStream(tarBuf), mockService, 'prefix/123');

      // Step 3: Verify empty map returned
      expect(result.size).to.equal(0);
      expect(uploadStub).to.not.have.been.called;
    });

    it('propagates S3 upload error', async () => {
      // Verifies: If uploadStream rejects, the error bubbles up to the caller

      // Step 1: Configure uploadStream to reject
      const uploadError = new Error('S3 upload failed: access denied');
      uploadStub.rejects(uploadError);

      // Step 2: Build TAR with a media file
      const tarBuf = await createTestTar([
        { name: '.dataset-id', content: 'dataset-uuid' },
        { name: 'files/photo.jpg', content: 'jpeg-bytes' }
      ]);

      // Step 3: Call extractAndUploadMedia — expect rejection
      try {
        await extractAndUploadMedia(bufferToStream(tarBuf), mockService, 'prefix/123');
        expect.fail('Expected function to throw');
      } catch (error) {
        // Step 4: Verify the S3 error propagated
        expect((error as Error).message).to.equal('S3 upload failed: access denied');
      }
    });

    it('files with no extension get mimetype application/octet-stream', async () => {
      // Verifies: When a media file has no extension, mimetype defaults to application/octet-stream

      // Step 1: Build TAR with an extensionless file under files/
      const tarBuf = await createTestTar([
        { name: '.dataset-id', content: 'dataset-uuid' },
        { name: 'files/README', content: 'some readme content' }
      ]);

      // Step 2: Call extractAndUploadMedia
      await extractAndUploadMedia(bufferToStream(tarBuf), mockService, 'prefix/123');

      // Step 3: Verify mimetype is application/octet-stream
      expect(uploadStub).to.have.been.calledOnce;
      const [, , mimetype] = uploadStub.firstCall.args;
      expect(mimetype).to.equal('application/octet-stream');
    });
  });

  // =========================================================================
  // extractAndUploadCodesets
  // =========================================================================
  describe('extractAndUploadCodesets', () => {
    let uploadStub: sinon.SinonStub;
    let mockService: ObjectStorageService;

    beforeEach(() => {
      uploadStub = sinon.stub().resolves();
      mockService = { uploadStream: uploadStub } as unknown as ObjectStorageService;
    });

    afterEach(() => {
      sinon.restore();
    });

    it('uploads files under codes/ and skips other entries', async () => {
      const tarBuf = await createTestTar([
        { name: '.dataset-id', content: 'dataset-uuid' },
        { name: 'codes/agency.json', content: '{"agency": {"codes": {}}}' },
        { name: 'observation.json', content: JSON.stringify([sampleObservation]) },
        { name: 'files/photo.jpg', content: 'jpeg-bytes' }
      ]);

      const result = await extractAndUploadCodesets(bufferToStream(tarBuf), mockService, 'prefix/123/codes');

      expect(uploadStub).to.have.been.calledOnce;
      const [bucketType, , mimetype, s3Key] = uploadStub.firstCall.args;
      expect(bucketType).to.equal(BucketType.MAIN);
      expect(mimetype).to.equal('application/json');
      expect(s3Key).to.equal('prefix/123/codes/agency.json');

      expect(result.has('agency.json')).to.be.true;
    });
  });
});
