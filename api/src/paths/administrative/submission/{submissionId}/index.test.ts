import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { patchSubmissionRecord } from '.';
import * as db from '../../../../database/db';
import { HTTPError } from '../../../../errors/http-error';
import { SubmissionRecord } from '../../../../repositories/submission-repository';
import { SubmissionService } from '../../../../services/submission-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';

chai.use(sinonChai);

describe('patchSubmissionRecord', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('re-throws any error that is thrown', async () => {
    const mockDBConnection = getMockDBConnection({
      open: () => {
        throw new Error('test error');
      }
    });

    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const requestHandler = patchSubmissionRecord();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).message).to.equal('test error');
    }
  });

  it('should return the patched submission record', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const submissionId = 1;

    const mockSubmissionRecord: SubmissionRecord = {
      submission_id: 3,
      uuid: '999-456-123',
      security_review_timestamp: '2023-12-12',
      publish_timestamp: '2023-12-12',
      submitted_timestamp: '2023-12-12',
      system_user_id: 3,
      source_system: 'SIMS',
      name: 'name',
      description: 'description',
      comment: 'comment',
      create_date: '2023-12-12',
      create_user: 1,
      update_date: '2023-12-12',
      update_user: 1,
      revision_count: 1
    };

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = {
      submissionId: String(submissionId)
    };
    mockReq.body = {
      security_reviewed: true,
      published: true
    };

    const getReviewedSubmissionsStub = sinon
      .stub(SubmissionService.prototype, 'patchSubmissionRecord')
      .resolves(mockSubmissionRecord);

    const requestHandler = patchSubmissionRecord();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(getReviewedSubmissionsStub).to.have.been.calledOnceWith(submissionId, {
      security_reviewed: true,
      published: true
    });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockSubmissionRecord);
  });
});
