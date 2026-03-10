import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { TeamFeatureRepository } from '../../repositories/authorization/team-feature-repository';
import { TeamPolicyRepository } from '../../repositories/authorization/team-policy-repository';
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

  describe('refreshCacheForPolicy', () => {
    it('refreshes cache for each team that has the policy', async () => {
      const mockTeamPolicies = [
        {
          team_policy_id: '11111111-1111-1111-1111-111111111111',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '33333333-3333-3333-3333-333333333333',
          team_name: 'Team A',
          policy_name: 'Policy A'
        },
        {
          team_policy_id: '44444444-4444-4444-4444-444444444444',
          team_id: '55555555-5555-5555-5555-555555555555',
          policy_id: '33333333-3333-3333-3333-333333333333',
          team_name: 'Team B',
          policy_name: 'Policy A'
        }
      ];

      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves(mockTeamPolicies);
      const refreshStub = sinon.stub(TeamFeatureService.prototype, 'refreshCacheForTeam').resolves();

      await service.refreshCacheForPolicy('33333333-3333-3333-3333-333333333333');

      expect(refreshStub).to.have.been.calledTwice;
      expect(refreshStub.firstCall).to.have.been.calledWith('22222222-2222-2222-2222-222222222222');
      expect(refreshStub.secondCall).to.have.been.calledWith('55555555-5555-5555-5555-555555555555');
    });

    it('does not call refreshCacheForTeam when no teams have the policy', async () => {
      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves([]);
      const refreshStub = sinon.stub(TeamFeatureService.prototype, 'refreshCacheForTeam').resolves();

      await service.refreshCacheForPolicy('33333333-3333-3333-3333-333333333333');

      expect(refreshStub).to.not.have.been.called;
    });
  });

  describe('getTeamIdsForPolicy', () => {
    it('returns team ids for the given policy', async () => {
      const mockTeamPolicies = [
        {
          team_policy_id: '11111111-1111-1111-1111-111111111111',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '33333333-3333-3333-3333-333333333333',
          team_name: 'Team A',
          policy_name: 'Policy A'
        }
      ];

      const stub = sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves(mockTeamPolicies);

      const result = await service.getTeamIdsForPolicy('33333333-3333-3333-3333-333333333333');

      expect(stub).to.have.been.calledOnceWith({ policyIds: ['33333333-3333-3333-3333-333333333333'] });
      expect(result).to.eql(['22222222-2222-2222-2222-222222222222']);
    });

    it('returns empty array when no teams have the policy', async () => {
      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves([]);

      const result = await service.getTeamIdsForPolicy('33333333-3333-3333-3333-333333333333');

      expect(result).to.eql([]);
    });
  });
});
