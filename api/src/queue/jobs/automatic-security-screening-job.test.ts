import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import * as db from '../../database/db';
import { AutomaticSecurityScreeningService } from '../../services/automatic-security-screening-service';
import {
  IAutomaticSecurityScreeningJobData,
  automaticSecurityScreeningFailedHandler,
  automaticSecurityScreeningJobHandler
} from './automatic-security-screening-job';

chai.use(sinonChai);

const createMockJob = (
  data: IAutomaticSecurityScreeningJobData,
  id = 'job-1'
): PgBoss.Job<IAutomaticSecurityScreeningJobData> =>
  ({
    id,
    name: 'automatic-security-screening',
    data
  } as PgBoss.Job<IAutomaticSecurityScreeningJobData>);

describe('automaticSecurityScreeningJobHandler', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('acquires the advisory lock and calls screenSubmissionUpload', async () => {
    const mockConn = getMockDBConnection();
    mockConn.open = sinon.stub().resolves();
    mockConn.commit = sinon.stub().resolves();
    mockConn.release = sinon.stub();
    mockConn.query = sinon.stub().resolves(mockQueryResult([{ locked: true }]));

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockConn);

    const screenStub = sinon.stub(AutomaticSecurityScreeningService.prototype, 'screenSubmissionUpload').resolves();

    await automaticSecurityScreeningJobHandler([createMockJob({ submissionId: 1, submissionUploadId: 'upload-1' })]);

    expect(screenStub).to.have.been.calledOnceWith('upload-1', 1);
    expect(mockConn.commit).to.have.been.calledOnce;
  });

  it('skips screening when advisory lock is not acquired (concurrent job)', async () => {
    const mockConn = getMockDBConnection();
    mockConn.open = sinon.stub().resolves();
    mockConn.commit = sinon.stub().resolves();
    mockConn.release = sinon.stub();
    mockConn.query = sinon.stub().resolves(mockQueryResult([{ locked: false }]));

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockConn);

    const screenStub = sinon.stub(AutomaticSecurityScreeningService.prototype, 'screenSubmissionUpload');

    await automaticSecurityScreeningJobHandler([createMockJob({ submissionId: 1, submissionUploadId: 'upload-1' })]);

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
    sinon.stub(AutomaticSecurityScreeningService.prototype, 'screenSubmissionUpload').rejects(testError);

    try {
      await automaticSecurityScreeningJobHandler([createMockJob({ submissionId: 1, submissionUploadId: 'upload-1' })]);
      expect.fail('Should have thrown');
    } catch (error) {
      expect((error as Error).message).to.equal('Screening failed');
    }
  });
});

describe('automaticSecurityScreeningFailedHandler', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('logs failure without opening a DB connection', async () => {
    const getConnectionStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection');
    const screenStub = sinon.stub(AutomaticSecurityScreeningService.prototype, 'screenSubmissionUpload');

    const job = {
      id: 'job-1',
      name: 'automatic-security-screening-failed',
      data: { submissionId: 1, submissionUploadId: 'upload-1' },
      output: { message: 'Screening failed after retries' }
    } as unknown as PgBoss.Job<IAutomaticSecurityScreeningJobData>;

    await automaticSecurityScreeningFailedHandler([job]);

    expect(getConnectionStub).not.to.have.been.called;
    expect(screenStub).not.to.have.been.called;
  });

  it('handles null output gracefully (no throw)', async () => {
    const job = {
      id: 'job-2',
      name: 'automatic-security-screening-failed',
      data: { submissionId: 2, submissionUploadId: 'upload-2' },
      output: null
    } as unknown as PgBoss.Job<IAutomaticSecurityScreeningJobData>;

    // DLQ handler is log-only — must not throw
    await automaticSecurityScreeningFailedHandler([job]);
  });
});
