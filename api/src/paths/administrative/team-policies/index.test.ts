import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { TeamPolicy, TeamPolicyDetails } from '../../../models/team-policy';
import { TeamPolicyService } from '../../../services/access-policy/team-policy-service';
import * as teamPolicies from './index';

chai.use(sinonChai);

describe('team-policies', () => {
  describe('getTeamPolicies', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return team policies with pagination on success', async () => {
      const mockDBConnection = getMockDBConnection();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = { page: '1', limit: '10' };

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const mockTeamPolicies: TeamPolicyDetails[] = [
        {
          team_policy_id: '11111111-1111-1111-1111-111111111111',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '33333333-3333-3333-3333-333333333333',
          team_name: 'Test Team',
          policy_name: 'Test Policy'
        }
      ];

      const mockResponse = {
        team_policies: mockTeamPolicies,
        pagination: { total: 1, per_page: 10, current_page: 1, last_page: 1, sort: undefined, order: undefined }
      };

      sinon.stub(TeamPolicyService.prototype, 'getAllTeamPolicies').resolves(mockTeamPolicies);
      sinon.stub(TeamPolicyService.prototype, 'getAllTeamPoliciesCount').resolves(1);

      const requestHandler = teamPolicies.getTeamPolicies();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(mockResponse);
    });

    it('should pass sort and order params to service', async () => {
      const mockDBConnection = getMockDBConnection();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = { page: '1', limit: '10', sort: 'team_name', order: 'desc' };

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const getAllTeamPoliciesStub = sinon.stub(TeamPolicyService.prototype, 'getAllTeamPolicies').resolves([]);
      const getAllTeamPoliciesCountStub = sinon
        .stub(TeamPolicyService.prototype, 'getAllTeamPoliciesCount')
        .resolves(0);

      const requestHandler = teamPolicies.getTeamPolicies();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getAllTeamPoliciesStub).to.have.been.calledWith(
        { search: undefined },
        {
          page: 1,
          limit: 10,
          sort: 'team_name',
          order: 'desc'
        }
      );
      expect(getAllTeamPoliciesCountStub).to.have.been.calledWith({ search: undefined });
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

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

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
