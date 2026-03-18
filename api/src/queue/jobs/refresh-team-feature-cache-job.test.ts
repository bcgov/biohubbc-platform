import { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import * as db from '../../database/db';
import { TeamFeatureService } from '../../services/access-policy/team-feature-service';
import { getMockDBConnection } from '../../__mocks__/db';
import {
  IRefreshTeamFeatureCacheJobData,
  refreshTeamFeatureCacheFailedHandler,
  refreshTeamFeatureCacheJobHandler
} from './refresh-team-feature-cache-job';

describe('refresh-team-feature-cache-job', () => {
  afterEach(() => {
    sinon.restore();
  });

  const createMockJob = (data: Partial<IRefreshTeamFeatureCacheJobData> = {}, jobId = 'test-job-id') =>
    ({
      id: jobId,
      name: 'refresh-team-feature-cache',
      data: { teamId: '22222222-2222-2222-2222-222222222222', ...data }
    } as PgBoss.Job<IRefreshTeamFeatureCacheJobData>);

  describe('refreshTeamFeatureCacheJobHandler', () => {
    it('opens connection, refreshes cache, commits, and releases', async () => {
      const mockDBConnection = getMockDBConnection();
      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const refreshStub = sinon.stub(TeamFeatureService.prototype, 'refreshCacheForTeam').resolves();

      await refreshTeamFeatureCacheJobHandler([createMockJob()]);

      expect(mockDBConnection.open).to.have.been.calledOnce;
      expect(refreshStub).to.have.been.calledOnceWith('22222222-2222-2222-2222-222222222222');
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
    });

    it('rolls back and releases on error, then rethrows', async () => {
      const mockDBConnection = getMockDBConnection();
      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.rollback = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const error = new Error('DB failure');
      sinon.stub(TeamFeatureService.prototype, 'refreshCacheForTeam').rejects(error);

      try {
        await refreshTeamFeatureCacheJobHandler([createMockJob()]);
        expect.fail('Should have thrown');
      } catch (thrown) {
        expect(thrown).to.equal(error);
      }

      expect(mockDBConnection.rollback).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
    });

    it('passes the correct teamId from job data', async () => {
      const mockDBConnection = getMockDBConnection();
      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const refreshStub = sinon.stub(TeamFeatureService.prototype, 'refreshCacheForTeam').resolves();

      const customTeamId = '99999999-9999-9999-9999-999999999999';
      await refreshTeamFeatureCacheJobHandler([createMockJob({ teamId: customTeamId })]);

      expect(refreshStub).to.have.been.calledOnceWith(customTeamId);
    });
  });

  describe('refreshTeamFeatureCacheFailedHandler', () => {
    it('logs warning without throwing', async () => {
      const mockJob = {
        ...createMockJob(),
        output: 'Some error output'
      } as PgBoss.Job<IRefreshTeamFeatureCacheJobData>;

      // Should not throw — DLQ handler only logs
      await refreshTeamFeatureCacheFailedHandler([mockJob]);
    });
  });
});
