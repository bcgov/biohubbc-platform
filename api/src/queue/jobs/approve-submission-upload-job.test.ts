import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import * as db from '../../database/db';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import {
  approveSubmissionUploadFailedHandler,
  approveSubmissionUploadJobHandler,
  IApproveSubmissionUploadJobData
} from './approve-submission-upload-job';

chai.use(sinonChai);

describe('approve-submission-upload-job', () => {
  afterEach(() => {
    sinon.restore();
  });

  const createMockJob = (submissionUploadId = 'submission-upload-1'): PgBoss.Job<IApproveSubmissionUploadJobData> =>
    ({
      id: 'job-1',
      name: 'approve-submission-upload',
      data: { submissionUploadId }
    } as PgBoss.Job<IApproveSubmissionUploadJobData>);

  const stubConnection = () => {
    const connection = getMockDBConnection();
    connection.open = sinon.stub().resolves();
    connection.commit = sinon.stub().resolves();
    connection.rollback = sinon.stub().resolves();
    connection.release = sinon.stub();
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(connection);
    return connection;
  };

  describe('approveSubmissionUploadJobHandler', () => {
    it('applies the approval in one committed transaction', async () => {
      const connection = stubConnection();
      const applyStub = sinon.stub(SubmissionUploadService.prototype, 'applySubmissionUploadApproval').resolves();

      await approveSubmissionUploadJobHandler([createMockJob()]);

      expect(applyStub).to.have.been.calledOnceWith('submission-upload-1');
      expect(connection.commit).to.have.been.calledOnce;
      expect(connection.rollback).not.to.have.been.called;
    });

    it('rolls back and rethrows so pg-boss retries', async () => {
      const connection = stubConnection();
      const failure = new Error('activation failed');
      sinon.stub(SubmissionUploadService.prototype, 'applySubmissionUploadApproval').rejects(failure);

      try {
        await approveSubmissionUploadJobHandler([createMockJob()]);
        expect.fail('Expected the failure to propagate');
      } catch (error) {
        expect(error).to.equal(failure);
      }

      expect(connection.commit).not.to.have.been.called;
      expect(connection.rollback).to.have.been.calledOnce;
    });
  });

  describe('approveSubmissionUploadFailedHandler', () => {
    it('returns the still-approving upload to pending', async () => {
      const connection = stubConnection();
      const revertStub = sinon.stub(SubmissionUploadService.prototype, 'revertSubmissionUploadApproval').resolves();

      await approveSubmissionUploadFailedHandler([createMockJob()]);

      expect(revertStub).to.have.been.calledOnceWith('submission-upload-1');
      expect(connection.commit).to.have.been.calledOnce;
    });
  });
});
