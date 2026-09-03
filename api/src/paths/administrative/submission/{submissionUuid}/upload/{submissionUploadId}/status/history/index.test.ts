import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../../__mocks__/db';
import * as db from '../../../../../../../../database/db';
import { ApiNotFoundError } from '../../../../../../../../errors/api-error';
import { SubmissionUploadProcessingStatusHistoryItem } from '../../../../../../../../models/submission-upload-processing-status';
import { SubmissionUploadService } from '../../../../../../../../services/upload/submission-upload-service';
import { getSubmissionUploadProcessingStatusHistory } from './index';

chai.use(sinonChai);

const SUBMISSION_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SUBMISSION_UPLOAD_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('paths/administrative/submission/{submissionUuid}/upload/{submissionUploadId}/status/history', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('GET returns the processing status history for the upload', async () => {
    const { commit, release } = registerConnection();
    const history: SubmissionUploadProcessingStatusHistoryItem[] = [
      buildHistoryItem(1, 'uploaded'),
      buildHistoryItem(2, 'ingesting')
    ];
    const findStub = sinon
      .stub(SubmissionUploadService.prototype, 'findSubmissionUploadProcessingStatusHistory')
      .resolves(history);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionUuid: SUBMISSION_UUID, submissionUploadId: SUBMISSION_UPLOAD_ID };

    await getSubmissionUploadProcessingStatusHistory()(mockReq, mockRes, mockNext);

    expect(findStub).to.have.been.calledOnceWith(SUBMISSION_UUID, SUBMISSION_UPLOAD_ID);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(history);
    expect(commit).to.have.been.calledOnce;
    expect(release).to.have.been.calledOnce;
  });

  it('GET rolls back and rethrows when the upload does not belong to the submission', async () => {
    const { rollback, release } = registerConnection();
    const notFound = new ApiNotFoundError('Submission upload not found');
    sinon.stub(SubmissionUploadService.prototype, 'findSubmissionUploadProcessingStatusHistory').rejects(notFound);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionUuid: SUBMISSION_UUID, submissionUploadId: SUBMISSION_UPLOAD_ID };

    try {
      await getSubmissionUploadProcessingStatusHistory()(mockReq, mockRes, mockNext);
      expect.fail('Expected ApiNotFoundError not thrown');
    } catch (error) {
      expect(error).to.equal(notFound);
    }

    expect(rollback).to.have.been.calledOnce;
    expect(release).to.have.been.calledOnce;
  });
});

const registerConnection = () => {
  const stubs = {
    commit: sinon.stub(),
    rollback: sinon.stub(),
    release: sinon.stub()
  };
  const mockDBConnection = getMockDBConnection({ systemUserId: () => 7, ...stubs });
  sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
  return stubs;
};

const buildHistoryItem = (
  submissionUploadStatusId: number,
  status: SubmissionUploadProcessingStatusHistoryItem['status']
): SubmissionUploadProcessingStatusHistoryItem => ({
  submission_upload_status_id: submissionUploadStatusId,
  submission_upload_id: SUBMISSION_UPLOAD_ID,
  status,
  create_date: new Date('2026-09-03T00:00:00.000Z')
});
