import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { ApiConflictError } from '../../errors/api-error';
import { CreatePolicy, Policy, UpdatePolicy } from '../../models/policy';
import { PolicyEffect, PolicyStatement } from '../../models/policy-statement';
import { PolicyRepository } from '../../repositories/authorization/policy-repository';
import { PolicyStatementRepository } from '../../repositories/authorization/policy-statement-repository';
import { TeamPolicyRepository } from '../../repositories/authorization/team-policy-repository';
import { PolicyExpressionRepository } from '../../repositories/policy-expression-repository';
import { ExpressionTreeService } from '../expression-tree-service';
import { PolicyExpressionService } from './policy-expression-service';
import { PolicyService } from './policy-service';
import { SecurityScopeService } from './security-scope-service';

chai.use(sinonChai);

describe('PolicyService', () => {
  let mockDBConnection: any;
  let policyService: PolicyService;

  beforeEach(() => {
    sinon.stub(PolicyExpressionService.prototype, 'getPolicyExpressionsByPolicyId').resolves([]);
    mockDBConnection = getMockDBConnection();
    policyService = new PolicyService(mockDBConnection);
    sinon.stub(SecurityScopeService.prototype, 'ensureSecurityScope').resolves({
      security_scope_id: '55555555-5555-5555-5555-555555555555',
      scope_hash: 'scope-hash',
      urn_submission_id: '*',
      urn_feature_type: 'telemetry',
      urn_feature_id: '*'
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getPolicy', () => {
    it('should call repository.getPolicy and return a policy', async () => {
      const mockPolicy: Policy = { policy_id: '1', name: 'Test Policy', description: 'Test', status: 'approved' };
      const getPolicyStub = sinon.stub(PolicyRepository.prototype, 'getPolicy').resolves(mockPolicy);

      const result = await policyService.getPolicy('1');

      expect(getPolicyStub).to.have.been.calledWith('1');
      expect(result).to.eql(mockPolicy);
    });
  });

  describe('getPolicies', () => {
    it('should call repository.getPolicy and return a policy', async () => {
      const mockPolicy: Policy[] = [{ policy_id: '1', name: 'Test Policy', description: 'Test', status: 'approved' }];
      const getPolicyStub = sinon.stub(PolicyRepository.prototype, 'getPolicies').resolves(mockPolicy);

      const result = await policyService.getPolicies();
      const filters = undefined;
      const pagination = undefined;

      expect(getPolicyStub).to.have.been.calledOnce;
      expect(getPolicyStub).to.have.been.calledWith(filters, pagination);
      expect(result).to.eql(mockPolicy);
    });
  });

  describe('getPoliciesCount', () => {
    it('should call repository.getPoliciesCount and return count', async () => {
      const getPoliciesCountStub = sinon.stub(PolicyRepository.prototype, 'getPoliciesCount').resolves(2);

      const result = await policyService.getPoliciesCount({ search: 'Telemetry' });

      expect(getPoliciesCountStub).to.have.been.calledWith({ search: 'Telemetry' });
      expect(result).to.equal(2);
    });
  });

  describe('getPoliciesThatAuthorizeFeatureAccessByUrn', () => {
    it('should call repository.getPoliciesThatAuthorizeFeatureAccessByUrn and return policies', async () => {
      const mockPolicies: Policy[] = [
        { policy_id: '1', name: 'Policy 1', description: 'Desc 1', status: 'approved' },
        { policy_id: '2', name: 'Policy 2', description: 'Desc 2', status: 'approved' }
      ];
      const stub = sinon
        .stub(PolicyRepository.prototype, 'getPoliciesThatAuthorizeFeatureAccessByUrn')
        .resolves(mockPolicies);

      const result = await policyService.getPoliciesThatAuthorizeFeatureAccessByUrn('urn:123:*:*', 42);

      expect(stub).to.have.been.calledWith({ submissionId: '123', featureTypeName: '*', submissionFeatureId: '*' }, 42);
      expect(result).to.eql(mockPolicies);
    });
  });

  describe('updatePolicy', () => {
    it('should call repository.updatePolicy and return updated policy', async () => {
      const updatedPolicy: Policy = {
        policy_id: '1',
        name: 'Updated',
        description: 'Updated desc',
        status: 'approved'
      };
      const stub = sinon.stub(PolicyRepository.prototype, 'updatePolicy').resolves(updatedPolicy);

      const result = await policyService.updatePolicy('1', {
        name: 'Updated',
        description: 'Updated desc'
      } as UpdatePolicy);

      expect(stub).to.have.been.calledWith('1', { name: 'Updated', description: 'Updated desc' });
      expect(result).to.eql(updatedPolicy);
    });

    // C1: reviewed → approved + 2 team_policies → policy-wide materialization fires
    // once; per-team grant fires once per team; rebuild not called.
    it('materializes the access cache once per linked team on transition into approved', async () => {
      const currentPolicy: Policy = { policy_id: '1', name: 'P', description: null, status: 'reviewed' };
      const updatedPolicy: Policy = { ...currentPolicy, status: 'approved' };

      sinon.stub(PolicyRepository.prototype, 'getPolicy').resolves(currentPolicy);
      const updateStub = sinon.stub(PolicyRepository.prototype, 'updatePolicy').resolves(updatedPolicy);
      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves([
        { team_policy_id: 'tp1', team_id: 'team-1', policy_id: '1', team_name: 'A', policy_name: 'P' },
        { team_policy_id: 'tp2', team_id: 'team-2', policy_id: '1', team_name: 'B', policy_name: 'P' }
      ]);
      const materializePolicyStub = sinon
        .stub(SecurityScopeService.prototype, 'materializePolicyStatementScopes')
        .resolves(true);
      const grantTeamAccessStub = sinon.stub(SecurityScopeService.prototype, 'grantTeamAccessForPolicy').resolves();
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopes').resolves();

      const result = await policyService.updatePolicy('1', { status: 'approved' } as UpdatePolicy);

      expect(updateStub).to.have.been.calledOnceWith('1', { status: 'approved' });
      // Policy-wide statement-scope materialization runs once, not per team.
      expect(materializePolicyStub).to.have.been.calledOnceWith('1');
      expect(grantTeamAccessStub).to.have.been.calledTwice;
      expect(grantTeamAccessStub.firstCall).to.have.been.calledWith('team-1', '1');
      expect(grantTeamAccessStub.secondCall).to.have.been.calledWith('team-2', '1');
      expect(rebuildStub).to.not.have.been.called;
      expect(result).to.eql(updatedPolicy);
    });

    // C1b: reviewed → approved but policy has no active ALLOW statements →
    // policy-wide materialization short-circuits; no per-team grant fires.
    it('skips per-team grants when transition into approved finds no ALLOW statements', async () => {
      const currentPolicy: Policy = { policy_id: '1', name: 'P', description: null, status: 'reviewed' };
      const updatedPolicy: Policy = { ...currentPolicy, status: 'approved' };

      sinon.stub(PolicyRepository.prototype, 'getPolicy').resolves(currentPolicy);
      sinon.stub(PolicyRepository.prototype, 'updatePolicy').resolves(updatedPolicy);
      sinon
        .stub(TeamPolicyRepository.prototype, 'getTeamPolicies')
        .resolves([{ team_policy_id: 'tp1', team_id: 'team-1', policy_id: '1', team_name: 'A', policy_name: 'P' }]);
      const materializePolicyStub = sinon
        .stub(SecurityScopeService.prototype, 'materializePolicyStatementScopes')
        .resolves(false);
      const grantTeamAccessStub = sinon.stub(SecurityScopeService.prototype, 'grantTeamAccessForPolicy').resolves();

      await policyService.updatePolicy('1', { status: 'approved' } as UpdatePolicy);

      expect(materializePolicyStub).to.have.been.calledOnce;
      expect(grantTeamAccessStub).to.not.have.been.called;
    });

    // C2: approved → reviewed + 2 team_policies → rebuild fires once per team; materialize not called.
    it('rebuilds the access cache once per linked team on transition out of approved (→ reviewed)', async () => {
      const currentPolicy: Policy = { policy_id: '1', name: 'P', description: null, status: 'approved' };
      const updatedPolicy: Policy = { ...currentPolicy, status: 'reviewed' };

      sinon.stub(PolicyRepository.prototype, 'getPolicy').resolves(currentPolicy);
      sinon.stub(PolicyRepository.prototype, 'updatePolicy').resolves(updatedPolicy);
      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves([
        { team_policy_id: 'tp1', team_id: 'team-1', policy_id: '1', team_name: 'A', policy_name: 'P' },
        { team_policy_id: 'tp2', team_id: 'team-2', policy_id: '1', team_name: 'B', policy_name: 'P' }
      ]);
      const materializeStub = sinon
        .stub(SecurityScopeService.prototype, 'materializeStatementScopesAndTeamAccess')
        .resolves();
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopes').resolves();

      await policyService.updatePolicy('1', { status: 'reviewed' } as UpdatePolicy);

      expect(rebuildStub).to.have.been.calledTwice;
      expect(rebuildStub.firstCall).to.have.been.calledWith('team-1');
      expect(rebuildStub.secondCall).to.have.been.calledWith('team-2');
      expect(materializeStub).to.not.have.been.called;
    });

    // C3: approved → denied + 1 team_policy → rebuild fires once; materialize not called.
    it('rebuilds the access cache once per linked team on transition out of approved (→ denied)', async () => {
      const currentPolicy: Policy = { policy_id: '1', name: 'P', description: null, status: 'approved' };
      const updatedPolicy: Policy = { ...currentPolicy, status: 'denied' };

      sinon.stub(PolicyRepository.prototype, 'getPolicy').resolves(currentPolicy);
      sinon.stub(PolicyRepository.prototype, 'updatePolicy').resolves(updatedPolicy);
      sinon
        .stub(TeamPolicyRepository.prototype, 'getTeamPolicies')
        .resolves([{ team_policy_id: 'tp1', team_id: 'team-1', policy_id: '1', team_name: 'A', policy_name: 'P' }]);
      const materializeStub = sinon
        .stub(SecurityScopeService.prototype, 'materializeStatementScopesAndTeamAccess')
        .resolves();
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopes').resolves();

      await policyService.updatePolicy('1', { status: 'denied' } as UpdatePolicy);

      expect(rebuildStub).to.have.been.calledOnceWith('team-1');
      expect(materializeStub).to.not.have.been.called;
    });

    // C4: requested → reviewed + 1 team_policy → neither orchestration branch fires.
    it('skips both orchestration branches when transitioning between non-approved statuses', async () => {
      const currentPolicy: Policy = { policy_id: '1', name: 'P', description: null, status: 'requested' };
      const updatedPolicy: Policy = { ...currentPolicy, status: 'reviewed' };

      sinon.stub(PolicyRepository.prototype, 'getPolicy').resolves(currentPolicy);
      sinon.stub(PolicyRepository.prototype, 'updatePolicy').resolves(updatedPolicy);
      const getTeamPoliciesStub = sinon
        .stub(TeamPolicyRepository.prototype, 'getTeamPolicies')
        .resolves([{ team_policy_id: 'tp1', team_id: 'team-1', policy_id: '1', team_name: 'A', policy_name: 'P' }]);
      const materializeStub = sinon
        .stub(SecurityScopeService.prototype, 'materializeStatementScopesAndTeamAccess')
        .resolves();
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopes').resolves();

      await policyService.updatePolicy('1', { status: 'reviewed' } as UpdatePolicy);

      expect(getTeamPoliciesStub).to.not.have.been.called;
      expect(materializeStub).to.not.have.been.called;
      expect(rebuildStub).to.not.have.been.called;
    });

    // C5: same-status update approved → approved short-circuits before fetching team policies.
    it('short-circuits same-status updates without fetching team policies or touching the cache', async () => {
      const currentPolicy: Policy = { policy_id: '1', name: 'P', description: null, status: 'approved' };
      const updatedPolicy: Policy = { ...currentPolicy, name: 'Renamed' };

      const getPolicyStub = sinon.stub(PolicyRepository.prototype, 'getPolicy').resolves(currentPolicy);
      const updateStub = sinon.stub(PolicyRepository.prototype, 'updatePolicy').resolves(updatedPolicy);
      const getTeamPoliciesStub = sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies');
      const materializeStub = sinon.stub(SecurityScopeService.prototype, 'materializeStatementScopesAndTeamAccess');
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopes');

      await policyService.updatePolicy('1', { name: 'Renamed', status: 'approved' } as UpdatePolicy);

      expect(getPolicyStub).to.have.been.calledOnce;
      expect(updateStub).to.have.been.calledOnce;
      expect(getTeamPoliciesStub).to.not.have.been.called;
      expect(materializeStub).to.not.have.been.called;
      expect(rebuildStub).to.not.have.been.called;
    });

    // C6: payload without status — bypasses status cache orchestration entirely.
    it('bypasses status cache orchestration when status is not in the payload', async () => {
      const updatedPolicy: Policy = {
        policy_id: '1',
        name: 'Renamed',
        description: 'desc',
        status: 'requested'
      };
      const getPolicyStub = sinon.stub(PolicyRepository.prototype, 'getPolicy');
      const updateStub = sinon.stub(PolicyRepository.prototype, 'updatePolicy').resolves(updatedPolicy);
      const getTeamPoliciesStub = sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies');
      const materializeStub = sinon.stub(SecurityScopeService.prototype, 'materializeStatementScopesAndTeamAccess');
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopes');

      await policyService.updatePolicy('1', { name: 'Renamed' } as UpdatePolicy);

      expect(updateStub).to.have.been.calledOnceWith('1', { name: 'Renamed' });
      expect(getPolicyStub).to.not.have.been.called;
      expect(getTeamPoliciesStub).to.not.have.been.called;
      expect(materializeStub).to.not.have.been.called;
      expect(rebuildStub).to.not.have.been.called;
    });

    // C7: reviewed → approved + zero linked team_policies → no standing access,
    // so both anchor materialization and team grants are skipped.
    it('skips scope materialization when approving a policy with no linked teams', async () => {
      const currentPolicy: Policy = { policy_id: '1', name: 'P', description: null, status: 'reviewed' };
      const updatedPolicy: Policy = { ...currentPolicy, status: 'approved' };

      sinon.stub(PolicyRepository.prototype, 'getPolicy').resolves(currentPolicy);
      const updateStub = sinon.stub(PolicyRepository.prototype, 'updatePolicy').resolves(updatedPolicy);
      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves([]);
      const materializeStub = sinon
        .stub(SecurityScopeService.prototype, 'materializePolicyStatementScopes')
        .resolves(true);
      const grantTeamAccessStub = sinon.stub(SecurityScopeService.prototype, 'grantTeamAccessForPolicy').resolves();
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopes').resolves();

      await policyService.updatePolicy('1', { status: 'approved' } as UpdatePolicy);

      expect(updateStub).to.have.been.calledOnce;
      expect(materializeStub).to.not.have.been.called;
      expect(grantTeamAccessStub).to.not.have.been.called;
      expect(rebuildStub).to.not.have.been.called;
    });

    // C8: requested → approved is allowed and uses the normal transition-into-approved cache path.
    it('allows approving directly from requested and materializes linked team access', async () => {
      const currentPolicy: Policy = { policy_id: '1', name: 'P', description: null, status: 'requested' };
      const updatedPolicy: Policy = { ...currentPolicy, status: 'approved' };
      sinon.stub(PolicyRepository.prototype, 'getPolicy').resolves(currentPolicy);
      const updateStub = sinon.stub(PolicyRepository.prototype, 'updatePolicy').resolves(updatedPolicy);
      const getTeamPoliciesStub = sinon
        .stub(TeamPolicyRepository.prototype, 'getTeamPolicies')
        .resolves([{ team_policy_id: 'tp1', team_id: 'team-1', policy_id: '1', team_name: 'A', policy_name: 'P' }]);
      const materializePolicyStub = sinon
        .stub(SecurityScopeService.prototype, 'materializePolicyStatementScopes')
        .resolves(true);
      const grantTeamAccessStub = sinon.stub(SecurityScopeService.prototype, 'grantTeamAccessForPolicy').resolves();

      const result = await policyService.updatePolicy('1', { status: 'approved' } as UpdatePolicy);

      expect(updateStub).to.have.been.calledOnceWith('1', { status: 'approved' });
      expect(getTeamPoliciesStub).to.have.been.calledOnceWith({ policyIds: ['1'] });
      expect(materializePolicyStub).to.have.been.calledOnceWith('1');
      expect(grantTeamAccessStub).to.have.been.calledOnceWith('team-1', '1');
      expect(result).to.eql(updatedPolicy);
    });

    // C9: denied → approved is allowed and uses the same cache orchestration as any transition into approved.
    it('allows approving from denied and skips materialization when no team policies are linked', async () => {
      const currentPolicy: Policy = { policy_id: '1', name: 'P', description: null, status: 'denied' };
      const updatedPolicy: Policy = { ...currentPolicy, status: 'approved' };
      sinon.stub(PolicyRepository.prototype, 'getPolicy').resolves(currentPolicy);
      const updateStub = sinon.stub(PolicyRepository.prototype, 'updatePolicy').resolves(updatedPolicy);
      const getTeamPoliciesStub = sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves([]);
      const materializePolicyStub = sinon
        .stub(SecurityScopeService.prototype, 'materializePolicyStatementScopes')
        .resolves(true);
      const grantTeamAccessStub = sinon.stub(SecurityScopeService.prototype, 'grantTeamAccessForPolicy');

      const result = await policyService.updatePolicy('1', { status: 'approved' } as UpdatePolicy);

      expect(updateStub).to.have.been.calledOnceWith('1', { status: 'approved' });
      expect(getTeamPoliciesStub).to.have.been.calledOnceWith({ policyIds: ['1'] });
      expect(materializePolicyStub).to.not.have.been.called;
      expect(grantTeamAccessStub).to.not.have.been.called;
      expect(result).to.eql(updatedPolicy);
    });
  });

  // Direct tests of the private `applyCacheFanOutForTransition` helper. Public-method
  // tests exercise the helper transitively, but this block pins its contract
  // independent of any caller so a future caller cannot accidentally bypass an
  // invariant the helper enforces (e.g. the same-status no-op).
  describe('applyCacheFanOutForTransition', () => {
    const policyId = 'policy-1';
    const linkedTeamPolicies = [
      { team_policy_id: 'tp1', team_id: 'team-1', policy_id: policyId, team_name: 'A', policy_name: 'P' },
      { team_policy_id: 'tp2', team_id: 'team-2', policy_id: policyId, team_name: 'B', policy_name: 'P' }
    ];

    // The helper is intentionally private; tests access it via an `any` cast to
    // pin the contract without exposing the surface to production callers.
    const invoke = (from: 'requested' | 'reviewed' | 'approved' | 'denied', to: typeof from) =>
      (
        policyService as unknown as {
          applyCacheFanOutForTransition: (transition: { policyId: string; from: string; to: string }) => Promise<void>;
        }
      ).applyCacheFanOutForTransition({ policyId, from, to });

    it('returns early without fetching team policies when from === to', async () => {
      const getTeamPoliciesStub = sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies');
      const materializeStub = sinon.stub(SecurityScopeService.prototype, 'materializeStatementScopesAndTeamAccess');
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopes');

      await invoke('approved', 'approved');

      expect(getTeamPoliciesStub).to.not.have.been.called;
      expect(materializeStub).to.not.have.been.called;
      expect(rebuildStub).to.not.have.been.called;
    });

    it('skips scope materialization when no team_policy links exist on approval', async () => {
      const getTeamPoliciesStub = sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves([]);
      const materializePolicyStub = sinon
        .stub(SecurityScopeService.prototype, 'materializePolicyStatementScopes')
        .resolves(true);
      const grantTeamAccessStub = sinon.stub(SecurityScopeService.prototype, 'grantTeamAccessForPolicy').resolves();
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopes');

      await invoke('reviewed', 'approved');

      expect(getTeamPoliciesStub).to.have.been.calledOnceWith({ policyIds: [policyId] });
      expect(materializePolicyStub).to.not.have.been.called;
      expect(grantTeamAccessStub).to.not.have.been.called;
      expect(rebuildStub).to.not.have.been.called;
    });

    it('materializes statement scopes once and grants per team when transitioning into approved', async () => {
      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves(linkedTeamPolicies);
      const materializePolicyStub = sinon
        .stub(SecurityScopeService.prototype, 'materializePolicyStatementScopes')
        .resolves(true);
      const grantTeamAccessStub = sinon.stub(SecurityScopeService.prototype, 'grantTeamAccessForPolicy').resolves();
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopes');

      await invoke('reviewed', 'approved');

      expect(materializePolicyStub).to.have.been.calledOnceWith(policyId);
      expect(grantTeamAccessStub).to.have.been.calledTwice;
      expect(grantTeamAccessStub.firstCall).to.have.been.calledWith('team-1', policyId);
      expect(grantTeamAccessStub.secondCall).to.have.been.calledWith('team-2', policyId);
      expect(rebuildStub).to.not.have.been.called;
    });

    it('skips the team-grant loop when policy-wide materialization short-circuits on approved', async () => {
      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves(linkedTeamPolicies);
      const materializePolicyStub = sinon
        .stub(SecurityScopeService.prototype, 'materializePolicyStatementScopes')
        .resolves(false);
      const grantTeamAccessStub = sinon.stub(SecurityScopeService.prototype, 'grantTeamAccessForPolicy').resolves();

      await invoke('reviewed', 'approved');

      expect(materializePolicyStub).to.have.been.calledOnceWith(policyId);
      expect(grantTeamAccessStub).to.not.have.been.called;
    });

    it('rebuilds per linked team when transitioning out of approved (→ reviewed)', async () => {
      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves(linkedTeamPolicies);
      const materializeStub = sinon.stub(SecurityScopeService.prototype, 'materializeStatementScopesAndTeamAccess');
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopes').resolves();

      await invoke('approved', 'reviewed');

      expect(rebuildStub).to.have.been.calledTwice;
      expect(rebuildStub.firstCall).to.have.been.calledWith('team-1');
      expect(rebuildStub.secondCall).to.have.been.calledWith('team-2');
      expect(materializeStub).to.not.have.been.called;
    });

    it('rebuilds per linked team when transitioning out of approved (→ denied)', async () => {
      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves(linkedTeamPolicies);
      const materializeStub = sinon.stub(SecurityScopeService.prototype, 'materializeStatementScopesAndTeamAccess');
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopes').resolves();

      await invoke('approved', 'denied');

      expect(rebuildStub).to.have.been.calledTwice;
      expect(materializeStub).to.not.have.been.called;
    });

    it('fires neither branch and skips team-policy reads for transitions not involving approved', async () => {
      const getTeamPoliciesStub = sinon
        .stub(TeamPolicyRepository.prototype, 'getTeamPolicies')
        .resolves(linkedTeamPolicies);
      const materializeStub = sinon.stub(SecurityScopeService.prototype, 'materializeStatementScopesAndTeamAccess');
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopes');

      await invoke('requested', 'reviewed');

      expect(getTeamPoliciesStub).to.not.have.been.called;
      expect(materializeStub).to.not.have.been.called;
      expect(rebuildStub).to.not.have.been.called;
    });
  });

  describe('deletePolicy', () => {
    it('should fetch teams before soft-delete, then rebuild team scope grants', async () => {
      const getTeamPoliciesStub = sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves([
        {
          team_policy_id: 'tp1',
          team_id: 'team-1',
          policy_id: '1',
          team_name: 'Team 1',
          policy_name: 'Policy 1'
        }
      ]);
      const deletePolicyStub = sinon.stub(PolicyRepository.prototype, 'deletePolicy').resolves();
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopesForTeams').resolves();

      await policyService.deletePolicy('1');

      expect(getTeamPoliciesStub).to.have.been.calledWith({ policyIds: ['1'] });
      expect(deletePolicyStub).to.have.been.calledWith('1');
      expect(rebuildStub).to.have.been.calledOnceWith(['team-1']);
    });

    it('should still call team rebuild helper when policy has no linked teams', async () => {
      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves([]);
      sinon.stub(PolicyRepository.prototype, 'deletePolicy').resolves();
      const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopesForTeams').resolves();

      await policyService.deletePolicy('1');

      expect(rebuildStub).to.have.been.calledOnceWith([]);
    });
  });

  describe('getPoliciesWithStatements', () => {
    it('should call repository.getPolicies and return policies with statements', async () => {
      const mockPolicies: Policy[] = [
        { policy_id: '1', name: 'Policy 1', description: 'Desc 1', status: 'approved' },
        { policy_id: '2', name: 'Policy 2', description: 'Desc 2', status: 'approved' }
      ];
      const mockStatements: PolicyStatement[] = [
        {
          policy_statement_id: 's1',
          policy_id: '1',
          effect: PolicyEffect.ALLOW,
          submission_feature_urn: 'urn:*:*:*',
          policy_expression_id: null
        }
      ];
      const getPoliciesStub = sinon.stub(PolicyRepository.prototype, 'getPolicies').resolves(mockPolicies);
      const getPolicyStatementsStub = sinon
        .stub(PolicyStatementRepository.prototype, 'getPolicyStatements')
        .resolves(mockStatements);

      const result = await policyService.getPoliciesWithStatements(undefined, { page: 1, limit: 10 });

      expect(getPoliciesStub).to.have.been.calledWith(undefined, { page: 1, limit: 10 });
      expect(getPolicyStatementsStub).to.have.been.called;
      expect(result).to.eql([
        { ...mockPolicies[0], statements: [mockStatements[0]], expressions: [] },
        { ...mockPolicies[1], statements: [mockStatements[0]], expressions: [] }
      ]);
    });

    it('should call repository.getPolicies and return empty array when no policies exist', async () => {
      const getPoliciesStub = sinon.stub(PolicyRepository.prototype, 'getPolicies').resolves([]);

      const result = await policyService.getPoliciesWithStatements(undefined, { page: 1, limit: 10 });

      expect(getPoliciesStub).to.have.been.calledWith(undefined, { page: 1, limit: 10 });
      expect(result).to.eql([]);
    });
  });

  describe('getPolicyWithStatements', () => {
    it('should call repository.getPolicy and return policy with statements', async () => {
      const mockPolicy: Policy = { policy_id: '1', name: 'Test Policy', description: 'Test', status: 'approved' };
      const mockStatements: PolicyStatement[] = [
        {
          policy_statement_id: 's1',
          policy_id: '1',
          effect: PolicyEffect.ALLOW,
          submission_feature_urn: 'urn:*:telemetry:*',
          policy_expression_id: null
        }
      ];
      const getPolicyStub = sinon.stub(PolicyRepository.prototype, 'getPolicy').resolves(mockPolicy);
      const getPolicyStatementsStub = sinon
        .stub(PolicyStatementRepository.prototype, 'getPolicyStatements')
        .resolves(mockStatements);

      const result = await policyService.getPolicyWithStatements('1');

      expect(getPolicyStub).to.have.been.calledWith('1');
      expect(getPolicyStatementsStub).to.have.been.calledWith('1');
      expect(result).to.eql({
        ...mockPolicy,
        statements: [mockStatements[0]],
        expressions: []
      });
    });
  });

  describe('createPolicyExpression', () => {
    it('creates a policy expression when the policy does not already use the resolved expression id', async () => {
      const expression = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            type: 'predicate',
            feature_property_id: 19,
            feature_type_property_id: null,
            operator: 'Contains',
            value: 'x'
          }
        ]
      } as const;
      const policyExpression = {
        policy_expression_id: 'pe-new',
        policy_id: 'policy-1',
        expression_id: 'expr-existing',
        name: 'Expression',
        description: null
      };

      sinon.stub(PolicyRepository.prototype, 'getPolicy').resolves({
        policy_id: 'policy-1',
        name: 'Policy',
        description: null,
        status: 'requested'
      });
      sinon.stub(ExpressionTreeService.prototype, 'writeExpressionTree').resolves({ expression_id: 'expr-existing' });
      sinon.stub(ExpressionTreeService.prototype, 'readExpressionTree').resolves(expression);
      sinon.stub(PolicyExpressionService.prototype, 'getPolicyExpressionByPolicyAndExpressionId').resolves(null);
      const createPolicyExpressionStub = sinon
        .stub(PolicyExpressionService.prototype, 'createPolicyExpression')
        .resolves(policyExpression);
      const ensurePolicyExpressionStub = sinon.stub(PolicyExpressionService.prototype, 'ensurePolicyExpression');

      const result = await policyService.createPolicyExpression('policy-1', {
        name: 'Expression',
        description: null,
        expression
      });

      expect(createPolicyExpressionStub).to.have.been.calledOnceWithExactly({
        policyId: 'policy-1',
        expressionId: 'expr-existing',
        name: 'Expression',
        description: null
      });
      expect(ensurePolicyExpressionStub).to.not.have.been.called;
      expect(result).to.eql({ ...policyExpression, expression });
    });

    it('throws conflict when the policy already has an active policy expression for the resolved expression id', async () => {
      const expression = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            type: 'predicate',
            feature_property_id: 19,
            feature_type_property_id: null,
            operator: 'Contains',
            value: 'x'
          }
        ]
      } as const;

      sinon.stub(PolicyRepository.prototype, 'getPolicy').resolves({
        policy_id: 'policy-1',
        name: 'Policy',
        description: null,
        status: 'requested'
      });
      sinon.stub(ExpressionTreeService.prototype, 'writeExpressionTree').resolves({ expression_id: 'expr-existing' });
      sinon.stub(PolicyExpressionService.prototype, 'getPolicyExpressionByPolicyAndExpressionId').resolves({
        policy_expression_id: 'pe-existing',
        policy_id: 'policy-1',
        expression_id: 'expr-existing',
        name: 'Existing',
        description: null
      });
      const createPolicyExpressionStub = sinon.stub(PolicyExpressionService.prototype, 'createPolicyExpression');

      try {
        await policyService.createPolicyExpression('policy-1', {
          name: 'Expression',
          description: null,
          expression
        });
        expect.fail('expected createPolicyExpression to throw');
      } catch (error: any) {
        expect(error).to.be.instanceOf(ApiConflictError);
        expect(error.message).to.equal('Policy expression already exists for policy');
      }

      expect(createPolicyExpressionStub).to.not.have.been.called;
    });
  });

  describe('updatePolicyExpression', () => {
    it('throws conflict when another active policy expression already uses the resolved expression id', async () => {
      const expression = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            type: 'predicate',
            feature_property_id: 19,
            feature_type_property_id: null,
            operator: 'Contains',
            value: 'x'
          }
        ]
      } as const;

      sinon.stub(PolicyRepository.prototype, 'getPolicy').resolves({
        policy_id: 'policy-1',
        name: 'Policy',
        description: null,
        status: 'requested'
      });
      sinon.stub(ExpressionTreeService.prototype, 'writeExpressionTree').resolves({ expression_id: 'expr-existing' });
      sinon.stub(PolicyExpressionService.prototype, 'getPolicyExpressionByPolicyAndExpressionId').resolves({
        policy_expression_id: 'pe-other',
        policy_id: 'policy-1',
        expression_id: 'expr-existing',
        name: 'Existing',
        description: null
      });
      const updatePolicyExpressionStub = sinon.stub(
        PolicyExpressionService.prototype,
        'updatePolicyExpressionForPolicy'
      );

      try {
        await policyService.updatePolicyExpression('policy-1', 'pe-current', {
          name: 'Expression',
          description: null,
          expression
        });
        expect.fail('expected updatePolicyExpression to throw');
      } catch (error: any) {
        expect(error).to.be.instanceOf(ApiConflictError);
        expect(error.message).to.equal('Policy expression already exists for policy');
      }

      expect(updatePolicyExpressionStub).to.not.have.been.called;
    });

    it('allows updating metadata when the resolved expression id belongs to the same policy expression', async () => {
      const expression = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            type: 'predicate',
            feature_property_id: 19,
            feature_type_property_id: null,
            operator: 'Contains',
            value: 'x'
          }
        ]
      } as const;
      const policyExpression = {
        policy_expression_id: 'pe-current',
        policy_id: 'policy-1',
        expression_id: 'expr-existing',
        name: 'Renamed',
        description: null
      };

      sinon.stub(PolicyRepository.prototype, 'getPolicy').resolves({
        policy_id: 'policy-1',
        name: 'Policy',
        description: null,
        status: 'requested'
      });
      sinon.stub(ExpressionTreeService.prototype, 'writeExpressionTree').resolves({ expression_id: 'expr-existing' });
      sinon.stub(ExpressionTreeService.prototype, 'readExpressionTree').resolves(expression);
      sinon.stub(PolicyExpressionService.prototype, 'getPolicyExpressionByPolicyAndExpressionId').resolves({
        ...policyExpression,
        name: 'Old'
      });
      const updatePolicyExpressionStub = sinon
        .stub(PolicyExpressionService.prototype, 'updatePolicyExpressionForPolicy')
        .resolves(policyExpression);

      const result = await policyService.updatePolicyExpression('policy-1', 'pe-current', {
        name: 'Renamed',
        description: null,
        expression
      });

      expect(updatePolicyExpressionStub).to.have.been.calledOnceWithExactly('policy-1', 'pe-current', {
        expression_id: 'expr-existing',
        name: 'Renamed',
        description: null
      });
      expect(result).to.eql({ ...policyExpression, expression });
    });
  });

  describe('deletePolicyExpression', () => {
    it('throws conflict and does not delete when an active statement references the expression', async () => {
      sinon.stub(PolicyRepository.prototype, 'getPolicy').resolves({
        policy_id: 'policy-1',
        name: 'Policy',
        description: null,
        status: 'requested'
      });
      sinon.stub(PolicyExpressionService.prototype, 'getPolicyExpressionById').resolves({
        policy_expression_id: 'pe-1',
        policy_id: 'policy-1',
        expression_id: 'expr-1',
        name: null,
        description: null
      });
      sinon.stub(PolicyExpressionService.prototype, 'hasActivePolicyStatementReferences').resolves(true);
      const deleteStub = sinon.stub(PolicyExpressionService.prototype, 'deletePolicyExpression').resolves();

      try {
        await policyService.deletePolicyExpression('policy-1', 'pe-1');
        expect.fail('expected deletePolicyExpression to throw');
      } catch (error: any) {
        expect(error).to.be.instanceOf(ApiConflictError);
        expect(error.message).to.equal('Cannot delete policy expression while active policy statements reference it');
      }

      expect(deleteStub).to.not.have.been.called;
    });

    it('deletes an unreferenced policy expression for the policy', async () => {
      sinon.stub(PolicyRepository.prototype, 'getPolicy').resolves({
        policy_id: 'policy-1',
        name: 'Policy',
        description: null,
        status: 'requested'
      });
      sinon.stub(PolicyExpressionService.prototype, 'getPolicyExpressionById').resolves({
        policy_expression_id: 'pe-1',
        policy_id: 'policy-1',
        expression_id: 'expr-1',
        name: null,
        description: null
      });
      sinon.stub(PolicyExpressionService.prototype, 'hasActivePolicyStatementReferences').resolves(false);
      const deleteStub = sinon.stub(PolicyExpressionService.prototype, 'deletePolicyExpression').resolves();

      await policyService.deletePolicyExpression('policy-1', 'pe-1');

      expect(deleteStub).to.have.been.calledOnceWithExactly('policy-1', 'pe-1');
    });
  });

  describe('createPolicyWithStatements', () => {
    // A1: New policy with 2 ALLOW statements — statements are inserted and
    // each create reconciles policy access through the statement service.
    it('refreshes access per created statement and persists statements', async () => {
      const mockPolicy: Policy = { policy_id: '1', name: 'New Policy', description: 'Desc', status: 'requested' };
      const mockStatement1: PolicyStatement = {
        policy_statement_id: 's1',
        policy_id: '1',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:*:telemetry:*',
        policy_expression_id: null
      };
      const mockStatement2: PolicyStatement = {
        policy_statement_id: 's2',
        policy_id: '1',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:10:*:*',
        policy_expression_id: null
      };
      const insertPolicyStub = sinon.stub(PolicyRepository.prototype, 'insertPolicy').resolves(mockPolicy);
      const insertStatementStub = sinon.stub(PolicyStatementRepository.prototype, 'insertPolicyStatement');
      insertStatementStub.onCall(0).resolves(mockStatement1);
      insertStatementStub.onCall(1).resolves(mockStatement2);
      const refreshStub = sinon.stub(SecurityScopeService.prototype, 'refreshAccessForPolicy').resolves();
      const materializeTeamAccessStub = sinon
        .stub(SecurityScopeService.prototype, 'materializeStatementScopesAndTeamAccess')
        .resolves();

      const result = await policyService.createPolicyWithStatements(
        { name: 'New Policy', description: 'Desc', status: 'requested' } as CreatePolicy,
        [
          {
            effect: PolicyEffect.ALLOW,
            submission_feature_urn: 'urn:*:telemetry:*'
          },
          {
            effect: PolicyEffect.ALLOW,
            submission_feature_urn: 'urn:10:*:*'
          }
        ]
      );

      expect(insertPolicyStub).to.have.been.calledWith({
        name: 'New Policy',
        description: 'Desc',
        status: 'requested'
      });
      expect(insertStatementStub).to.have.been.calledTwice;
      expect(refreshStub).to.have.been.calledTwice;
      expect(materializeTeamAccessStub).to.not.have.been.called;
      expect(result).to.eql({
        ...mockPolicy,
        statements: [mockStatement1, mockStatement2],
        expressions: []
      });
    });

    // A2: Statement with a policy expression id — link persisted; scope materialization NOT called.
    it('links statements to existing policy expressions without materializing scopes', async () => {
      const mockPolicy: Policy = {
        policy_id: '1',
        name: 'Expression Link Policy',
        description: null,
        status: 'requested'
      };

      const mockStatement: PolicyStatement = {
        policy_statement_id: 's1',
        policy_id: '1',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:*:sampling_site:*',
        policy_expression_id: null
      };
      const linkedStatement: PolicyStatement = { ...mockStatement, policy_expression_id: 'pe-1' };
      sinon.stub(PolicyRepository.prototype, 'insertPolicy').resolves(mockPolicy);
      const insertStatementStub = sinon
        .stub(PolicyStatementRepository.prototype, 'insertPolicyStatement')
        .resolves(linkedStatement);
      sinon.stub(PolicyExpressionRepository.prototype, 'getPolicyExpressionById').resolves({
        policy_expression_id: 'pe-1',
        policy_id: '1',
        expression_id: 'e1',
        name: null,
        description: null
      });

      const refreshStub = sinon.stub(SecurityScopeService.prototype, 'refreshAccessForPolicy').resolves();

      const result = await policyService.createPolicyWithStatements(
        { name: 'Expression Link Policy', status: 'requested' } as CreatePolicy,
        [
          {
            effect: PolicyEffect.ALLOW,
            submission_feature_urn: 'urn:*:sampling_site:*',
            policy_expression_id: 'pe-1'
          }
        ]
      );

      expect(insertStatementStub).to.have.been.calledOnceWithExactly({
        policy_id: '1',
        effect: PolicyEffect.ALLOW,
        security_scope_id: '55555555-5555-5555-5555-555555555555',
        policy_expression_id: 'pe-1'
      });

      expect(refreshStub).to.have.been.calledOnceWith('1');

      expect(result.statements[0]).to.eql(linkedStatement);
    });

    // A3: Empty statements list — no statement, scope, or expression-link work.
    it('skips statement, scope, and expression-link work for an empty statement list', async () => {
      const mockPolicy: Policy = {
        policy_id: '1',
        name: 'Empty Policy',
        description: 'No statements',
        status: 'requested'
      };
      sinon.stub(PolicyRepository.prototype, 'insertPolicy').resolves(mockPolicy);
      const insertStatementStub = sinon.stub(PolicyStatementRepository.prototype, 'insertPolicyStatement').resolves();
      const refreshStub = sinon.stub(SecurityScopeService.prototype, 'refreshAccessForPolicy').resolves();
      const result = await policyService.createPolicyWithStatements(
        { name: 'Empty Policy', description: 'No statements', status: 'requested' } as CreatePolicy,
        []
      );

      expect(insertStatementStub).to.not.have.been.called;
      expect(refreshStub).to.not.have.been.called;
      expect(result).to.eql({ ...mockPolicy, statements: [], expressions: [] });
    });
  });
});
