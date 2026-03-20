import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { TeamFeatureRepository } from '../../repositories/authorization/team-feature-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { TeamFeatureService } from './team-feature-service';

chai.use(sinonChai);

describe('TeamFeatureService', () => {
  let service: TeamFeatureService;

  beforeEach(() => {
    const mockDBConnection = getMockDBConnection();
    service = new TeamFeatureService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('refreshCacheForTeam', () => {
    it('calls delete, gets submission ids, then populates in batches', async () => {
      const callOrder: string[] = [];

      const deleteStub = sinon
        .stub(TeamFeatureRepository.prototype, 'deleteTeamFeaturesByTeamId')
        .callsFake(async () => {
          callOrder.push('delete');
        });
      const getIdsStub = sinon.stub(TeamFeatureRepository.prototype, 'getSecuredSubmissionIds').callsFake(async () => {
        callOrder.push('getIds');
        return [1, 2, 3];
      });
      const populateStub = sinon
        .stub(TeamFeatureRepository.prototype, 'populateTeamFeatureCacheBatch')
        .callsFake(async () => {
          callOrder.push('populate');
        });

      await service.refreshCacheForTeam('22222222-2222-2222-2222-222222222222');

      expect(deleteStub).to.have.been.calledOnceWith('22222222-2222-2222-2222-222222222222');
      expect(getIdsStub).to.have.been.calledOnceWith('22222222-2222-2222-2222-222222222222');
      expect(populateStub).to.have.been.calledOnceWith('22222222-2222-2222-2222-222222222222', [1, 2, 3]);
      expect(callOrder).to.eql(['delete', 'getIds', 'populate']);
    });
  });
});
