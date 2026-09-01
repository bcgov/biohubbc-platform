import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { HTTP409 } from '../../errors/http-error';
import { SubmissionUploadReviewStatusRepository } from '../../repositories/upload/submission-upload-review-status-repository';
import { SubmissionFeatureService } from '../submission-feature-service';
import { SubmissionService } from '../submission-service';
import { SubmissionUploadReviewStatusService } from './submission-upload-review-status-service';

chai.use(sinonChai);

describe('SubmissionUploadReviewStatusService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertSubmissionUploadReviewStatus', () => {
    const submissionUploadId = '550e8400-e29b-41d4-a716-446655440000';

    it('guards a non-approval status against activated upload state', async () => {
      const guard = sinon
        .stub(SubmissionFeatureService.prototype, 'getActivatedSubmissionFeatureCountBySubmissionUploadId')
        .resolves(1);
      const insert = sinon.stub(SubmissionUploadReviewStatusRepository.prototype, 'insertSubmissionUploadReviewStatus');
      const service = new SubmissionUploadReviewStatusService(getMockDBConnection());

      try {
        await service.insertSubmissionUploadReviewStatus({
          submission_upload_id: submissionUploadId,
          status: 'denied'
        });
        expect.fail('Expected HTTP409');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
      }
      expect(guard).to.have.been.calledOnceWith(submissionUploadId);
      expect(insert).not.to.have.been.called;
    });

    it('allows pending uploads to receive a non-approval status', async () => {
      sinon
        .stub(SubmissionFeatureService.prototype, 'getActivatedSubmissionFeatureCountBySubmissionUploadId')
        .resolves(0);
      const insert = sinon
        .stub(SubmissionUploadReviewStatusRepository.prototype, 'insertSubmissionUploadReviewStatus')
        .resolves({ submission_upload_status_id: 1, submission_upload_id: submissionUploadId, status: 'denied' });
      const service = new SubmissionUploadReviewStatusService(getMockDBConnection());

      expect(
        await service.insertSubmissionUploadReviewStatus({ submission_upload_id: submissionUploadId, status: 'denied' })
      ).to.include({ status: 'denied' });
      expect(insert).to.have.been.calledOnce;
    });

    it('allows the approval status after activation without invoking the reversal guard', async () => {
      const guard = sinon.stub(
        SubmissionFeatureService.prototype,
        'getActivatedSubmissionFeatureCountBySubmissionUploadId'
      );
      const insert = sinon
        .stub(SubmissionUploadReviewStatusRepository.prototype, 'insertSubmissionUploadReviewStatus')
        .resolves({ submission_upload_status_id: 1, submission_upload_id: submissionUploadId, status: 'approved' });
      const service = new SubmissionUploadReviewStatusService(getMockDBConnection());

      expect(
        await service.insertSubmissionUploadReviewStatus({
          submission_upload_id: submissionUploadId,
          status: 'approved'
        })
      ).to.include({ status: 'approved' });
      expect(guard).not.to.have.been.called;
      expect(insert).to.have.been.calledOnce;
    });
  });

  describe('activation immutability guards', () => {
    it('blocks a single upload when it owns an ever-activated feature', async () => {
      sinon
        .stub(SubmissionFeatureService.prototype, 'getActivatedSubmissionFeatureCountBySubmissionUploadId')
        .resolves(1);
      const service = new SubmissionUploadReviewStatusService(getMockDBConnection());

      try {
        await service.assertSubmissionUploadHasNoActivatedFeatures('550e8400-e29b-41d4-a716-446655440000');
        expect.fail('Expected HTTP409');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
      }
    });

    it('blocks a submission when any upload owns an ever-activated feature', async () => {
      sinon.stub(SubmissionFeatureService.prototype, 'getActivatedSubmissionFeatureCountBySubmissionId').resolves(1);
      const service = new SubmissionUploadReviewStatusService(getMockDBConnection());

      try {
        await service.assertSubmissionHasNoActivatedFeatures(9);
        expect.fail('Expected HTTP409');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
      }
    });
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
