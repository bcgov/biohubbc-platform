import AWS from 'aws-sdk';
import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { Artifact, ArtifactRepository } from '../repositories/artifact-repository';
import { SecurityRepository } from '../repositories/security-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { ArtifactService } from './artifact-service';

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
        expect(deleteSecurityStub).to.be.called;
        expect(deleteStub).to.be.called;
        expect(deleteS3).to.not.be.called;
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
        expect(deleteSecurityStub).to.be.called;
        expect(deleteStub).to.be.called;
      }
    });
  });
});
