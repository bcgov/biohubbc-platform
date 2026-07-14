import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getPolicyTeams } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { TeamPolicyService } from '../../../../../services/access-policy/team-policy-service';

chai.use(sinonChai);

describe('paths/administrative/policies/{policyId}/teams/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getPolicyTeams', () => {
    it('should call service list/count methods and return paginated policy teams', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const mockTeam = {
        team_policy_id: 'team-policy-1',
        team_id: 'team-1',
        policy_id: 'policy-1',
        team_name: 'Team Alpha',
        policy_name: 'Sensitive Wildlife Policy'
      };
      const getTeamsStub = sinon.stub(TeamPolicyService.prototype, 'getTeamsByPolicyId').resolves([mockTeam]);
      const getTeamsCountStub = sinon.stub(TeamPolicyService.prototype, 'getTeamsByPolicyIdCount').resolves(1);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        policyId: 'policy-1'
      };
      mockReq.query = {
        page: '2',
        limit: '10',
        sort: 'team_name',
        order: 'asc'
      };

      const requestHandler = getPolicyTeams();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getTeamsStub).to.have.been.calledOnceWith('policy-1', {
        page: 2,
        limit: 10,
        sort: 'team_name',
        order: 'asc'
      });
      expect(getTeamsCountStub).to.have.been.calledOnceWith('policy-1');
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({
        teams: [mockTeam],
        pagination: {
          total: 1,
          per_page: 10,
          current_page: 2,
          last_page: 1,
          sort: 'team_name',
          order: 'asc'
        }
      });
    });
  });
});
