import AWS from 'aws-sdk';
import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { HTTPError } from '../errors/http-error';
import { Artifact, ArtifactMetadata, ArtifactRepository } from '../repositories/artifact-repository';
import { SecurityRepository } from '../repositories/security-repository';
import { ISourceTransformModel } from '../repositories/submission-repository';
import * as file_utils from '../utils/file-utils';
import { getMockDBConnection } from '../__mocks__/db';
import { ArtifactService } from './artifact-service';
import { SubmissionService } from './submission-service';

chai.use(sinonChai);

describe('ArtifactService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getNextArtifactIds', () => {
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

      const response = await artifactService.insertArtifactRecord({} as unknown as Artifact);

      expect(insertArtifactRecordStub).to.be.calledOnce;
      expect(response).to.be.eql({ artifact_id: 1 });
    });
  });

  describe('getArtifactsByDatasetId', () => {
    it('should return an array of artifacts', async () => {
      const mockDBConnection = getMockDBConnection();
      const artifactService = new ArtifactService(mockDBConnection);

      const getArtifactRecordsStub = sinon
        .stub(ArtifactRepository.prototype, 'getArtifactsByDatasetId')
        .resolves([{ artifact_id: 1 }, { artifact_id: 2 }] as Artifact[]);

      const response = await artifactService.getArtifactsByDatasetId('abcd');

      expect(getArtifactRecordsStub).to.be.calledWith('abcd');
      expect(response).to.be.eql([{ artifact_id: 1 }, { artifact_id: 2 }]);
    });
  });

  describe('uploadAndPersistArtifact', () => {
    const mockDataPackageId = '64f47e65-f306-410e-82fa-115f9916910b';
    const mockArtifactMetadata: ArtifactMetadata = {
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
          key: `biohub/datasets/${mockDataPackageId}/artifacts/${14}/${mockFile.originalname}`,
          uuid: mockFileUuid
        });
      }
    });
  });

  describe('getArtifactById', () => {
    it('should return a single artifact successfully', async () => {
      const mockDBConnection = getMockDBConnection();
      const artifactService = new ArtifactService(mockDBConnection);

      const getArtifactRecordsStub = sinon
        .stub(ArtifactRepository.prototype, 'getArtifactById')
        .resolves({ artifact_id: 1 } as Artifact);

      const response = await artifactService.getArtifactById(1);

      expect(getArtifactRecordsStub).to.be.calledWith(1);
      expect(response).to.be.eql({ artifact_id: 1 });
    });
  });

  describe('updateArtifactSecurityReviewTimestamp', () => {
    it('should update artifact security review timestamp', async () => {
      const mockDBConnection = getMockDBConnection();
      const artifactService = new ArtifactService(mockDBConnection);

      const getArtifactRecordsStub = sinon
        .stub(ArtifactRepository.prototype, 'updateArtifactSecurityReviewTimestamp')
        .resolves();

      const response = await artifactService.updateArtifactSecurityReviewTimestamp(1);

      expect(getArtifactRecordsStub).to.be.calledWith(1);
      expect(response).to.be.eql(undefined);
    });
  });

  describe('getArtifactsByIds', () => {
    it('should return multiple artifacts successfully', async () => {
      const mockDBConnection = getMockDBConnection();
      const artifactService = new ArtifactService(mockDBConnection);

      const getArtifactRecordsStub = sinon
        .stub(ArtifactRepository.prototype, 'getArtifactsByIds')
        .resolves([{ artifact_id: 1 }, { artifact_id: 2 }] as Artifact[]);

      const response = await artifactService.getArtifactsByIds([1, 2]);

      expect(getArtifactRecordsStub).to.be.calledWith([1, 2]);
      expect(response).to.be.eql([{ artifact_id: 1 }, { artifact_id: 2 }]);
    });

    it('should return zero artifacts successfully', async () => {
      const mockDBConnection = getMockDBConnection();
      const artifactService = new ArtifactService(mockDBConnection);

      const getArtifactRecordsStub = sinon
        .stub(ArtifactRepository.prototype, 'getArtifactsByIds')
        .resolves([] as Artifact[]);

      const response = await artifactService.getArtifactsByIds([1, 2]);

      expect(getArtifactRecordsStub).to.be.calledWith([1, 2]);
      expect(response).to.be.eql([]);
    });
  });

  describe('deleteArtifacts', () => {
    it('should work with valid data', async () => {
      const mockDBConnection = getMockDBConnection();
      const artifactService = new ArtifactService(mockDBConnection);
      const deleteStub = sinon.stub(ArtifactService.prototype, 'deleteArtifact').resolves();
      await artifactService.deleteArtifacts(['uuid', 'uuid2']);

      expect(deleteStub).to.be.calledTwice;
    });

    it('should throw an error', async () => {
      const mockDBConnection = getMockDBConnection();
      const artifactService = new ArtifactService(mockDBConnection);
      sinon.stub(ArtifactService.prototype, 'deleteArtifact').rejects('Oops');

      try {
        await artifactService.deleteArtifacts(['uuid', 'uuid2']);
        expect.fail();
      } catch (error: any) {
        expect(error.message).to.be.eql('There was an issue deleting an artifact.');
      }
    });
  });

  describe('deleteArtifact', () => {
    it('works with valid data', async () => {
      const mockDBConnection = getMockDBConnection();
      const mockS3Client = new AWS.S3();
      const artifactService = new ArtifactService(mockDBConnection);
      const artifact = {
        key: 's3 key'
      } as Artifact;
      const getStub = sinon.stub(ArtifactRepository.prototype, 'getArtifactByUUID').resolves(artifact);
      const deleteStub = sinon.stub(ArtifactRepository.prototype, 'deleteArtifactByUUID').resolves();
      const deleteSecurityStub = sinon
        .stub(SecurityRepository.prototype, 'deleteSecurityRulesForArtifactUUID')
        .resolves();
      sinon.stub(AWS, 'S3').returns(mockS3Client);
      const deleteS3 = sinon.stub(mockS3Client, 'deleteObject').returns({
        promise: () =>
          Promise.resolve({
            DeleteMarker: true
          })
      } as AWS.Request<AWS.S3.DeleteObjectOutput, AWS.AWSError>);

      await artifactService.deleteArtifact('uuid');
      expect(getStub).to.be.called;
      expect(deleteS3).to.be.called;
      expect(deleteSecurityStub).to.be.called;
      expect(deleteStub).to.be.called;
    });

    it('artifact not found for uuid', async () => {
      const mockDBConnection = getMockDBConnection();
      const mockS3Client = new AWS.S3();
      const artifactService = new ArtifactService(mockDBConnection);
      const getStub = sinon.stub(ArtifactRepository.prototype, 'getArtifactByUUID').resolves(null);
      const deleteStub = sinon.stub(ArtifactRepository.prototype, 'deleteArtifactByUUID').resolves();
      const deleteSecurityStub = sinon
        .stub(SecurityRepository.prototype, 'deleteSecurityRulesForArtifactUUID')
        .resolves();
      sinon.stub(AWS, 'S3').returns(mockS3Client);
      const deleteS3 = sinon.stub(mockS3Client, 'deleteObject').returns({
        promise: () =>
          Promise.resolve({
            DeleteMarker: true
          })
      } as AWS.Request<AWS.S3.DeleteObjectOutput, AWS.AWSError>);

      await artifactService.deleteArtifact('uuid');
      expect(getStub).to.be.called;
      expect(deleteS3).to.not.be.called;
      expect(deleteSecurityStub).to.not.be.called;
      expect(deleteStub).to.not.be.called;
    });

    it('repo error thrown', async () => {
      const mockDBConnection = getMockDBConnection();
      const mockS3Client = new AWS.S3();
      const artifactService = new ArtifactService(mockDBConnection);
      const artifact = {
        key: 's3 key'
      } as Artifact;
      const getStub = sinon.stub(ArtifactRepository.prototype, 'getArtifactByUUID').resolves(artifact);
      const deleteStub = sinon.stub(ArtifactRepository.prototype, 'deleteArtifactByUUID').throws('Oops');
      const deleteSecurityStub = sinon
        .stub(SecurityRepository.prototype, 'deleteSecurityRulesForArtifactUUID')
        .resolves();
      sinon.stub(AWS, 'S3').returns(mockS3Client);
      const deleteS3 = sinon.stub(mockS3Client, 'deleteObject').returns({
        promise: () =>
          Promise.resolve({
            DeleteMarker: true,
            VersionId: 1
          })
      } as unknown as AWS.Request<AWS.S3.DeleteObjectOutput, AWS.AWSError>);

      try {
        await artifactService.deleteArtifact('uuid');
        expect.fail();
      } catch (error: any) {
        expect(error.message).to.be.eql('Issue deleting artifact: uuid');
        expect(getStub).to.be.called;
        expect(deleteS3).to.be.called;
        expect(deleteSecurityStub).to.be.called;
        expect(deleteStub).to.be.called;
      }
    });
    it('S3 error thrown', async () => {
      const mockDBConnection = getMockDBConnection();
      const mockS3Client = new AWS.S3();
      const artifactService = new ArtifactService(mockDBConnection);
      const artifact = {
        key: 's3 key'
      } as Artifact;
      const getStub = sinon.stub(ArtifactRepository.prototype, 'getArtifactByUUID').resolves(artifact);
      const deleteStub = sinon.stub(ArtifactRepository.prototype, 'deleteArtifactByUUID').resolves();
      const deleteSecurityStub = sinon
        .stub(SecurityRepository.prototype, 'deleteSecurityRulesForArtifactUUID')
        .resolves();
      sinon.stub(AWS, 'S3').returns(mockS3Client);
      const deleteS3 = sinon.stub(mockS3Client, 'deleteObject').rejects('oops');

      try {
        await artifactService.deleteArtifact('uuid');
        expect.fail();
      } catch (error: any) {
        expect(error.message).to.be.eql('Issue deleting artifact: uuid');
        expect(getStub).to.be.called;
        expect(deleteS3).to.be.called;
        expect(deleteSecurityStub).to.not.be.called;
        expect(deleteStub).to.not.be.called;
      }
    });
  });
});
