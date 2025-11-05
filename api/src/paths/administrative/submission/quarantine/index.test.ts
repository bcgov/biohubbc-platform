import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getQuarantinedSubmissions } from '.';
import * as db from '../../../../database/db';
import { HTTPError } from '../../../../errors/http-error';
import { QuarantineStatusEnum } from '../../../../models/quarantine';
import { SubmissionRecordWithQuarantine } from '../../../../models/submission';
import { QuarantineService } from '../../../../services/quarantine/quarantine-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';

chai.use(sinonChai);

describe('getQuarantinedSubmissions', () => {
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

    const requestHandler = getQuarantinedSubmissions();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).message).to.equal('test error');
    }
  });

  it('should return an array of quarantined submission objects', async () => {
    const dbConnectionObj = getMockDBConnection({
      open: sinon.stub(),
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const mockSubmissionRecords: SubmissionRecordWithQuarantine[] = [
      {
        submission_id: 1,
        name: 'Test Submission 1',
        description: 'Test description 1',
        submitted_timestamp: '2023-12-12',
        quarantine: {
          quarantine_id: 'uuid-1',
          uri: 'http://example.com/file1',
          status: QuarantineStatusEnum.PENDING,
          upload_id: 'upload-1'
        }
      },
      {
        submission_id: 2,
        name: 'Test Submission 2',
        description: 'Test description 2',
        submitted_timestamp: '2023-12-12',
        quarantine: {
          quarantine_id: 'uuid-2',
          uri: 'http://example.com/file2',
          status: QuarantineStatusEnum.CLEAN,
          upload_id: 'upload-2'
        }
      }
    ];

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const getQuarantineRecordsWithScansStub = sinon
      .stub(QuarantineService.prototype, 'getQuarantineRecordsWithScans')
      .resolves(mockSubmissionRecords);

    const requestHandler = getQuarantinedSubmissions();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(getQuarantineRecordsWithScansStub).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ submissions: mockSubmissionRecords });
  });
});
