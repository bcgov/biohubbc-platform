import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { TeamPolicy } from '../../../../../models/team-policy';
import { TeamPolicyService } from '../../../../../services/access-policy/team-policy-service';
import { createPolicyTeam } from './index';

chai.use(sinonChai);

describe('paths/administrative/policies/{policyId}/team/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createPolicyTeam', () => {
    it('should create a team policy from the path policy id and body team id', async () => {
      const mockDBConnection = getMockDBConnection();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        policyId: '33333333-3333-3333-3333-333333333333'
      };
      mockReq.body = {
        team_id: '22222222-2222-2222-2222-222222222222'
      };

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const mockResponse: TeamPolicy = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333',
        record_end_date: null
      };

      const createStub = sinon.stub(TeamPolicyService.prototype, 'createTeamPolicy').resolves(mockResponse);

      const requestHandler = createPolicyTeam();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(createStub).to.have.been.calledOnceWithExactly({
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      });
      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.eql(mockResponse);
    });
  });
});
