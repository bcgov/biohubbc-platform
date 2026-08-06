import { expect } from 'chai';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { SubmissionUploadReviewStatus } from '../../models/submission-upload-review-status';
import { SubmissionUploadReviewStatusRepository } from './submission-upload-review-status-repository';

describe('SubmissionUploadReviewStatusRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertSubmissionUploadReviewStatus', () => {
    it('returns the inserted status row', async () => {
      const status = buildStatus({ status: 'approved' });
      const sqlStub = sinon
        .stub()
        .resolves({ rowCount: 1, rows: [status] } as QueryResult<SubmissionUploadReviewStatus>);
      const repository = new SubmissionUploadReviewStatusRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.insertSubmissionUploadReviewStatus({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'approved'
      });

      expect(result).to.eql(status);
      expect(sqlStub.calledOnce).to.equal(true);
    });

    it('throws ApiExecuteSQLError when insert row count is not one', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 0, rows: [] } as QueryResult<SubmissionUploadReviewStatus>);
      const repository = new SubmissionUploadReviewStatusRepository(getMockDBConnection({ sql: sqlStub }));

      try {
        await repository.insertSubmissionUploadReviewStatus({
          submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
          status: 'approved'
        });

        expect.fail('Expected ApiExecuteSQLError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert submission_upload_status record');
      }
    });
  });

  describe('getSubmissionUploadReviewStatus', () => {
    it('returns the latest status row for a submission upload', async () => {
      const status = buildStatus({ submission_upload_status_id: 3, status: 'denied' });
      const sqlStub = sinon
        .stub()
        .resolves({ rowCount: 1, rows: [status] } as QueryResult<SubmissionUploadReviewStatus>);
      const repository = new SubmissionUploadReviewStatusRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.getSubmissionUploadReviewStatus('550e8400-e29b-41d4-a716-446655440000');

      expect(result).to.eql(status);
      expect(sqlStub.firstCall.args[0].text).to.contain('ORDER BY');
      expect(sqlStub.firstCall.args[0].text).to.contain('create_date DESC');
      expect(sqlStub.firstCall.args[0].text).to.contain('submission_upload_status_id DESC');
      expect(sqlStub.firstCall.args[0].text).to.contain('LIMIT 1');
    });

    it('throws ApiNotFoundError when no status row exists', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 0, rows: [] } as QueryResult<SubmissionUploadReviewStatus>);
      const repository = new SubmissionUploadReviewStatusRepository(getMockDBConnection({ sql: sqlStub }));

      try {
        await repository.getSubmissionUploadReviewStatus('550e8400-e29b-41d4-a716-446655440000');

        expect.fail('Expected ApiNotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect((error as ApiNotFoundError).message).to.equal('Submission upload status not found');
      }
    });
  });

  describe('getStatusHistoryBySubmissionUuid', () => {
    it('queries status history using the submission UUID', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 0, rows: [] } as QueryResult<any>);
      const repository = new SubmissionUploadReviewStatusRepository(getMockDBConnection({ sql: sqlStub }));
      const submissionUuid = '11111111-1111-1111-1111-111111111111';

      const result = await repository.getStatusHistoryBySubmissionUuid(submissionUuid);

      expect(result).to.eql([]);
      expect(sqlStub.firstCall.args[0].text).to.contain('s.uuid =');
      expect(sqlStub.firstCall.args[0].values).to.eql([submissionUuid]);
    });
  });
});

const buildStatus = (params: {
  submission_upload_status_id?: number;
  status: SubmissionUploadReviewStatus['status'];
}): SubmissionUploadReviewStatus => ({
  submission_upload_status_id: params.submission_upload_status_id ?? 1,
  submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
  status: params.status
});
