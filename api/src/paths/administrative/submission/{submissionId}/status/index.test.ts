import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getSubmissionUploadStatus } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { SubmissionUploadStatus } from '../../../../../models/submission-upload-status';
import { SubmissionUploadStatusService } from '../../../../../services/submission-upload-status-service';

chai.use(sinonChai);

describe('getSubmissionUploadStatus', () => {
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
    mockReq.params = { submissionId: '1' };

    const requestHandler = getSubmissionUploadStatus();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return the submission upload status', async () => {
    const mockDBConnection = getMockDBConnection({
      open: sinon.stub(),
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const submissionId = 123;

    const mockStatus: SubmissionUploadStatus = {
      submission_id: submissionId,
      upload: { upload_id: 'uuid-123', upload_status: 'completed' },
      upload_archives: [
        {
          upload_archive_id: 'uuid-archive',
          archive_status: 'completed',
          byte_size: 1024,
          security: 'clean'
        }
      ],
      artifacts: {
        feature: { count: 2, byte_size: 512 },
        attachment: { count: 1, byte_size: 256 }
      },
      scans: [],
      scan_files: []
    };

    const serviceStub = sinon
      .stub(SubmissionUploadStatusService.prototype, 'getSubmissionUploadStatus')
      .resolves(mockStatus);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionId: String(submissionId) };

    const requestHandler = getSubmissionUploadStatus();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(serviceStub).to.have.been.calledOnceWithExactly(submissionId);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockStatus);
  });
});
