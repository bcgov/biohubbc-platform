import { DeleteObjectCommandOutput } from '@aws-sdk/client-s3';
import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { Artifact, ArtifactRepository } from '../repositories/artifact-repository';
import { FeaturePropertyRecord, SearchIndexRepository } from '../repositories/search-index-respository';
import { SecurityRepository } from '../repositories/security-repository';
import { SubmissionFeatureRecord } from '../repositories/submission-repository';
import * as fileUtils from '../utils/file-utils';
import { getMockDBConnection } from '../__mocks__/db';
import { ArtifactService } from './artifact-service';
import { CodeService } from './code-service';
import { SubmissionService } from './submission-service';

chai.use(sinonChai);

describe('ArtifactService', () => {
  afterEach(() => {
    sinon.restore();
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

  describe('uploadSubmissionFeatureArtifact', () => {
    it('should upload a file to S3 and return a submission feature record', async () => {
      const mockDBConnection = getMockDBConnection();

      const artifactService = new ArtifactService(mockDBConnection);

      const artifactSubmissionFeature: SubmissionFeatureRecord = {
        submission_feature_id: 2,
        uuid: '234-456-234',
        submission_id: 3,
        feature_type_id: 4,
        source_id: 'source-id',
        data: {
          filename: 'test.txt'
        },
        parent_submission_feature_id: 1,
        record_effective_date: '2024-01-01',
        record_end_date: null,
        create_date: '2024-01-01',
        create_user: 3,
        update_date: null,
        update_user: null,
        revision_count: 0
      };

      const getSubmissionFeatureByUuidStub = sinon
        .stub(SubmissionService.prototype, 'getSubmissionFeatureByUuid')
        .resolves(artifactSubmissionFeature);

      const insertSearchableStringRecordsStub = sinon
        .stub(SearchIndexRepository.prototype, 'insertSearchableStringRecords')
        .resolves();

      const uploadFileToS3Stub = sinon.stub(fileUtils, 'uploadFileToS3').resolves();

      const s3FeaturePropertyRecord: FeaturePropertyRecord = {
        feature_property_id: 1,
        feature_property_type_id: 1,
        name: 'artifact_key',
        display_name: 'S3 Key',
        description: 'An S3 Key',
        parent_feature_property_id: null,
        calculated_value: false,
        record_effective_date: '2024-01-01',
        record_end_date: null,
        create_date: '2024-01-01',
        create_user: 3,
        update_date: null,
        update_user: null,
        revision_count: 0
      };

      const getFeaturePropertyByNameStub = sinon
        .stub(CodeService.prototype, 'getFeaturePropertyByName')
        .resolves(s3FeaturePropertyRecord);

      const artifactUploadKey = '234-456-234';
      const artifactFile = {
        fieldname: 'media',
        originalname: 'test.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: 340
      } as Express.Multer.File;

      const response = await artifactService.uploadSubmissionFeatureArtifact(artifactUploadKey, artifactFile);

      expect(getSubmissionFeatureByUuidStub).to.have.been.calledOnceWith(artifactUploadKey);
      expect(getFeaturePropertyByNameStub).to.have.been.calledOnceWith('artifact_key');
      expect(insertSearchableStringRecordsStub).to.have.been.calledOnceWith([
        {
          submission_feature_id: artifactSubmissionFeature.submission_feature_id,
          feature_property_id: s3FeaturePropertyRecord.feature_property_id,
          value: sinon.match.string
        }
      ]);
      expect(uploadFileToS3Stub).to.have.been.calledWithMatch(artifactFile, sinon.match.string, {
        filename: artifactFile.originalname
      });
      expect(response).to.eql(artifactSubmissionFeature);
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
      const artifactService = new ArtifactService(mockDBConnection);
      const artifact = {
        key: 's3 key'
      } as Artifact;
      const getStub = sinon.stub(ArtifactRepository.prototype, 'getArtifactByUUID').resolves(artifact);
      const deleteStub = sinon.stub(ArtifactRepository.prototype, 'deleteArtifactByUUID').resolves();
      const deleteSecurityStub = sinon
        .stub(SecurityRepository.prototype, 'deleteSecurityRulesForArtifactUUID')
        .resolves();

      const mockDeleteResponse: DeleteObjectCommandOutput = {
        $metadata: {},
        DeleteMarker: true,
        RequestCharged: 'requester',
        VersionId: '123456'
      };
      const deleteFileFromS3Stub = sinon.stub(fileUtils, 'deleteFileFromS3').resolves(mockDeleteResponse);

      await artifactService.deleteArtifact('uuid');
      expect(getStub).to.be.called;
      expect(deleteFileFromS3Stub).to.be.calledOnceWith('s3 key');
      expect(deleteSecurityStub).to.be.called;
      expect(deleteStub).to.be.called;
    });

    it('artifact not found for uuid', async () => {
      const mockDBConnection = getMockDBConnection();
      const artifactService = new ArtifactService(mockDBConnection);
      const getStub = sinon.stub(ArtifactRepository.prototype, 'getArtifactByUUID').resolves(null);
      const deleteStub = sinon.stub(ArtifactRepository.prototype, 'deleteArtifactByUUID').resolves();
      const deleteSecurityStub = sinon
        .stub(SecurityRepository.prototype, 'deleteSecurityRulesForArtifactUUID')
        .resolves();

      const mockDeleteResponse: DeleteObjectCommandOutput = {
        $metadata: {},
        DeleteMarker: true,
        RequestCharged: 'requester',
        VersionId: '123456'
      };
      const deleteFileFromS3Stub = sinon.stub(fileUtils, 'deleteFileFromS3').resolves(mockDeleteResponse);

      await artifactService.deleteArtifact('uuid');
      expect(getStub).to.be.called;
      expect(deleteFileFromS3Stub).to.not.be.called;
      expect(deleteSecurityStub).to.not.be.called;
      expect(deleteStub).to.not.be.called;
    });

    it('repo error thrown', async () => {
      const mockDBConnection = getMockDBConnection();
      const artifactService = new ArtifactService(mockDBConnection);
      const artifact = {
        key: 's3 key'
      } as Artifact;
      const getStub = sinon.stub(ArtifactRepository.prototype, 'getArtifactByUUID').resolves(artifact);
      const deleteStub = sinon.stub(ArtifactRepository.prototype, 'deleteArtifactByUUID').throws('Oops');
      const deleteSecurityStub = sinon
        .stub(SecurityRepository.prototype, 'deleteSecurityRulesForArtifactUUID')
        .resolves();

      const mockDeleteResponse: DeleteObjectCommandOutput = {
        $metadata: {},
        DeleteMarker: true,
        RequestCharged: 'requester',
        VersionId: '123456'
      };
      const deleteFileFromS3Stub = sinon.stub(fileUtils, 'deleteFileFromS3').resolves(mockDeleteResponse);

      try {
        await artifactService.deleteArtifact('uuid');
        expect.fail();
      } catch (error: any) {
        expect(error.message).to.be.eql('Issue deleting artifact: uuid');
        expect(getStub).to.be.called;
        expect(deleteSecurityStub).to.be.called;
        expect(deleteStub).to.be.called;
        expect(deleteFileFromS3Stub).to.not.be.called;
      }
    });
  });
});
