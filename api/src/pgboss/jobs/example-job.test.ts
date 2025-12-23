import { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import * as db from '../../database/db';
import { getMockDBConnection } from '../../__mocks__/db';
import { exampleJobHandler, IExampleJobData } from './example-job';

describe('example-job', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('exampleJobHandler', () => {
    it('opens a database connection for each job', async () => {
      const mockDBConnection = getMockDBConnection();
      const openStub = sinon.stub().resolves();
      const commitStub = sinon.stub().resolves();
      const releaseStub = sinon.stub();

      mockDBConnection.open = openStub;
      mockDBConnection.commit = commitStub;
      mockDBConnection.release = releaseStub;

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const mockJobs = [
        {
          id: 'test-job-id',
          data: { message: 'test message' }
        }
      ] as PgBoss.Job<IExampleJobData>[];

      await exampleJobHandler(mockJobs);

      expect(openStub.calledOnce).to.be.true;
    });

    it('commits the transaction on success', async () => {
      const mockDBConnection = getMockDBConnection();
      const openStub = sinon.stub().resolves();
      const commitStub = sinon.stub().resolves();
      const releaseStub = sinon.stub();

      mockDBConnection.open = openStub;
      mockDBConnection.commit = commitStub;
      mockDBConnection.release = releaseStub;

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const mockJobs = [
        {
          id: 'test-job-id',
          data: { message: 'test message' }
        }
      ] as PgBoss.Job<IExampleJobData>[];

      await exampleJobHandler(mockJobs);

      expect(commitStub.calledOnce).to.be.true;
    });

    it('releases the connection in finally block', async () => {
      const mockDBConnection = getMockDBConnection();
      const openStub = sinon.stub().resolves();
      const commitStub = sinon.stub().resolves();
      const releaseStub = sinon.stub();

      mockDBConnection.open = openStub;
      mockDBConnection.commit = commitStub;
      mockDBConnection.release = releaseStub;

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const mockJobs = [
        {
          id: 'test-job-id',
          data: { message: 'test message' }
        }
      ] as PgBoss.Job<IExampleJobData>[];

      await exampleJobHandler(mockJobs);

      expect(releaseStub.calledOnce).to.be.true;
    });

    it('rolls back the transaction on error', async () => {
      const mockDBConnection = getMockDBConnection();
      const openStub = sinon.stub().resolves();
      const commitStub = sinon.stub().rejects(new Error('commit failed'));
      const rollbackStub = sinon.stub().resolves();
      const releaseStub = sinon.stub();

      mockDBConnection.open = openStub;
      mockDBConnection.commit = commitStub;
      mockDBConnection.rollback = rollbackStub;
      mockDBConnection.release = releaseStub;

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const mockJobs = [
        {
          id: 'test-job-id',
          data: { message: 'test message' }
        }
      ] as PgBoss.Job<IExampleJobData>[];

      try {
        await exampleJobHandler(mockJobs);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(rollbackStub.calledOnce).to.be.true;
        expect((error as Error).message).to.equal('commit failed');
      }
    });

    it('releases connection even when error occurs', async () => {
      const mockDBConnection = getMockDBConnection();
      const openStub = sinon.stub().resolves();
      const commitStub = sinon.stub().rejects(new Error('commit failed'));
      const rollbackStub = sinon.stub().resolves();
      const releaseStub = sinon.stub();

      mockDBConnection.open = openStub;
      mockDBConnection.commit = commitStub;
      mockDBConnection.rollback = rollbackStub;
      mockDBConnection.release = releaseStub;

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const mockJobs = [
        {
          id: 'test-job-id',
          data: { message: 'test message' }
        }
      ] as PgBoss.Job<IExampleJobData>[];

      try {
        await exampleJobHandler(mockJobs);
      } catch {
        // Expected
      }

      expect(releaseStub.calledOnce).to.be.true;
    });

    it('re-throws errors for pg-boss retry handling', async () => {
      const mockDBConnection = getMockDBConnection();
      const testError = new Error('test error');

      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().rejects(testError);
      mockDBConnection.rollback = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const mockJobs = [
        {
          id: 'test-job-id',
          data: { message: 'test message' }
        }
      ] as PgBoss.Job<IExampleJobData>[];

      try {
        await exampleJobHandler(mockJobs);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).to.equal(testError);
      }
    });

    it('processes multiple jobs in sequence', async () => {
      const openStub = sinon.stub().resolves();
      const commitStub = sinon.stub().resolves();
      const releaseStub = sinon.stub();

      const getAPIUserDBConnectionStub = sinon.stub(db, 'getAPIUserDBConnection');
      getAPIUserDBConnectionStub.callsFake(() => {
        const mockConn = getMockDBConnection();
        mockConn.open = openStub;
        mockConn.commit = commitStub;
        mockConn.release = releaseStub;
        return mockConn;
      });

      const mockJobs = [
        { id: 'job-1', data: { message: 'message 1' } },
        { id: 'job-2', data: { message: 'message 2' } }
      ] as PgBoss.Job<IExampleJobData>[];

      await exampleJobHandler(mockJobs);

      expect(openStub.callCount).to.equal(2);
      expect(commitStub.callCount).to.equal(2);
      expect(releaseStub.callCount).to.equal(2);
    });

    it('handles empty jobs array gracefully', async () => {
      const openStub = sinon.stub().resolves();

      const mockDBConnection = getMockDBConnection();
      mockDBConnection.open = openStub;

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const mockJobs: PgBoss.Job<IExampleJobData>[] = [];

      await exampleJobHandler(mockJobs);

      expect(openStub.called).to.be.false;
    });
  });
});
