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
    it('calls delete then populate in order', async () => {
      const callOrder: string[] = [];

      const deleteStub = sinon
        .stub(TeamFeatureRepository.prototype, 'deleteTeamFeaturesByTeamId')
        .callsFake(async () => {
          callOrder.push('delete');
        });
      const populateStub = sinon
        .stub(TeamFeatureRepository.prototype, 'populateTeamFeatureCache')
        .callsFake(async () => {
          callOrder.push('populate');
        });

      await service.refreshCacheForTeam('22222222-2222-2222-2222-222222222222');

      expect(deleteStub).to.have.been.calledOnceWith('22222222-2222-2222-2222-222222222222');
      expect(populateStub).to.have.been.calledOnceWith('22222222-2222-2222-2222-222222222222');
      expect(callOrder).to.eql(['delete', 'populate']);
    });
  });
});
