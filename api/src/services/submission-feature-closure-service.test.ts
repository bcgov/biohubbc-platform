import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionUpload } from '../models/submission-upload';
import { SubmissionFeatureClosureRepository } from '../repositories/submission-feature-closure-repository';
import { SubmissionFeatureClosureService } from './submission-feature-closure-service';
import { SubmissionUploadService } from './upload/submission-upload-service';

chai.use(sinonChai);

describe('SubmissionFeatureClosureService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('computeClosureForSubmission', () => {
    it('should delete the prior rows, recompute, and wrap the row count in insertedCount', async () => {
      const deleteStub = sinon
        .stub(SubmissionFeatureClosureRepository.prototype, 'invalidateClosureForSubmission')
        .resolves();
      const computeStub = sinon
        .stub(SubmissionFeatureClosureRepository.prototype, 'computeClosureForSubmission')
        .resolves(5);

      const service = new SubmissionFeatureClosureService(getMockDBConnection());

      const result = await service.computeClosureForSubmission(42);

      expect(deleteStub).to.have.been.calledOnceWith(42);
      expect(computeStub).to.have.been.calledOnceWith(42);
      expect(deleteStub).to.have.been.calledBefore(computeStub);
      expect(result).to.eql({ insertedCount: 5 });
    });
  });

  describe('computeClosureForUpload', () => {
    it("should resolve the upload's submission and recompute that submission's closure", async () => {
      const getUploadStub = sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUpload').resolves({
        submission_upload_id: 'cb7d9e3a-4f12-4c1b-9d4a-1e2f3a4b5c6d',
        submission_id: 42,
        upload_id: 'a1b2c3d4-0000-0000-0000-000000000000',
        status: 'indexed',
        ticket_id: 'b2c3d4e5-0000-0000-0000-000000000000',
        blueprint_id: 1
      } as SubmissionUpload);
      const deleteStub = sinon
        .stub(SubmissionFeatureClosureRepository.prototype, 'invalidateClosureForSubmission')
        .resolves();
      const computeStub = sinon
        .stub(SubmissionFeatureClosureRepository.prototype, 'computeClosureForSubmission')
        .resolves(5);

      const service = new SubmissionFeatureClosureService(getMockDBConnection());

      const result = await service.computeClosureForUpload('cb7d9e3a-4f12-4c1b-9d4a-1e2f3a4b5c6d');

      expect(getUploadStub).to.have.been.calledOnceWith('cb7d9e3a-4f12-4c1b-9d4a-1e2f3a4b5c6d');
      expect(deleteStub).to.have.been.calledOnceWith(42);
      expect(computeStub).to.have.been.calledOnceWith(42);
      expect(result).to.eql({ insertedCount: 5 });
    });
  });
});
