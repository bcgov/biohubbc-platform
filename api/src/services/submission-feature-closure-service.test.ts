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
    it('should wrap the repository row count in insertedCount', async () => {
      const stub = sinon.stub(SubmissionFeatureClosureRepository.prototype, 'computeClosureForUpload').resolves(5);

      const service = new SubmissionFeatureClosureService(getMockDBConnection());

      const result = await service.computeClosureForUpload('cb7d9e3a-4f12-4c1b-9d4a-1e2f3a4b5c6d');

      expect(stub).to.have.been.calledOnceWith('cb7d9e3a-4f12-4c1b-9d4a-1e2f3a4b5c6d');
      expect(result).to.eql({ insertedCount: 5 });
    });
  });
});
