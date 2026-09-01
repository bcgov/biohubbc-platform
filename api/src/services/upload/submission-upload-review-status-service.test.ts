import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { SubmissionUploadReviewStatusRepository } from '../../repositories/upload/submission-upload-review-status-repository';
import { SubmissionService } from '../submission-service';
import { SubmissionUploadReviewStatusService } from './submission-upload-review-status-service';

chai.use(sinonChai);

describe('SubmissionUploadReviewStatusService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getSubmissionHistoryByUuid', () => {
    it('returns status history for the submission UUID', async () => {
      sinon.stub(SubmissionUploadReviewStatusRepository.prototype, 'getStatusHistoryBySubmissionUuid').resolves([
        {
          submission_id: 42,
          submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
          status: 'approved',
          create_date: new Date('2026-01-01T00:00:00.000Z')
        }
      ]);
      const getSubmissionStub = sinon.stub(SubmissionService.prototype, 'getSubmissionIdByUUID');
      const service = new SubmissionUploadReviewStatusService(getMockDBConnection());

      const result = await service.getSubmissionHistoryByUuid('11111111-1111-1111-1111-111111111111');

      expect(result).to.deep.equal({
        submissionId: 42,
        history: [
          {
            submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
            status: 'approved',
            createDate: '2026-01-01T00:00:00.000Z'
          }
        ]
      });
      expect(getSubmissionStub).not.to.have.been.called;
    });

    it('verifies the submission exists when it has no status history', async () => {
      sinon.stub(SubmissionUploadReviewStatusRepository.prototype, 'getStatusHistoryBySubmissionUuid').resolves([]);
      const getSubmissionStub = sinon
        .stub(SubmissionService.prototype, 'getSubmissionIdByUUID')
        .resolves({ submission_id: 42 });
      const service = new SubmissionUploadReviewStatusService(getMockDBConnection());

      const result = await service.getSubmissionHistoryByUuid('11111111-1111-1111-1111-111111111111');

      expect(result).to.deep.equal({ submissionId: 42, history: [] });
      expect(getSubmissionStub).to.have.been.calledOnceWith('11111111-1111-1111-1111-111111111111');
    });
  });
});
