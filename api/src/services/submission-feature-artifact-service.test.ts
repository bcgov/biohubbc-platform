import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SubmissionFeatureArtifactRepository } from '../repositories/submission-feature-artifact-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionFeatureArtifactService } from './submission-feature-artifact-service';

chai.use(sinonChai);

describe('SubmissionFeatureArtifactService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertSubmissionFeatureArtifacts', () => {
    it('should delegate bulk insert to repository', async () => {
      const mockDB = getMockDBConnection();
      const service = new SubmissionFeatureArtifactService(mockDB);

      const stub = sinon
        .stub(SubmissionFeatureArtifactRepository.prototype, 'insertSubmissionFeatureArtifacts')
        .resolves();

      await service.insertSubmissionFeatureArtifacts([
        {
          submission_feature_id: 123,
          artifact_id: '550e8400-e29b-41d4-a716-446655440000'
        }
      ]);

      expect(stub).to.have.been.calledOnceWith([
        {
          submission_feature_id: 123,
          artifact_id: '550e8400-e29b-41d4-a716-446655440000'
        }
      ]);
    });
  });

  describe('softDeleteBySubmissionUploadId', () => {
    it('should delegate to repository', async () => {
      const mockDB = getMockDBConnection();
      const service = new SubmissionFeatureArtifactService(mockDB);

      const stub = sinon
        .stub(SubmissionFeatureArtifactRepository.prototype, 'softDeleteBySubmissionUploadId')
        .resolves();

      await service.softDeleteBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(stub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000');
    });
  });
});
