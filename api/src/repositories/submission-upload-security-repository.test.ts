import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionUploadSecurityRepository } from './submission-upload-security-repository';

chai.use(sinonChai);

describe('SubmissionUploadSecurityRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertSubmissionUploadSecurity', () => {
    it('inserts a started scan event row and returns the new id', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 1, rows: [{ submission_upload_security_id: 42 }] });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new SubmissionUploadSecurityRepository(mockDBConnection);
      const result = await repo.insertSubmissionUploadSecurity('upload-uuid-1', 'job-uuid-1', 'review-1');

      expect(result).to.deep.equal({ submission_upload_security_id: 42 });
      expect(sqlStub.firstCall.args[0].values).to.eql(['upload-uuid-1', 'job-uuid-1', 'review-1']);
      expect(sqlStub).to.have.been.calledOnce;
    });
  });

  describe('updateSubmissionUploadSecurityStatus', () => {
    it('updates a scan event to a terminal status', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 1, rows: [] });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new SubmissionUploadSecurityRepository(mockDBConnection);
      await repo.updateSubmissionUploadSecurityStatus(42, 'completed', { ruleCount: 2, insertedCount: 3 });

      expect(sqlStub).to.have.been.calledOnce;
    });

    it('updates a scan event to failed without metadata', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 1, rows: [] });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new SubmissionUploadSecurityRepository(mockDBConnection);
      await repo.updateSubmissionUploadSecurityStatus(42, 'failed');

      expect(sqlStub).to.have.been.calledOnce;
    });
  });
});
