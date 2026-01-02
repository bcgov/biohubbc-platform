import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { CreateTeamPolicy, TeamPolicy, TeamPolicyDetails, UpdateTeamPolicy } from '../../models/team-policy';
import { TeamPolicyRepository } from '../../repositories/authorization/team-policy-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { TeamPolicyService } from './team-policy-service';

chai.use(sinonChai);

describe('TeamPolicyService', () => {
  let mockDBConnection: any;
  let service: TeamPolicyService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new TeamPolicyService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createTeamPolicy', () => {
    it('should call repository.insertTeamPolicy and return the created record', async () => {
      const mockTeamPolicy: TeamPolicy = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      };

      const stub = sinon.stub(TeamPolicyRepository.prototype, 'insertTeamPolicy').resolves(mockTeamPolicy);

      const input: CreateTeamPolicy = {
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      };

      const result = await service.createTeamPolicy(input);

      expect(stub).to.have.been.calledWith(input);
      expect(result).to.eql(mockTeamPolicy);
    });
  });

  describe('getTeamPolicy', () => {
    it('should call repository.getTeamPolicy and return the record', async () => {
      const mockTeamPolicy: TeamPolicy = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      };

      const stub = sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicy').resolves(mockTeamPolicy);

      const result = await service.getTeamPolicy('11111111-1111-1111-1111-111111111111');

      expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
      expect(result).to.eql(mockTeamPolicy);
    });
  });

  describe('getTeamPolicies', () => {
    it('should call repository.getTeamPolicies and return the records for a team', async () => {
      const mockTeamPolicies: TeamPolicy[] = [
        {
          team_policy_id: '11111111-1111-1111-1111-111111111111',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '33333333-3333-3333-3333-333333333333'
        },
        {
          team_policy_id: '44444444-4444-4444-4444-444444444444',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '55555555-5555-5555-5555-555555555555'
        }
      ];

      const stub = sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves(mockTeamPolicies);

      const result = await service.getTeamPolicies('22222222-2222-2222-2222-222222222222');

      expect(stub).to.have.been.calledWith('22222222-2222-2222-2222-222222222222');
      expect(result).to.eql(mockTeamPolicies);
    });
  });

  describe('getAllTeamPolicies', () => {
    it('should call repository.getAllTeamPolicies and return all team-policy associations with names', async () => {
      const mockTeamPolicies: TeamPolicyDetails[] = [
        {
          team_policy_id: '11111111-1111-1111-1111-111111111111',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '33333333-3333-3333-3333-333333333333',
          team_name: 'Test Team',
          policy_name: 'Test Policy'
        }
      ];

      const stub = sinon.stub(TeamPolicyRepository.prototype, 'getAllTeamPolicies').resolves(mockTeamPolicies);

      const result = await service.getAllTeamPolicies();

      expect(stub).to.have.been.calledOnce;
      expect(result).to.eql(mockTeamPolicies);
    });
  });

  describe('updateTeamPolicy', () => {
    it('should call repository.updateTeamPolicy and return the updated record', async () => {
      const mockTeamPolicy: TeamPolicy = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      };

      const stub = sinon.stub(TeamPolicyRepository.prototype, 'updateTeamPolicy').resolves(mockTeamPolicy);

      const updateData: UpdateTeamPolicy = {
        record_end_date: '2025-12-31'
      };

      const result = await service.updateTeamPolicy('11111111-1111-1111-1111-111111111111', updateData);

      expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111', updateData);
      expect(result).to.eql(mockTeamPolicy);
    });
  });

  describe('deleteTeamPolicy', () => {
    it('should call repository.deleteTeamPolicy', async () => {
      const stub = sinon.stub(TeamPolicyRepository.prototype, 'deleteTeamPolicy').resolves();

      await service.deleteTeamPolicy('11111111-1111-1111-1111-111111111111');

      expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
    });
  });
});
