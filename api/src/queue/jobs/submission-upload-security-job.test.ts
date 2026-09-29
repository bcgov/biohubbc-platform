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

  it('turns JIT off for the transaction after taking the lock and before screening', async () => {
    const mockConn = getMockDBConnection();
    mockConn.open = sinon.stub().resolves();
    mockConn.commit = sinon.stub().resolves();
    mockConn.release = sinon.stub();
    const query = sinon.stub().resolves(mockQueryResult([{ locked: true }]));
    mockConn.query = query;

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockConn);

    const screenStub = sinon.stub(SubmissionUploadSecurityService.prototype, 'screenSubmissionUpload').resolves();

    await submissionUploadSecurityJobHandler([createMockJob({ submissionId: 1, submissionUploadId: 'upload-1' })]);

    expect(query.getCalls().map((call) => call.args[0])).to.eql([
      'SELECT pg_try_advisory_xact_lock(hashtextextended($1::text, 2)) AS locked',
      'SET LOCAL jit = off'
    ]);
    expect(query.secondCall.calledBefore(screenStub.firstCall)).to.be.true;
  });

  it('starts every job in a batch without waiting for the one before it', async () => {
    const getConnection = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').callsFake(() => {
      const conn = getMockDBConnection();
      conn.open = sinon.stub().resolves();
      conn.commit = sinon.stub().resolves();
      conn.release = sinon.stub();
      conn.query = sinon.stub().resolves(mockQueryResult([{ locked: true }]));
      return conn;
    });

    let finishFirstScreen: (() => void) | undefined;
    const screenStub = sinon.stub(SubmissionUploadSecurityService.prototype, 'screenSubmissionUpload');
    screenStub.withArgs('upload-1').returns(
      new Promise<void>((resolve) => {
        finishFirstScreen = () => resolve();
      })
    );
    screenStub.withArgs('upload-2').resolves();

    let batchSettled = false;
    const batch = submissionUploadSecurityJobHandler([
      createMockJob({ submissionId: 1, submissionUploadId: 'upload-1' }, 'job-1'),
      createMockJob({ submissionId: 2, submissionUploadId: 'upload-2' }, 'job-2')
    ]).then(() => {
      batchSettled = true;
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(screenStub).to.have.been.calledWith('upload-2', 2, 'job-2');
    expect(batchSettled).to.be.false;

    finishFirstScreen?.();
    await batch;

    expect(screenStub).to.have.been.calledTwice;
    expect(getConnection).to.have.been.calledTwice;
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
      expect(mockConn.rollback).to.have.been.calledOnce;
      expect(mockConn.commit).not.to.have.been.called;
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
      .stub(SubmissionUploadSecurityService.prototype, 'recordSubmissionUploadSecurityFailure')
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
    expect(recordFailureStub).to.have.been.calledOnceWith('upload-1', 1, 'job-1');
  });

  it('records a failed scan event and logs the default message when output is null', async () => {
    stubConnections();
    const recordFailureStub = sinon
      .stub(SubmissionUploadSecurityService.prototype, 'recordSubmissionUploadSecurityFailure')
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
    expect(recordFailureStub).to.have.been.calledOnceWith('upload-2', 2, 'job-2');
  });
});
