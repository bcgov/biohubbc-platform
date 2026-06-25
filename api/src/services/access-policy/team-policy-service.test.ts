import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { CreateTeamPolicy, TeamPolicy, TeamPolicyDetails, UpdateTeamPolicy } from '../../models/team-policy';
import { TeamPolicyRepository } from '../../repositories/authorization/team-policy-repository';
import { SecurityScopeService } from './security-scope-service';
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
    it('should insert team policy and grant scopes for the policy', async () => {
      const mockTeamPolicy: TeamPolicy = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333',
        record_end_date: null
      };

      const getExistingStub = sinon.stub(TeamPolicyRepository.prototype, 'getPoliciesByTeamId').resolves([]);
      const insertStub = sinon.stub(TeamPolicyRepository.prototype, 'insertTeamPolicy').resolves(mockTeamPolicy);
      const materializeStub = sinon
        .stub(SecurityScopeService.prototype, 'materializePolicyStatementScopes')
        .resolves(true);
      const grantStub = sinon.stub(SecurityScopeService.prototype, 'grantTeamAccessForPolicy').resolves();

      const input: CreateTeamPolicy = {
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      };

      const result = await service.createTeamPolicy(input);

      expect(getExistingStub).to.have.been.calledWith('22222222-2222-2222-2222-222222222222', {
        policyIds: ['33333333-3333-3333-3333-333333333333']
      });
      expect(insertStub).to.have.been.calledWith(input);
      expect(materializeStub).to.have.been.calledOnceWith('33333333-3333-3333-3333-333333333333');
      expect(grantStub).to.have.been.calledOnceWith(
        '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333'
      );
      expect(result).to.eql(mockTeamPolicy);
    });

    it('should skip the team grant when the policy has no ALLOW statements to materialize', async () => {
      const mockTeamPolicy: TeamPolicy = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333',
        record_end_date: null
      };

      sinon.stub(TeamPolicyRepository.prototype, 'getPoliciesByTeamId').resolves([]);
      sinon.stub(TeamPolicyRepository.prototype, 'insertTeamPolicy').resolves(mockTeamPolicy);
      const materializeStub = sinon
        .stub(SecurityScopeService.prototype, 'materializePolicyStatementScopes')
        .resolves(false);
      const grantStub = sinon.stub(SecurityScopeService.prototype, 'grantTeamAccessForPolicy').resolves();

      const result = await service.createTeamPolicy({
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      });

      expect(materializeStub).to.have.been.calledOnce;
      expect(grantStub).to.not.have.been.called;
      expect(result).to.eql({
        ...mockTeamPolicy,
        record_end_date: null
      });
    });

    it('should return existing team policy and skip insert and scope grant when association already exists', async () => {
      const existingTeamPolicy: TeamPolicyDetails = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333',
        record_end_date: null,
        team_name: 'Team A',
        policy_name: 'Policy A'
      };

      const getExistingStub = sinon
        .stub(TeamPolicyRepository.prototype, 'getPoliciesByTeamId')
        .resolves([existingTeamPolicy]);
      const insertStub = sinon.stub(TeamPolicyRepository.prototype, 'insertTeamPolicy');
      const materializeStub = sinon
        .stub(SecurityScopeService.prototype, 'materializePolicyStatementScopes')
        .resolves(true);
      const grantStub = sinon.stub(SecurityScopeService.prototype, 'grantTeamAccessForPolicy').resolves();

      const input: CreateTeamPolicy = {
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      };

      const result = await service.createTeamPolicy(input);

      expect(getExistingStub).to.have.been.calledWith('22222222-2222-2222-2222-222222222222', {
        policyIds: ['33333333-3333-3333-3333-333333333333']
      });
      expect(insertStub).to.not.have.been.called;
      expect(materializeStub).to.not.have.been.called;
      expect(grantStub).to.not.have.been.called;
      expect(result).to.eql({
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333',
        record_end_date: null
      });
    });
  });

  describe('getTeamPolicy', () => {
    it('should call repository.getTeamPolicy and return the record', async () => {
      const mockTeamPolicy: TeamPolicy = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333',
        record_end_date: null
      };

      const stub = sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicy').resolves(mockTeamPolicy);

      const result = await service.getTeamPolicy('11111111-1111-1111-1111-111111111111');

      expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
      expect(result).to.eql(mockTeamPolicy);
    });
  });

  describe('createTeamPolicies', () => {
    it('should create unique policies in bulk and grant scopes for each new policy', async () => {
      const getExistingStub = sinon.stub(TeamPolicyRepository.prototype, 'getPoliciesByTeamId').resolves([]);

      const insertStub = sinon.stub(TeamPolicyRepository.prototype, 'insertTeamPolicy');
      insertStub.onCall(0).resolves({
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333',
        record_end_date: null
      });
      insertStub.onCall(1).resolves({
        team_policy_id: '44444444-4444-4444-4444-444444444444',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '55555555-5555-5555-5555-555555555555',
        record_end_date: null
      });

      const materializeStub = sinon
        .stub(SecurityScopeService.prototype, 'materializePolicyStatementScopes')
        .resolves(true);
      const grantStub = sinon.stub(SecurityScopeService.prototype, 'grantTeamAccessForPolicy').resolves();

      const result = await service.createTeamPolicies('22222222-2222-2222-2222-222222222222', [
        '33333333-3333-3333-3333-333333333333',
        '55555555-5555-5555-5555-555555555555'
      ]);

      expect(getExistingStub).to.have.been.calledOnceWith('22222222-2222-2222-2222-222222222222', {
        policyIds: ['33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555']
      });

      expect(insertStub).to.have.been.calledTwice;
      expect(materializeStub).to.have.been.calledTwice;
      expect(materializeStub.firstCall).to.have.been.calledWith('33333333-3333-3333-3333-333333333333');
      expect(materializeStub.secondCall).to.have.been.calledWith('55555555-5555-5555-5555-555555555555');
      expect(grantStub).to.have.been.calledTwice;
      expect(grantStub.firstCall).to.have.been.calledWith(
        '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333'
      );
      expect(grantStub.secondCall).to.have.been.calledWith(
        '22222222-2222-2222-2222-222222222222',
        '55555555-5555-5555-5555-555555555555'
      );
      expect(result).to.eql([
        {
          team_policy_id: '11111111-1111-1111-1111-111111111111',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '33333333-3333-3333-3333-333333333333',
          record_end_date: null
        },
        {
          team_policy_id: '44444444-4444-4444-4444-444444444444',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '55555555-5555-5555-5555-555555555555',
          record_end_date: null
        }
      ]);
    });

    it('should skip policies that already exist and only grant scopes for newly created policies', async () => {
      const getExistingStub = sinon.stub(TeamPolicyRepository.prototype, 'getPoliciesByTeamId').resolves([
        {
          team_policy_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '33333333-3333-3333-3333-333333333333',
          record_end_date: null,
          team_name: 'Team 1',
          policy_name: 'Policy A'
        }
      ]);

      const insertStub = sinon.stub(TeamPolicyRepository.prototype, 'insertTeamPolicy').resolves({
        team_policy_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '55555555-5555-5555-5555-555555555555',
        record_end_date: null
      });

      const materializeStub = sinon
        .stub(SecurityScopeService.prototype, 'materializePolicyStatementScopes')
        .resolves(true);
      const grantStub = sinon.stub(SecurityScopeService.prototype, 'grantTeamAccessForPolicy').resolves();

      const result = await service.createTeamPolicies('22222222-2222-2222-2222-222222222222', [
        '33333333-3333-3333-3333-333333333333',
        '33333333-3333-3333-3333-333333333333',
        '55555555-5555-5555-5555-555555555555'
      ]);

      expect(getExistingStub).to.have.been.calledOnceWith('22222222-2222-2222-2222-222222222222', {
        policyIds: ['33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555']
      });
      expect(insertStub).to.have.been.calledOnceWith({
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '55555555-5555-5555-5555-555555555555'
      });

      // Materialize + grant only for the newly created policy, not the pre-existing one
      expect(materializeStub).to.have.been.calledOnceWith('55555555-5555-5555-5555-555555555555');
      expect(grantStub).to.have.been.calledOnceWith(
        '22222222-2222-2222-2222-222222222222',
        '55555555-5555-5555-5555-555555555555'
      );

      expect(result).to.eql([
        {
          team_policy_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '55555555-5555-5555-5555-555555555555',
          record_end_date: null
        }
      ]);
    });

    it('should not grant scopes when all policies already exist', async () => {
      sinon.stub(TeamPolicyRepository.prototype, 'getPoliciesByTeamId').resolves([
        {
          team_policy_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '33333333-3333-3333-3333-333333333333',
          record_end_date: null,
          team_name: 'Team 1',
          policy_name: 'Policy A'
        }
      ]);

      const insertStub = sinon.stub(TeamPolicyRepository.prototype, 'insertTeamPolicy');
      const materializeStub = sinon
        .stub(SecurityScopeService.prototype, 'materializePolicyStatementScopes')
        .resolves(true);
      const grantStub = sinon.stub(SecurityScopeService.prototype, 'grantTeamAccessForPolicy').resolves();

      const result = await service.createTeamPolicies('22222222-2222-2222-2222-222222222222', [
        '33333333-3333-3333-3333-333333333333'
      ]);

      expect(insertStub).to.not.have.been.called;
      expect(materializeStub).to.not.have.been.called;
      expect(grantStub).to.not.have.been.called;
      expect(result).to.eql([]);
    });
  });

  describe('getPoliciesByTeamId', () => {
    it('should call repository.getPoliciesByTeamId and return the records for a team', async () => {
      const mockTeamPolicies: TeamPolicyDetails[] = [
        {
          team_policy_id: '11111111-1111-1111-1111-111111111111',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '33333333-3333-3333-3333-333333333333',
          record_end_date: null,
          team_name: 'Team 1',
          policy_name: 'Policy A'
        },
        {
          team_policy_id: '44444444-4444-4444-4444-444444444444',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '55555555-5555-5555-5555-555555555555',
          record_end_date: null,
          team_name: 'Team 1',
          policy_name: 'Policy B'
        }
      ];

      const stub = sinon.stub(TeamPolicyRepository.prototype, 'getPoliciesByTeamId').resolves(mockTeamPolicies);

      const result = await service.getPoliciesByTeamId('22222222-2222-2222-2222-222222222222');

      expect(stub).to.have.been.calledWith('22222222-2222-2222-2222-222222222222');
      expect(result).to.eql(mockTeamPolicies);
    });
  });

  describe('getAllTeamPolicies', () => {
    it('should call repository.getTeamPolicies and return all team-policy associations with names', async () => {
      const mockTeamPolicies: TeamPolicyDetails[] = [
        {
          team_policy_id: '11111111-1111-1111-1111-111111111111',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '33333333-3333-3333-3333-333333333333',
          record_end_date: null,
          team_name: 'Test Team',
          policy_name: 'Test Policy'
        }
      ];

      const stub = sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves(mockTeamPolicies);

      const result = await service.getAllTeamPolicies();
      const filters = undefined;
      const pagination = undefined;

      expect(stub).to.have.been.calledOnce;
      expect(stub).to.have.been.calledWith(filters, pagination);
      expect(result).to.eql(mockTeamPolicies);
    });
  });

  describe('getAllTeamPoliciesCount', () => {
    it('should call repository.getAllTeamPoliciesCount and return count', async () => {
      const stub = sinon.stub(TeamPolicyRepository.prototype, 'getAllTeamPoliciesCount').resolves(2);
      const result = await service.getAllTeamPoliciesCount({ search: 'Team' });

      expect(stub).to.have.been.calledWith({ search: 'Team' });
      expect(result).to.equal(2);
    });
  });

  describe('updateTeamPolicy', () => {
    it('should rebuild team security scopes when the update deactivates an active team policy', async () => {
      const mockTeamPolicy: TeamPolicy = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333',
        record_end_date: null
      };

      const getStub = sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicy').resolves(mockTeamPolicy);
      const updateStub = sinon.stub(TeamPolicyRepository.prototype, 'updateTeamPolicy').resolves({
        ...mockTeamPolicy,
        record_end_date: '2025-12-31'
      });
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopes').resolves();

      const updateData: UpdateTeamPolicy = {
        record_end_date: '2025-12-31'
      };

      const result = await service.updateTeamPolicy('11111111-1111-1111-1111-111111111111', updateData);

      expect(getStub).to.have.been.calledOnceWith('11111111-1111-1111-1111-111111111111');
      expect(updateStub).to.have.been.calledOnceWith('11111111-1111-1111-1111-111111111111', updateData);
      expect(rebuildStub).to.have.been.calledOnceWith('22222222-2222-2222-2222-222222222222');
      expect(updateStub).to.have.been.calledBefore(rebuildStub);
      expect(result).to.eql({
        ...mockTeamPolicy,
        record_end_date: '2025-12-31'
      });
    });

    it('should rebuild team security scopes when the update reactivates an inactive team policy', async () => {
      const mockTeamPolicy: TeamPolicy = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333',
        record_end_date: '2025-12-31'
      };

      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicy').resolves(mockTeamPolicy);
      const updateStub = sinon.stub(TeamPolicyRepository.prototype, 'updateTeamPolicy').resolves({
        ...mockTeamPolicy,
        record_end_date: null
      });
      const materializeStub = sinon
        .stub(SecurityScopeService.prototype, 'materializePolicyStatementScopes')
        .resolves(true);
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopes').resolves();

      const updateData: UpdateTeamPolicy = {
        record_end_date: null
      };

      const result = await service.updateTeamPolicy('11111111-1111-1111-1111-111111111111', updateData);

      expect(updateStub).to.have.been.calledOnceWith('11111111-1111-1111-1111-111111111111', updateData);
      expect(materializeStub).to.have.been.calledOnceWith('33333333-3333-3333-3333-333333333333');
      expect(rebuildStub).to.have.been.calledOnceWith('22222222-2222-2222-2222-222222222222');
      expect(materializeStub).to.have.been.calledBefore(rebuildStub);
      expect(result).to.eql({
        ...mockTeamPolicy,
        record_end_date: null
      });
    });

    it('should skip rebuilding team security scopes when the active state does not change', async () => {
      const mockTeamPolicy: TeamPolicy = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333',
        record_end_date: '2025-12-31'
      };

      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicy').resolves(mockTeamPolicy);
      const updateStub = sinon.stub(TeamPolicyRepository.prototype, 'updateTeamPolicy').resolves(mockTeamPolicy);
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopes').resolves();

      const updateData: UpdateTeamPolicy = {
        record_end_date: '2026-01-01'
      };

      const result = await service.updateTeamPolicy('11111111-1111-1111-1111-111111111111', updateData);

      expect(updateStub).to.have.been.calledOnceWith('11111111-1111-1111-1111-111111111111', updateData);
      expect(rebuildStub).to.not.have.been.called;
      expect(result).to.eql(mockTeamPolicy);
    });

    it('should skip updating and rebuilding team security scopes when the update does not touch active state', async () => {
      const mockTeamPolicy: TeamPolicy = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333',
        record_end_date: null
      };

      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicy').resolves(mockTeamPolicy);
      const updateStub = sinon.stub(TeamPolicyRepository.prototype, 'updateTeamPolicy').resolves(mockTeamPolicy);
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopes').resolves();

      const result = await service.updateTeamPolicy('11111111-1111-1111-1111-111111111111', {});

      expect(updateStub).to.not.have.been.called;
      expect(rebuildStub).to.not.have.been.called;
      expect(result).to.eql(mockTeamPolicy);
    });
  });

  describe('deleteTeamPolicy', () => {
    it('should fetch team_id, delete the team policy, and rebuild team security scopes', async () => {
      const mockTeamPolicy: TeamPolicy = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333',
        record_end_date: null
      };

      const getStub = sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicy').resolves(mockTeamPolicy);
      const deleteStub = sinon.stub(TeamPolicyRepository.prototype, 'deleteTeamPolicy').resolves();
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopes').resolves();

      await service.deleteTeamPolicy('11111111-1111-1111-1111-111111111111');

      expect(getStub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
      expect(deleteStub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');

      // Rebuild called with the team_id, not the team_policy_id
      expect(rebuildStub).to.have.been.calledOnce;
      expect(rebuildStub).to.have.been.calledWith('22222222-2222-2222-2222-222222222222');
    });
  });
});
