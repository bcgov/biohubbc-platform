import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { deleteSubmissionUpload } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { SubmissionUploadService } from '../../../../../services/upload/submission-upload-service';

chai.use(sinonChai);

describe('delete submission upload handler', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('delegates submission upload deletion to the service', async () => {
    const connection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);

    const submissionUuid = '11111111-1111-1111-1111-111111111111';
    const submissionUploadId = '22222222-2222-2222-2222-222222222222';
    const deleteStub = sinon.stub(SubmissionUploadService.prototype, 'deleteSubmissionUpload').resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionUuid, submissionUploadId };

    await deleteSubmissionUpload()(mockReq, mockRes, mockNext);

    expect(deleteStub).to.have.been.calledOnceWith(submissionUuid, submissionUploadId);
    expect(connection.commit).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(204);
  });

  it('rolls back when the service rejects deletion', async () => {
    const connection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);

    const submissionUploadId = '22222222-2222-2222-2222-222222222222';
    sinon.stub(SubmissionUploadService.prototype, 'deleteSubmissionUpload').rejects(new Error('Delete failed'));

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = {
      submissionUuid: '11111111-1111-1111-1111-111111111111',
      submissionUploadId
    };

    try {
      await deleteSubmissionUpload()(mockReq, mockRes, mockNext);
      expect.fail('Expected reviewed upload deletion to fail');
    } catch {
      expect(connection.rollback).to.have.been.calledOnce;
      expect(connection.commit).not.to.have.been.called;
    }
  });
});
