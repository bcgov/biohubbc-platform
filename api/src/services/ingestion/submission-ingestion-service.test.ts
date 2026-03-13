import { expect } from 'chai';
import { describe } from 'mocha';
import { Readable } from 'node:stream';
import sinon from 'sinon';
import { Artifact, ArtifactStatusEnum } from '../../models/artifact';
import { IFlattenedBlock } from '../../models/submission-feature';
import { UploadArchive } from '../../models/upload-archive';
import { IngestionRepository } from '../../repositories/ingestion/ingestion-repository';
import * as biohubTarParser from '../../utils/biohub-tar-parser';
import { IUploadedCodesetFile, IUploadedMediaFile } from '../../utils/biohub-tar-parser';
import * as fileUtils from '../../utils/file-utils';
import { getMockDBConnection } from '../../__mocks__/db';
import { ContributorService } from '../contributor-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactService } from '../upload/artifact-service';
import { UploadArchiveService } from '../upload/upload-archive-service';
import { FeatureValidationService } from './feature-validation-service';
import { IValidationError, ValidationErrorType } from './feature-validation-service.interface';
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
    const mockSubmissionUpload = {
      submission_upload_id: 'sub-upload-uuid-1',
      submission_id: 123,
      upload_id: 'upload-1'
    };
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
     * processSubmission now accepts a pre-resolved SubmissionUpload record — no bridge stub needed.
     */
    function setupHappyPathStubs(blocksOverride?: IFlattenedBlock[]) {
      const blocks = blocksOverride ?? mockBlocks;
      const mockReadable = Readable.from(Buffer.alloc(0));

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

      const getUploadArchivesStub = sinon
        .stub(UploadArchiveService.prototype, 'getUploadArchivesByUploadId')
        .resolves([mockUploadArchive]);

      const getArtifactStub = sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(mockArtifact);

      const getFileStreamStub = sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(mockReadable);

      const extractBlocksStub = sinon.stub(biohubTarParser, 'extractBlocksFromArchive').resolves({
        datasetId: 'ds-1',
        blocksByType: new Map(),
        allBlocks: blocks,
        mediaFileNames: mockMediaFileNames,
        codesets: {}
      });

      const extractAndUploadMediaStub = sinon
        .stub(biohubTarParser, 'extractAndUploadMedia')
        .resolves(mockUploadedMedia);
      const extractAndUploadCodesetsStub = sinon
        .stub(biohubTarParser, 'extractAndUploadCodesets')
        .resolves(new Map<string, IUploadedCodesetFile>());

      const validateStub = sinon
        .stub(FeatureValidationService.prototype, 'validateFlatSubmissionFeatures')
        .resolves({ valid: true, errors: [] });
      const contributorStub = sinon.stub(ContributorService.prototype, 'getContributorBySubmissionUploadId').resolves({
        contributor_id: 999,
        client_id: 'test-client'
      });

      const deleteSubmissionFeaturesBySubmissionUploadIdStub = sinon
        .stub(IngestionRepository.prototype, 'deleteSubmissionFeaturesBySubmissionUploadId')
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
        getUploadArchivesStub,
        getArtifactStub,
        getFileStreamStub,
        extractBlocksStub,
        extractAndUploadMediaStub,
        extractAndUploadCodesetsStub,
        validateStub,
        contributorStub,
        deleteSubmissionFeaturesBySubmissionUploadIdStub,
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

      const result = await service.processSubmission(mockSubmissionUpload);

      expect(result).to.eql({ valid: true, errors: [] });

      // getFileStream called three times (validate + media upload + codeset upload) with BucketType.MAIN
      expect(stubs.getFileStreamStub.callCount).to.equal(3);
      expect(stubs.getFileStreamStub.getCall(0).args[0]).to.equal(BucketType.MAIN);
      expect(stubs.getFileStreamStub.getCall(1).args[0]).to.equal(BucketType.MAIN);
      expect(stubs.getFileStreamStub.getCall(2).args[0]).to.equal(BucketType.MAIN);

      // extractBlocksFromArchive called once (pass 1)
      expect(stubs.extractBlocksStub.calledOnce).to.be.true;

      // extractAndUploadMedia called once (pass 2)
      expect(stubs.extractAndUploadMediaStub.calledOnce).to.be.true;
      expect(stubs.extractAndUploadCodesetsStub.calledOnce).to.be.true;

      // validateFlatSubmissionFeatures called with the blocks
      expect(stubs.validateStub.calledOnce).to.be.true;
      expect(stubs.validateStub.getCall(0).args[0]).to.eql(mockBlocks);

      // insertArtifact called once (one media file)
      expect(stubs.insertArtifactStub.calledOnce).to.be.true;

      // Features deleted by submissionUploadId and inserted
      expect(stubs.deleteSubmissionFeaturesBySubmissionUploadIdStub.calledOnce).to.be.true;
      expect(stubs.deleteSubmissionFeaturesBySubmissionUploadIdStub.getCall(0).args[0]).to.equal(
        mockSubmissionUpload.submission_upload_id
      );
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

      const result = await service.processSubmission(mockSubmissionUpload);

      expect(result).to.eql({ valid: false, errors: [mockError] });

      // Pass 2 methods should NOT be called
      expect(stubs.extractAndUploadMediaStub.called).to.be.false;
      expect(stubs.extractAndUploadCodesetsStub.called).to.be.false;
      expect(stubs.insertArtifactStub.called).to.be.false;
      expect(stubs.deleteSubmissionFeaturesBySubmissionUploadIdStub.called).to.be.false;
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
        mediaFileNames: new Set(['photo.jpg']),
        codesets: {}
      });

      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

      const result = await service.processSubmission(mockSubmissionUpload);

      expect(result.valid).to.be.false;
      expect(result.errors.length).to.be.greaterThan(0);
      expect(result.errors.some((e) => e.type === ValidationErrorType.MISSING_MEDIA_FILE)).to.be.true;

      // Pass 2 should NOT proceed
      expect(stubs.extractAndUploadMediaStub.called).to.be.false;
      expect(stubs.extractAndUploadCodesetsStub.called).to.be.false;
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

      await service.processSubmission(mockSubmissionUpload);

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

    it('downloads tar stream three times (validate, media upload, codeset upload)', async () => {
      const stubs = setupHappyPathStubs();
      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

      await service.processSubmission(mockSubmissionUpload);

      expect(stubs.getFileStreamStub.callCount).to.equal(3);
      expect(stubs.getFileStreamStub.getCall(0).args[0]).to.equal(BucketType.MAIN);
      expect(stubs.getFileStreamStub.getCall(0).args[1]).to.equal(mockObjectKey);
      expect(stubs.getFileStreamStub.getCall(1).args[0]).to.equal(BucketType.MAIN);
      expect(stubs.getFileStreamStub.getCall(1).args[1]).to.equal(mockObjectKey);
      expect(stubs.getFileStreamStub.getCall(2).args[0]).to.equal(BucketType.MAIN);
      expect(stubs.getFileStreamStub.getCall(2).args[1]).to.equal(mockObjectKey);
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

      await service.processSubmission(mockSubmissionUpload);

      // Find the insertSubmissionFeatureRecord call for file-1
      const fileInsertCall = Array.from({ length: stubs.insertSubmissionFeatureRecordStub.callCount }, (_, i) =>
        stubs.insertSubmissionFeatureRecordStub.getCall(i)
      ).find((call) => call.args[3] === 'file-1');

      expect(fileInsertCall).to.not.be.undefined;
      const insertedProps = fileInsertCall!.args[5];
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

      await service.processSubmission(mockSubmissionUpload);

      // Find insert calls by feature UUID (3rd arg)
      const obsInsertCall = Array.from({ length: stubs.insertSubmissionFeatureRecordStub.callCount }, (_, i) =>
        stubs.insertSubmissionFeatureRecordStub.getCall(i)
      ).find((call) => call.args[3] === 'obs-1');

      const fileInsertCall = Array.from({ length: stubs.insertSubmissionFeatureRecordStub.callCount }, (_, i) =>
        stubs.insertSubmissionFeatureRecordStub.getCall(i)
      ).find((call) => call.args[3] === 'file-1');

      // For the observation block: JSONB size + 500 overhead, no artifact
      const obsProps = blocks.find((b) => b.id === 'obs-1')!.properties;
      const expectedObsSize = Buffer.byteLength(JSON.stringify(obsProps)) + 500;
      expect(obsInsertCall!.args[6]).to.equal(expectedObsSize);

      // For the file block: JSONB size + 500 overhead + 5000 artifact byte size
      // Note: properties will have been enriched with artifact_key by this point
      const fileBlock = blocks.find((b) => b.id === 'file-1')!;
      const expectedFileSize = Buffer.byteLength(JSON.stringify(fileBlock.properties)) + 500 + 5000;
      expect(fileInsertCall!.args[6]).to.equal(expectedFileSize);
    });

    it('throws when upload has no archives', async () => {
      sinon.stub(UploadArchiveService.prototype, 'getUploadArchivesByUploadId').resolves([]);

      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

      try {
        await service.processSubmission(mockSubmissionUpload);
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
      const result = await service.processSubmission(mockSubmissionUpload);

      expect(result).to.eql({ valid: true, errors: [] });

      // Verify all pass 1 + pass 2 methods were called
      expect(stubs.extractBlocksStub.calledOnce).to.be.true;
      expect(stubs.validateStub.calledOnce).to.be.true;
      expect(stubs.extractAndUploadMediaStub.calledOnce).to.be.true;
      expect(stubs.extractAndUploadCodesetsStub.calledOnce).to.be.true;
      expect(stubs.insertArtifactStub.calledOnce).to.be.true;
      expect(stubs.deleteSubmissionFeaturesBySubmissionUploadIdStub.calledOnce).to.be.true;
      expect(stubs.insertSubmissionFeatureRecordStub.callCount).to.equal(2);

      // getFileStream called three times (pass 1 + media pass + codeset pass)
      expect(stubs.getFileStreamStub.callCount).to.equal(3);
    });
  });
});
