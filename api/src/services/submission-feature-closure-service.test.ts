import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionFeatureClosureRepository } from '../repositories/submission-feature-closure-repository';
import { SubmissionFeatureClosureService } from './submission-feature-closure-service';

chai.use(sinonChai);

describe('SubmissionFeatureClosureService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('computeClosureForUpload', () => {
    it('should delete the prior rows, recompute, and wrap the row count in insertedCount', async () => {
      const deleteStub = sinon.stub(SubmissionFeatureClosureRepository.prototype, 'deleteClosureForUpload').resolves();
      const computeStub = sinon
        .stub(SubmissionFeatureClosureRepository.prototype, 'computeClosureForUpload')
        .resolves(5);

      const service = new SubmissionFeatureClosureService(getMockDBConnection());

      const result = await service.computeClosureForUpload('cb7d9e3a-4f12-4c1b-9d4a-1e2f3a4b5c6d');

      expect(deleteStub).to.have.been.calledOnceWith('cb7d9e3a-4f12-4c1b-9d4a-1e2f3a4b5c6d');
      expect(computeStub).to.have.been.calledOnceWith('cb7d9e3a-4f12-4c1b-9d4a-1e2f3a4b5c6d');
      expect(deleteStub).to.have.been.calledBefore(computeStub);
      expect(result).to.eql({ insertedCount: 5 });
    });
  });
});
