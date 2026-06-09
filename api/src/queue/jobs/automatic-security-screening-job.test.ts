import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import * as db from '../../database/db';
import { AutomaticSecurityScreeningService } from '../../services/automatic-security-screening-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
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

  it('marks upload failed and logs failure without throwing', async () => {
    stubConnections();
    const transitionStatusStub = sinon
      .stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadStatus')
      .resolves();

    const job = {
      id: 'job-1',
      name: 'automatic-security-screening-failed',
      data: { submissionId: 1, submissionUploadId: 'upload-1' },
      output: { message: 'Screening failed after retries' }
    } as unknown as PgBoss.Job<IAutomaticSecurityScreeningJobData>;

    let thrownError: unknown;
    try {
      await automaticSecurityScreeningFailedHandler([job]);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).to.be.undefined;
    expect(transitionStatusStub.calledWith('upload-1', 'failed', ['indexed', 'security_screening', 'failed'])).to.be
      .true;
  });

  it('marks upload failed and logs default message when output is null', async () => {
    stubConnections();
    const transitionStatusStub = sinon
      .stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadStatus')
      .resolves();

    const job = {
      id: 'job-2',
      name: 'automatic-security-screening-failed',
      data: { submissionId: 2, submissionUploadId: 'upload-2' },
      output: null
    } as unknown as PgBoss.Job<IAutomaticSecurityScreeningJobData>;

    let thrownError: unknown;
    try {
      await automaticSecurityScreeningFailedHandler([job]);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).to.be.undefined;
    expect(transitionStatusStub.calledWith('upload-2', 'failed', ['indexed', 'security_screening', 'failed'])).to.be
      .true;
  });
});
