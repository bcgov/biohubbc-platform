import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { TeamPolicy, TeamPolicyDetails } from '../../../models/team-policy';
import { TeamPolicyService } from '../../../services/access-policy/team-policy-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as teamPolicies from './index';

chai.use(sinonChai);

describe('team-policies', () => {
  describe('getTeamPolicies', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return team policies on success', async () => {
      const mockDBConnection = getMockDBConnection();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const mockResponse: TeamPolicyDetails[] = [
        {
          team_policy_id: '11111111-1111-1111-1111-111111111111',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '33333333-3333-3333-3333-333333333333',
          team_name: 'Test Team',
          policy_name: 'Test Policy'
        }
      ];

      sinon.stub(TeamPolicyService.prototype, 'getAllTeamPolicies').resolves(mockResponse);

      const requestHandler = teamPolicies.getTeamPolicies();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({ team_policies: mockResponse });
    });
  });

  describe('createTeamPolicy', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should create a team policy and return 201 on success', async () => {
      const mockDBConnection = getMockDBConnection();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.body = {
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      };

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const mockResponse: TeamPolicy = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      };

      sinon.stub(TeamPolicyService.prototype, 'createTeamPolicy').resolves(mockResponse);

      const requestHandler = teamPolicies.createTeamPolicy();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.eql(mockResponse);
    });
  });
});
