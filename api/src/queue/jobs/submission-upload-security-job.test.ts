import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import * as db from '../../database/db';
import { SubmissionUploadSecurityService } from '../../services/submission-upload-security-service';
import {
  ISubmissionUploadSecurityJobData,
  submissionUploadSecurityFailedHandler,
  submissionUploadSecurityJobHandler
} from './submission-upload-security-job';

chai.use(sinonChai);

const createMockJob = (
  data: ISubmissionUploadSecurityJobData,
  id = 'job-1'
): PgBoss.Job<ISubmissionUploadSecurityJobData> =>
  ({
    id,
    name: 'submission-upload-security',
    data
  } as PgBoss.Job<ISubmissionUploadSecurityJobData>);

describe('submissionUploadSecurityJobHandler', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('acquires the advisory lock and calls screenSubmissionUpload with the job id', async () => {
    const mockConn = getMockDBConnection();
    mockConn.open = sinon.stub().resolves();
    mockConn.commit = sinon.stub().resolves();
    mockConn.release = sinon.stub();
    mockConn.query = sinon.stub().resolves(mockQueryResult([{ locked: true }]));

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockConn);

    const screenStub = sinon.stub(SubmissionUploadSecurityService.prototype, 'screenSubmissionUpload').resolves();

    await submissionUploadSecurityJobHandler([createMockJob({ submissionId: 1, submissionUploadId: 'upload-1' })]);

    expect(screenStub).to.have.been.calledOnceWith('upload-1', 1, 'job-1');
    expect(mockConn.commit).to.have.been.calledOnce;
  });

  it('skips screening when advisory lock is not acquired (concurrent job)', async () => {
    const mockConn = getMockDBConnection();
    mockConn.open = sinon.stub().resolves();
    mockConn.commit = sinon.stub().resolves();
    mockConn.release = sinon.stub();
    mockConn.query = sinon.stub().resolves(mockQueryResult([{ locked: false }]));

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockConn);

    const screenStub = sinon.stub(SubmissionUploadSecurityService.prototype, 'screenSubmissionUpload');

    await submissionUploadSecurityJobHandler([createMockJob({ submissionId: 1, submissionUploadId: 'upload-1' })]);

    expect(screenStub).to.not.have.been.called;
  });

  it('rethrows when screenSubmissionUpload throws (pg-boss handles retry)', async () => {
    const mockConn = getMockDBConnection();
    mockConn.open = sinon.stub().resolves();
    mockConn.commit = sinon.stub().resolves();
    mockConn.rollback = sinon.stub().resolves();
    mockConn.release = sinon.stub();
    mockConn.query = sinon.stub().resolves(mockQueryResult([{ locked: true }]));

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockConn);

    const testError = new Error('Screening failed');
    sinon.stub(SubmissionUploadSecurityService.prototype, 'screenSubmissionUpload').rejects(testError);

    try {
      await submissionUploadSecurityJobHandler([createMockJob({ submissionId: 1, submissionUploadId: 'upload-1' })]);
      expect.fail('Should have thrown');
    } catch (error) {
      expect((error as Error).message).to.equal('Screening failed');
    }
  });
});

describe('submissionUploadSecurityFailedHandler', () => {
  afterEach(() => {
    sinon.restore();
  });

  const stubConnections = () => {
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').callsFake(() => {
      const conn = getMockDBConnection();
      conn.open = sinon.stub().resolves();
      conn.commit = sinon.stub().resolves();
      conn.rollback = sinon.stub().resolves();
      conn.release = sinon.stub();
      return conn;
    });
  };

  it('records a failed scan event without throwing or touching submission_upload.status', async () => {
    stubConnections();
    const recordFailureStub = sinon
      .stub(SubmissionUploadSecurityService.prototype, 'recordScreeningFailure')
      .resolves();

    const job = {
      id: 'job-1',
      name: 'submission-upload-security-failed',
      data: { submissionId: 1, submissionUploadId: 'upload-1' },
      output: { message: 'Screening failed after retries' }
    } as unknown as PgBoss.Job<ISubmissionUploadSecurityJobData>;

    let thrownError: unknown;
    try {
      await submissionUploadSecurityFailedHandler([job]);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).to.be.undefined;
    expect(recordFailureStub).to.have.been.calledOnceWith('upload-1', 'job-1');
  });

  it('records a failed scan event and logs the default message when output is null', async () => {
    stubConnections();
    const recordFailureStub = sinon
      .stub(SubmissionUploadSecurityService.prototype, 'recordScreeningFailure')
      .resolves();

    const job = {
      id: 'job-2',
      name: 'submission-upload-security-failed',
      data: { submissionId: 2, submissionUploadId: 'upload-2' },
      output: null
    } as unknown as PgBoss.Job<ISubmissionUploadSecurityJobData>;

    let thrownError: unknown;
    try {
      await submissionUploadSecurityFailedHandler([job]);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).to.be.undefined;
    expect(recordFailureStub).to.have.been.calledOnceWith('upload-2', 'job-2');
  });
});
