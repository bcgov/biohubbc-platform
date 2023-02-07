import { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SubmissionJobQueueRepository } from '../repositories/submission-job-queue-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionJobQueueService } from './submission-job-queue-service';

chai.use(sinonChai);

describe.only('SubmissionJobQueueService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createQueueJob', () => {
    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SubmissionJobQueueService(mockDBConnection);
      const repo = sinon.stub(SubmissionJobQueueRepository.prototype, 'insertJobQueueRecord').resolves({ queue_id: 1 });

      const response = await service.createQueueJob(1, 1, {
        first_nations_id: 1,
        proprietor_type_id: 1,
        survey_id: 1,
        rational: '',
        proprietor_name: 1,
        disa_required: false
      });
      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql(1);
    });
  });

  describe('getSourceTransformIdForUserId', () => {
    it('should return an transform ID', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SubmissionJobQueueService(mockDBConnection);
      const repo = sinon.stub(SubmissionJobQueueRepository.prototype, 'getSourceTransformIdForUserId').resolves(1);

      const response = await service.getSourceTransformIdForUserId(1);
      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql(1);
    });
  });
});
