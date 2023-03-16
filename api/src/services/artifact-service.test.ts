import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { HTTPError } from '../errors/http-error';
import { ArtifactRepository, IArtifact, IArtifactMetadata } from '../repositories/artifact-repository';
import { ISourceTransformModel } from '../repositories/submission-repository';
import * as file_utils from '../utils/file-utils';
import { getMockDBConnection } from '../__mocks__/db';
import { ArtifactService } from './artifact-service';
import { SubmissionService } from './submission-service';

chai.use(sinonChai);

describe('ArtifactService', () => {
  describe('getNextArtifactIds', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should retrieve an array of artifact primary keys', async () => {
      const mockDBConnection = getMockDBConnection();
      const artifactService = new ArtifactService(mockDBConnection);

      const getNextArtifactIdsStub = sinon.stub(ArtifactRepository.prototype, 'getNextArtifactIds').resolves([1, 2]);

      const result = await artifactService.getNextArtifactIds(2);

      expect(getNextArtifactIdsStub).to.be.calledWith(2);
      expect(result).to.eql([1, 2]);
    });

    it('should retrieve one artifact primary key by default', async () => {
      const mockDBConnection = getMockDBConnection();
      const artifactService = new ArtifactService(mockDBConnection);

      const getNextArtifactIdsStub = sinon.stub(ArtifactRepository.prototype, 'getNextArtifactIds').resolves([1]);

      const result = await artifactService.getNextArtifactIds();

      expect(getNextArtifactIdsStub).to.be.calledWith(1);
      expect(result).to.eql([1]);
    });
  });

  describe('insertArtifactRecord', () => {
    it('should return artifact_id on insert', async () => {
      const mockDBConnection = getMockDBConnection();
      const artifactService = new ArtifactService(mockDBConnection);

      const insertArtifactRecordStub = sinon
        .stub(ArtifactRepository.prototype, 'insertArtifactRecord')
        .resolves({ artifact_id: 1 });

      const response = await artifactService.insertArtifactRecord({} as unknown as IArtifact);

      expect(insertArtifactRecordStub).to.be.calledOnce;
      expect(response).to.be.eql({ artifact_id: 1 });
    });
  });

  describe('uploadAndPersistArtifact', () => {
    afterEach(() => {
      sinon.restore();
    });

    const mockDataPackageId = '64f47e65-f306-410e-82fa-115f9916910b';
    const mockArtifactMetadata: IArtifactMetadata = {
      title: 'Title',
      description: 'Description',
      file_name: 'Filename.txt',
      file_type: 'Other',
      file_size: 1
    };
    const mockFileUuid = 'aaa47e65-f306-410e-82fa-115f9916910b';
    const mockFile = {
      originalname: `${mockFileUuid}.zip`
    } as unknown as Express.Multer.File;

    it('should not insert a record if upload to S3 fails', async () => {
      const mockDBConnection = getMockDBConnection({ systemUserId: () => 20 });
      const artifactService = new ArtifactService(mockDBConnection);

      const transformRecordStub = sinon
        .stub(SubmissionService.prototype, 'getSourceTransformRecordBySystemUserId')
        .resolves({ source_transform_id: 60 } as unknown as ISourceTransformModel);

      // const getOrInsertSubmissionRecordStub =
      sinon
        .stub(SubmissionService.prototype, 'insertSubmissionRecordWithPotentialConflict')
        .resolves({ submission_id: 100 });

      // const getNextArtifactIdsStub =
      sinon.stub(ArtifactService.prototype, 'getNextArtifactIds').resolves([14]);

      const insertRecordStub = sinon.stub(ArtifactService.prototype, 'insertArtifactRecord');

      sinon.stub(file_utils, 'uploadFileToS3').rejects(new Error('Test upload failed'));

      try {
        await artifactService.uploadAndPersistArtifact(mockDataPackageId, mockArtifactMetadata, mockFileUuid, mockFile);
        expect.fail();
      } catch (actualError) {
        expect(transformRecordStub).to.be.calledWith(20);
        expect((actualError as HTTPError).message).to.equal('Test upload failed');
        expect(insertRecordStub).to.not.be.called;
      }
    });

    it('should return the artifact ID on success', async () => {
      const mockDBConnection = getMockDBConnection({ systemUserId: () => 20 });
      const artifactService = new ArtifactService(mockDBConnection);

      const transformRecordStub = sinon
        .stub(SubmissionService.prototype, 'getSourceTransformRecordBySystemUserId')
        .resolves({ source_transform_id: 60 } as unknown as ISourceTransformModel);

      const insertSubmissionRecordWithPotentialConflictStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionRecordWithPotentialConflict')
        .resolves({ submission_id: 100 });

      const getNextArtifactIdsStub = sinon.stub(ArtifactService.prototype, 'getNextArtifactIds').resolves([14]);

      const uploadStub = sinon.stub(file_utils, 'uploadFileToS3').resolves();

      const insertRecordStub = sinon
        .stub(ArtifactService.prototype, 'insertArtifactRecord')
        .resolves({ artifact_id: 14 });

      try {
        await artifactService.uploadAndPersistArtifact(mockDataPackageId, mockArtifactMetadata, mockFileUuid, mockFile);
        expect.fail();
      } catch (actualError) {
        expect(transformRecordStub).to.be.calledWith(20);

        expect(insertSubmissionRecordWithPotentialConflictStub).to.be.calledWith({
          source_transform_id: 60,
          uuid: mockDataPackageId
        });
        expect(getNextArtifactIdsStub).to.be.calledWith();
        expect(uploadStub).to.be.calledWith(
          mockFile,
          `biohub/datasets/${mockDataPackageId}/artifacts/${14}/${mockFile.originalname}`,
          { filename: mockFile.originalname }
        );
        expect(insertRecordStub).to.be.calledWith({
          title: 'Title',
          description: 'Description',
          file_name: 'Filename.txt',
          file_type: 'Other',
          file_size: 1,
          artifact_id: 14,
          submission_id: 100,
          input_key: `biohub/datasets/${mockDataPackageId}/artifacts/${14}/${mockFile.originalname}`,
          uuid: mockFileUuid
        });
      }
    });
  });
});
