import { expect } from 'chai';
import { describe } from 'mocha';
import { Readable } from 'node:stream';
import sinon from 'sinon';
import { Artifact, ArtifactStatusEnum } from '../../models/artifact';
import { IFlattenedBlock } from '../../models/submission-feature';
import { SubmissionUpload } from '../../models/submission-upload';
import { UploadArchive } from '../../models/upload-archive';
import { IngestionRepository } from '../../repositories/ingestion/ingestion-repository';
import * as biohubTarParser from '../../utils/biohub-tar-parser';
import { IUploadedMediaFile } from '../../utils/biohub-tar-parser';
import * as fileUtils from '../../utils/file-utils';
import { getMockDBConnection } from '../../__mocks__/db';
import { FeatureValidationService } from './feature-ingestion-service';
import { IValidationError, ValidationErrorType } from './feature-ingestion-service.interface';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactService } from '../upload/artifact-service';
import { SubmissionUploadService } from '../upload/submission-upload-service';
import { UploadArchiveService } from '../upload/upload-archive-service';
import { SubmissionIngestionService, validateMediaReferences } from './submission-ingestion-service';

describe('SubmissionIngestionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('validateMediaReferences', () => {
    it('returns error when file block references missing media', () => {
      const blocks: IFlattenedBlock[] = [
        { id: 'file-1', type: 'file', properties: { filename: 'report.pdf' }, content: [], parent: null }
      ];
      const mediaFileNames = new Set<string>();

      const errors = validateMediaReferences(blocks, mediaFileNames);

      expect(errors).to.have.lengthOf(1);
      expect(errors[0].type).to.equal(ValidationErrorType.MISSING_MEDIA_FILE);
      expect(errors[0].featureId).to.equal('file-1');
      expect(errors[0].message).to.include('report.pdf');
    });

    it('returns error when report block references missing media', () => {
      const blocks: IFlattenedBlock[] = [
        { id: 'report-1', type: 'report', properties: { filename: 'summary.docx' }, content: [], parent: null }
      ];
      const mediaFileNames = new Set<string>();

      const errors = validateMediaReferences(blocks, mediaFileNames);

      expect(errors).to.have.lengthOf(1);
      expect(errors[0].type).to.equal(ValidationErrorType.MISSING_MEDIA_FILE);
      expect(errors[0].featureId).to.equal('report-1');
      expect(errors[0].message).to.include('summary.docx');
    });

    it('returns no errors when all references satisfied', () => {
      const blocks: IFlattenedBlock[] = [
        { id: 'file-1', type: 'file', properties: { filename: 'photo.jpg' }, content: [], parent: null }
      ];
      const mediaFileNames = new Set<string>(['photo.jpg']);

      const errors = validateMediaReferences(blocks, mediaFileNames);

      expect(errors).to.have.lengthOf(0);
    });

    it('ignores non-file/report blocks', () => {
      const blocks: IFlattenedBlock[] = [
        { id: 'obs-1', type: 'observation', properties: { filename: 'photo.jpg' }, content: [], parent: null }
      ];
      const mediaFileNames = new Set<string>();

      const errors = validateMediaReferences(blocks, mediaFileNames);

      expect(errors).to.have.lengthOf(0);
    });

    it('skips blocks without filename property', () => {
      const blocks: IFlattenedBlock[] = [
        { id: 'file-1', type: 'file', properties: { description: 'A file' }, content: [], parent: null }
      ];
      const mediaFileNames = new Set<string>();

      const errors = validateMediaReferences(blocks, mediaFileNames);

      expect(errors).to.have.lengthOf(0);
    });

    it('handles empty blocks array', () => {
      const blocks: IFlattenedBlock[] = [];
      const mediaFileNames = new Set<string>();

      const errors = validateMediaReferences(blocks, mediaFileNames);

      expect(errors).to.have.lengthOf(0);
    });
  });

  describe('processSubmission', () => {
    const submissionId = 123;
    const mockObjectKey = 'submissions/123/uploads/upload-1.tar';

    // Shared mock data
    const mockBlocks: IFlattenedBlock[] = [
      { id: 'obs-1', type: 'observation', properties: { species: 'bear' }, content: [], parent: null },
      { id: 'file-1', type: 'file', properties: { filename: 'photo.jpg' }, content: [], parent: 'obs-1' }
    ];
    const mockMediaFileNames = new Set(['photo.jpg']);
    const mockUploadedMedia = new Map<string, IUploadedMediaFile>([
      ['photo.jpg', { fileName: 'photo.jpg', s3Key: 'submissions/123/media/photo.jpg', byteSize: 5000 }]
    ]);

    /**
     * Sets up the common happy-path stubs for processSubmission tests.
     * Returns the stubs so individual tests can override or assert on them.
     */
    function setupHappyPathStubs(blocksOverride?: IFlattenedBlock[]) {
      const blocks = blocksOverride ?? mockBlocks;
      const mockReadable = Readable.from(Buffer.alloc(0));

      const mockSubmissionUpload: SubmissionUpload = {
        submission_upload_id: 'su-1',
        submission_id: submissionId,
        upload_id: 'upload-1'
      };

      const mockUploadArchive: UploadArchive = {
        upload_archive_id: 'archive-1',
        upload_id: 'upload-1',
        artifact_id: 'artifact-1',
        archive_status: 'pending'
      };

      const mockArtifact: Artifact = {
        artifact_id: 'artifact-1',
        artifact_status: ArtifactStatusEnum.UPLOADED,
        bucket: 'test-bucket',
        object_key: mockObjectKey,
        byte_size: '1000',
        checksum_sha256: null,
        uploaded_at: '2025-01-01T00:00:00Z'
      };

      const getSubmissionUploadsStub = sinon
        .stub(SubmissionUploadService.prototype, 'getSubmissionUploadsBySubmissionId')
        .resolves([mockSubmissionUpload]);

      const getUploadArchivesStub = sinon
        .stub(UploadArchiveService.prototype, 'getUploadArchivesByUploadId')
        .resolves([mockUploadArchive]);

      const getArtifactStub = sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(mockArtifact);

      const getFileStreamStub = sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(mockReadable);

      const extractBlocksStub = sinon.stub(biohubTarParser, 'extractBlocksFromArchive').resolves({
        datasetId: 'ds-1',
        blocksByType: new Map(),
        allBlocks: blocks,
        mediaFileNames: mockMediaFileNames
      });

      const extractAndUploadMediaStub = sinon
        .stub(biohubTarParser, 'extractAndUploadMedia')
        .resolves(mockUploadedMedia);

      const validateStub = sinon
        .stub(FeatureValidationService.prototype, 'validateFlatSubmissionFeatures')
        .resolves({ valid: true, errors: [] });

      const deleteSubmissionFeaturesStub = sinon
        .stub(IngestionRepository.prototype, 'deleteSubmissionFeatures')
        .resolves();

      const insertSubmissionFeatureRecordStub = sinon
        .stub(IngestionRepository.prototype, 'insertSubmissionFeatureRecord')
        .resolves({ submission_feature_id: 1 });

      const updateSubmissionFeatureParentStub = sinon
        .stub(IngestionRepository.prototype, 'updateSubmissionFeatureParent')
        .resolves();

      const insertArtifactStub = sinon
        .stub(ArtifactService.prototype, 'insertArtifact')
        .resolves({ artifact_id: 'new-artifact-1' });

      const getBucketNameStub = sinon.stub(fileUtils, 'getObjectStoreBucketName').returns('test-bucket');

      return {
        getSubmissionUploadsStub,
        getUploadArchivesStub,
        getArtifactStub,
        getFileStreamStub,
        extractBlocksStub,
        extractAndUploadMediaStub,
        validateStub,
        deleteSubmissionFeaturesStub,
        insertSubmissionFeatureRecordStub,
        updateSubmissionFeatureParentStub,
        insertArtifactStub,
        getBucketNameStub
      };
    }

    it('happy path: validates and ingests successfully', async () => {
      const stubs = setupHappyPathStubs();
      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

      const result = await service.processSubmission(submissionId);

      expect(result).to.eql({ valid: true, errors: [] });

      // getFileStream called twice (once per pass) with BucketType.MAIN
      expect(stubs.getFileStreamStub.callCount).to.equal(2);
      expect(stubs.getFileStreamStub.getCall(0).args[0]).to.equal(BucketType.MAIN);
      expect(stubs.getFileStreamStub.getCall(1).args[0]).to.equal(BucketType.MAIN);

      // extractBlocksFromArchive called once (pass 1)
      expect(stubs.extractBlocksStub.calledOnce).to.be.true;

      // extractAndUploadMedia called once (pass 2)
      expect(stubs.extractAndUploadMediaStub.calledOnce).to.be.true;

      // validateFlatSubmissionFeatures called with the blocks
      expect(stubs.validateStub.calledOnce).to.be.true;
      expect(stubs.validateStub.getCall(0).args[0]).to.eql(mockBlocks);

      // insertArtifact called once (one media file)
      expect(stubs.insertArtifactStub.calledOnce).to.be.true;

      // Features deleted and inserted
      expect(stubs.deleteSubmissionFeaturesStub.calledOnce).to.be.true;
      expect(stubs.deleteSubmissionFeaturesStub.getCall(0).args[0]).to.equal(submissionId);
      expect(stubs.insertSubmissionFeatureRecordStub.callCount).to.equal(2);
    });

    it('validation failure: returns errors, no pass 2', async () => {
      const mockError: IValidationError = {
        type: ValidationErrorType.INVALID_FEATURE_TYPE,
        featureId: 'obs-1',
        featureType: 'observation',
        message: 'Invalid feature type: observation'
      };

      const stubs = setupHappyPathStubs();
      // Override validate to return failure
      stubs.validateStub.resolves({ valid: false, errors: [mockError] });

      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

      const result = await service.processSubmission(submissionId);

      expect(result).to.eql({ valid: false, errors: [mockError] });

      // Pass 2 methods should NOT be called
      expect(stubs.extractAndUploadMediaStub.called).to.be.false;
      expect(stubs.insertArtifactStub.called).to.be.false;
      expect(stubs.deleteSubmissionFeaturesStub.called).to.be.false;
      expect(stubs.insertSubmissionFeatureRecordStub.called).to.be.false;
    });

    it('media reference failure: returns errors, no pass 2', async () => {
      // Blocks reference a file that is NOT in the media set
      const blocksWithMissing: IFlattenedBlock[] = [
        { id: 'obs-1', type: 'observation', properties: { species: 'bear' }, content: [], parent: null },
        { id: 'file-1', type: 'file', properties: { filename: 'missing.pdf' }, content: [], parent: 'obs-1' }
      ];

      const stubs = setupHappyPathStubs(blocksWithMissing);
      // Media file names do NOT contain 'missing.pdf' — only 'photo.jpg'
      stubs.extractBlocksStub.resolves({
        datasetId: 'ds-1',
        blocksByType: new Map(),
        allBlocks: blocksWithMissing,
        mediaFileNames: new Set(['photo.jpg'])
      });

      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

      const result = await service.processSubmission(submissionId);

      expect(result.valid).to.be.false;
      expect(result.errors.length).to.be.greaterThan(0);
      expect(result.errors.some((e) => e.type === ValidationErrorType.MISSING_MEDIA_FILE)).to.be.true;

      // Pass 2 should NOT proceed
      expect(stubs.extractAndUploadMediaStub.called).to.be.false;
    });

    it('creates artifact record per uploaded media file', async () => {
      const twoFileMedia = new Map<string, IUploadedMediaFile>([
        ['photo.jpg', { fileName: 'photo.jpg', s3Key: 'submissions/123/media/photo.jpg', byteSize: 5000 }],
        ['data.csv', { fileName: 'data.csv', s3Key: 'submissions/123/media/data.csv', byteSize: 2000 }]
      ]);

      const stubs = setupHappyPathStubs();
      stubs.extractAndUploadMediaStub.resolves(twoFileMedia);

      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

      await service.processSubmission(submissionId);

      // insertArtifact called twice — once per media file
      expect(stubs.insertArtifactStub.callCount).to.equal(2);

      // Verify each call has the correct shape
      for (let i = 0; i < 2; i++) {
        const artifactArg = stubs.insertArtifactStub.getCall(i).args[0];
        expect(artifactArg.bucket).to.equal('test-bucket');
        expect(artifactArg.artifact_status).to.equal(ArtifactStatusEnum.UPLOADED);
        expect(artifactArg.checksum_sha256).to.be.null;
        expect(artifactArg.uploaded_at).to.be.a('string');
      }

      // Verify the object_key and byte_size match the uploaded media
      const allInsertedKeys = [
        stubs.insertArtifactStub.getCall(0).args[0].object_key,
        stubs.insertArtifactStub.getCall(1).args[0].object_key
      ];
      expect(allInsertedKeys).to.include('submissions/123/media/photo.jpg');
      expect(allInsertedKeys).to.include('submissions/123/media/data.csv');

      const allInsertedByteSizes = [
        stubs.insertArtifactStub.getCall(0).args[0].byte_size,
        stubs.insertArtifactStub.getCall(1).args[0].byte_size
      ];
      expect(allInsertedByteSizes).to.include(5000);
      expect(allInsertedByteSizes).to.include(2000);
    });

    it('downloads tar stream twice (once per pass)', async () => {
      const stubs = setupHappyPathStubs();
      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

      await service.processSubmission(submissionId);

      expect(stubs.getFileStreamStub.callCount).to.equal(2);
      expect(stubs.getFileStreamStub.getCall(0).args[0]).to.equal(BucketType.MAIN);
      expect(stubs.getFileStreamStub.getCall(0).args[1]).to.equal(mockObjectKey);
      expect(stubs.getFileStreamStub.getCall(1).args[0]).to.equal(BucketType.MAIN);
      expect(stubs.getFileStreamStub.getCall(1).args[1]).to.equal(mockObjectKey);
    });

    it('setArtifactKeys sets artifact_key on file blocks', async () => {
      // Use blocks that are the SAME object references so mutation is visible
      const blocks: IFlattenedBlock[] = [
        { id: 'obs-1', type: 'observation', properties: { species: 'bear' }, content: [], parent: null },
        {
          id: 'file-1',
          type: 'file',
          properties: { filename: 'photo.jpg', artifact_id: 'stale-id' },
          content: [],
          parent: 'obs-1'
        }
      ];

      const stubs = setupHappyPathStubs(blocks);

      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

      await service.processSubmission(submissionId);

      // Find the insertSubmissionFeatureRecord call for file-1
      const fileInsertCall = Array.from({ length: stubs.insertSubmissionFeatureRecordStub.callCount }, (_, i) =>
        stubs.insertSubmissionFeatureRecordStub.getCall(i)
      ).find((call) => call.args[2] === 'file-1');

      expect(fileInsertCall).to.not.be.undefined;
      const insertedProps = fileInsertCall!.args[4];
      expect(insertedProps.artifact_key).to.equal('submissions/123/media/photo.jpg');
      expect(insertedProps).to.not.have.property('artifact_id');
    });

    it('computeDataByteSizeMap includes JSONB + overhead + artifact size', async () => {
      const blocks: IFlattenedBlock[] = [
        { id: 'obs-1', type: 'observation', properties: { species: 'bear' }, content: [], parent: null },
        { id: 'file-1', type: 'file', properties: { filename: 'photo.jpg' }, content: [], parent: 'obs-1' }
      ];

      const stubs = setupHappyPathStubs(blocks);

      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

      await service.processSubmission(submissionId);

      // Find insert calls by feature UUID (3rd arg)
      const obsInsertCall = Array.from({ length: stubs.insertSubmissionFeatureRecordStub.callCount }, (_, i) =>
        stubs.insertSubmissionFeatureRecordStub.getCall(i)
      ).find((call) => call.args[2] === 'obs-1');

      const fileInsertCall = Array.from({ length: stubs.insertSubmissionFeatureRecordStub.callCount }, (_, i) =>
        stubs.insertSubmissionFeatureRecordStub.getCall(i)
      ).find((call) => call.args[2] === 'file-1');

      // For the observation block: JSONB size + 500 overhead, no artifact
      const obsProps = blocks.find((b) => b.id === 'obs-1')!.properties;
      const expectedObsSize = Buffer.byteLength(JSON.stringify(obsProps)) + 500;
      expect(obsInsertCall!.args[5]).to.equal(expectedObsSize);

      // For the file block: JSONB size + 500 overhead + 5000 artifact byte size
      // Note: properties will have been enriched with artifact_key by this point
      const fileBlock = blocks.find((b) => b.id === 'file-1')!;
      const expectedFileSize = Buffer.byteLength(JSON.stringify(fileBlock.properties)) + 500 + 5000;
      expect(fileInsertCall!.args[5]).to.equal(expectedFileSize);
    });

    it('getTarballObjectKey failure throws', async () => {
      const dbError = new Error('Database connection failed');

      sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadsBySubmissionId').rejects(dbError);

      // Stub methods that should NOT be called
      const extractBlocksStub = sinon.stub(biohubTarParser, 'extractBlocksFromArchive');
      const extractAndUploadMediaStub = sinon.stub(biohubTarParser, 'extractAndUploadMedia');
      const validateStub = sinon.stub(FeatureValidationService.prototype, 'validateFlatSubmissionFeatures');
      const deleteStub = sinon.stub(IngestionRepository.prototype, 'deleteSubmissionFeatures');

      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

      try {
        await service.processSubmission(submissionId);
        expect.fail('Expected processSubmission to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('Database connection failed');
      }

      // No downstream methods should have been called
      expect(extractBlocksStub.called).to.be.false;
      expect(extractAndUploadMediaStub.called).to.be.false;
      expect(validateStub.called).to.be.false;
      expect(deleteStub.called).to.be.false;
    });

    it('throws when submission has no uploads', async () => {
      sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadsBySubmissionId').resolves([]);

      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

      try {
        await service.processSubmission(submissionId);
        expect.fail('Expected processSubmission to throw');
      } catch (error) {
        expect((error as Error).message).to.equal(`No uploads found for submission ${submissionId}`);
      }
    });

    it('throws when upload has no archives', async () => {
      sinon
        .stub(SubmissionUploadService.prototype, 'getSubmissionUploadsBySubmissionId')
        .resolves([{ submission_upload_id: 'su-1', submission_id: submissionId, upload_id: 'upload-1' }]);
      sinon.stub(UploadArchiveService.prototype, 'getUploadArchivesByUploadId').resolves([]);

      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

      try {
        await service.processSubmission(submissionId);
        expect.fail('Expected processSubmission to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('No archives found for upload upload-1');
      }
    });

    it('re-run after failure works cleanly', async () => {
      const stubs = setupHappyPathStubs();
      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

      // Run processSubmission (simulating a re-run, same as happy path — no cleanup needed)
      const result = await service.processSubmission(submissionId);

      expect(result).to.eql({ valid: true, errors: [] });

      // Verify all pass 1 + pass 2 methods were called
      expect(stubs.extractBlocksStub.calledOnce).to.be.true;
      expect(stubs.validateStub.calledOnce).to.be.true;
      expect(stubs.extractAndUploadMediaStub.calledOnce).to.be.true;
      expect(stubs.insertArtifactStub.calledOnce).to.be.true;
      expect(stubs.deleteSubmissionFeaturesStub.calledOnce).to.be.true;
      expect(stubs.insertSubmissionFeatureRecordStub.callCount).to.equal(2);

      // getFileStream called twice (pass 1 and pass 2)
      expect(stubs.getFileStreamStub.callCount).to.equal(2);
    });
  });
});
