import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import { TeamPolicyRepository } from '../../repositories/authorization/team-policy-repository';
import { SecurityScopeService } from './security-scope-service';

chai.use(sinonChai);

describe('SecurityScopeService', () => {
  let mockDBConnection: ReturnType<typeof getMockDBConnection>;
  let service: SecurityScopeService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new SecurityScopeService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('rebuildTeamSecurityScopesForTeams', () => {
    it('rebuilds each affected team', async () => {
      const deleteTeamScopesStub = sinon.stub(SecurityScopeRepository.prototype, 'deleteTeamSecurityScopes').resolves();
      const insertFromChainStub = sinon
        .stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesFromPolicyChain')
        .resolves();

      await service.rebuildTeamSecurityScopesForTeams(['team-a', 'team-b']);

      expect(deleteTeamScopesStub).to.have.been.calledTwice;
      expect(deleteTeamScopesStub.firstCall).to.have.been.calledWith('team-a');
      expect(deleteTeamScopesStub.secondCall).to.have.been.calledWith('team-b');
      expect(insertFromChainStub).to.have.been.calledTwice;
    });
  });

  describe('rebuildTeamSecurityScopes', () => {
    it('deletes then re-derives team scopes from the policy chain', async () => {
      const deleteStub = sinon.stub(SecurityScopeRepository.prototype, 'deleteTeamSecurityScopes').resolves();
      const insertStub = sinon
        .stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesFromPolicyChain')
        .resolves();

      await service.rebuildTeamSecurityScopes('team-1');

      expect(deleteStub).to.have.been.calledOnceWith('team-1');
      expect(insertStub).to.have.been.calledOnceWith('team-1');
      expect(deleteStub).to.have.been.calledBefore(insertStub);
    });
  });

  describe('materializeStatementScopesAndTeamAccess', () => {
    const teamId = 'team-1';
    const policyId = 'policy-1';
    const scopeIdOne = '11111111-1111-1111-1111-111111111111';
    const scopeIdTwo = '22222222-2222-2222-2222-222222222222';

    it('A1: materializes ALLOW statements then issues the team grant (effect gate + ordering)', async () => {
      const getStatementsStub = sinon
        .stub(SecurityScopeRepository.prototype, 'findActiveAllowStatementsForApprovedPolicy')
        .resolves([{ security_scope_id: scopeIdOne }, { security_scope_id: scopeIdTwo }]);

      const publishStub = sinon
        .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      const insertTeamGrantStub = sinon
        .stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesForPolicy')
        .resolves();

      await service.materializeStatementScopesAndTeamAccess(teamId, policyId);

      expect(getStatementsStub).to.have.been.calledOnceWith(policyId);
      expect(publishStub).to.have.been.calledTwice;
      expect(publishStub.firstCall).to.have.been.calledWith(mockDBConnection, { securityScopeId: scopeIdOne });
      expect(publishStub.secondCall).to.have.been.calledWith(mockDBConnection, { securityScopeId: scopeIdTwo });
      expect(insertTeamGrantStub).to.have.been.calledOnceWith(teamId, policyId);
      expect(publishStub).to.have.been.calledBefore(insertTeamGrantStub);
    });

    it('A2: not approved → short-circuits before any materialization or team grant', async () => {
      sinon.stub(SecurityScopeRepository.prototype, 'findActiveAllowStatementsForApprovedPolicy').resolves([]);

      const insertScopeStub = sinon.stub(SecurityScopeRepository.prototype, 'insertSecurityScope');
      const publishStub = sinon.stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob');
      const insertTeamGrantStub = sinon.stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesForPolicy');

      await service.materializeStatementScopesAndTeamAccess(teamId, policyId);

      expect(insertScopeStub).not.to.have.been.called;
      expect(publishStub).not.to.have.been.called;
      expect(insertTeamGrantStub).not.to.have.been.called;
    });

    it('A3: approved with zero ALLOW statements → same observable behavior as A2 (no team grant)', async () => {
      // The repository returns `[]` both when the policy is not approved AND when
      // the policy is approved but has no active ALLOW statements (the SQL filters
      // on both gates). At the service layer the two cases are indistinguishable
      // and both short-circuit before the team-grant insert. The integration test
      // suite covers the SQL-layer distinction.
      sinon.stub(SecurityScopeRepository.prototype, 'findActiveAllowStatementsForApprovedPolicy').resolves([]);

      const insertScopeStub = sinon.stub(SecurityScopeRepository.prototype, 'insertSecurityScope');
      const insertTeamGrantStub = sinon.stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesForPolicy');

      await service.materializeStatementScopesAndTeamAccess(teamId, policyId);

      expect(insertScopeStub).not.to.have.been.called;
      expect(insertTeamGrantStub).not.to.have.been.called;
    });

    it('A4: ALLOW statement scope exists → anchor re-queued and team grant inserted', async () => {
      sinon
        .stub(SecurityScopeRepository.prototype, 'findActiveAllowStatementsForApprovedPolicy')
        .resolves([{ security_scope_id: scopeIdOne }]);
      const publishStub = sinon
        .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
        .resolves({ status: 'published', jobId: 'job-1' });
      const insertTeamGrantStub = sinon
        .stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesForPolicy')
        .resolves();

      await service.materializeStatementScopesAndTeamAccess(teamId, policyId);

      expect(publishStub).to.have.been.calledOnceWith(mockDBConnection, { securityScopeId: scopeIdOne });
      expect(insertTeamGrantStub).to.have.been.calledOnceWith(teamId, policyId);
    });

    it('A5: called twice with the same args → both resolve (idempotency)', async () => {
      sinon
        .stub(SecurityScopeRepository.prototype, 'findActiveAllowStatementsForApprovedPolicy')
        .resolves([{ security_scope_id: scopeIdOne }]);
      const publishStub = sinon
        .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
        .resolves({ status: 'published', jobId: 'job-1' });
      const insertTeamGrantStub = sinon
        .stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesForPolicy')
        .resolves();

      await service.materializeStatementScopesAndTeamAccess(teamId, policyId);
      await service.materializeStatementScopesAndTeamAccess(teamId, policyId);

      // Idempotency at this layer means the service runs the same chain on each call
      // without early-exit or throw. SQL-level dedup (ON CONFLICT DO NOTHING) is the
      // production safety net; the integration test suite covers that.
      expect(publishStub).to.have.been.calledTwice;
      expect(insertTeamGrantStub).to.have.been.calledTwice;
    });

    it('A6: publish failure on the first statement aborts before the team grant runs', async () => {
      sinon
        .stub(SecurityScopeRepository.prototype, 'findActiveAllowStatementsForApprovedPolicy')
        .resolves([{ security_scope_id: scopeIdOne }, { security_scope_id: scopeIdTwo }]);

      sinon
        .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
        .rejects(new Error('pg-boss unavailable'));
      const insertTeamGrantStub = sinon
        .stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesForPolicy')
        .resolves();

      try {
        await service.materializeStatementScopesAndTeamAccess(teamId, policyId);
        expect.fail('expected materializeStatementScopesAndTeamAccess to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('pg-boss unavailable');
      }

      // Sequential for-await — second statement never reached, team grant never runs.
      expect(insertTeamGrantStub).not.to.have.been.called;
    });
  });

  describe('refreshAccessForPolicy', () => {
    it('skips materialization and grant rebuilds when no teams are linked to the policy', async () => {
      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves([]);
      const materializeStub = sinon.stub(service, 'materializePolicyStatementScopes').resolves(true);
      const rebuildStub = sinon.stub(service, 'rebuildTeamSecurityScopes').resolves();

      await service.refreshAccessForPolicy('policy-1');

      expect(materializeStub).to.not.have.been.called;
      expect(rebuildStub).to.not.have.been.called;
    });

    it('materializes current policy scopes once and rebuilds each linked team', async () => {
      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves([
        { team_policy_id: 'tp-1', team_id: 'team-1', policy_id: 'policy-1' },
        { team_policy_id: 'tp-2', team_id: 'team-2', policy_id: 'policy-1' }
      ] as any);
      const materializeStub = sinon.stub(service, 'materializePolicyStatementScopes').resolves(true);
      const rebuildStub = sinon.stub(service, 'rebuildTeamSecurityScopes').resolves();

      await service.refreshAccessForPolicy('policy-1');

      expect(materializeStub).to.have.been.calledOnceWith('policy-1');
      expect(rebuildStub).to.have.been.calledTwice;
      expect(rebuildStub.firstCall).to.have.been.calledWith('team-1');
      expect(rebuildStub.secondCall).to.have.been.calledWith('team-2');
      expect(materializeStub).to.have.been.calledBefore(rebuildStub);
    });
  });

  describe('triggerAnchorComputationForSubmission', () => {
    it('publishes anchor computation jobs for each matching scope', async () => {
      const findStub = sinon
        .stub(SecurityScopeRepository.prototype, 'findScopeIdsMatchingSubmission')
        .resolves([{ security_scope_id: 'scope-1' }, { security_scope_id: 'scope-2' }]);
      const publishStub = sinon
        .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      await service.triggerAnchorComputationForSubmission(42);

      expect(findStub).to.have.been.calledOnceWith(42);
      expect(publishStub).to.have.been.calledTwice;
      expect(publishStub.firstCall).to.have.been.calledWith(mockDBConnection, { securityScopeId: 'scope-1' });
      expect(publishStub.secondCall).to.have.been.calledWith(mockDBConnection, { securityScopeId: 'scope-2' });
    });

    it('does not publish when no scopes match the submission', async () => {
      const findStub = sinon.stub(SecurityScopeRepository.prototype, 'findScopeIdsMatchingSubmission').resolves([]);
      const publishStub = sinon
        .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      await service.triggerAnchorComputationForSubmission(999);

      expect(findStub).to.have.been.calledOnceWith(999);
      expect(publishStub).not.to.have.been.called;
    });

    it('throws when publishComputeScopeAnchorsJob throws (trigger loop)', async () => {
      sinon
        .stub(SecurityScopeRepository.prototype, 'findScopeIdsMatchingSubmission')
        .resolves([{ security_scope_id: 'scope-1' }]);
      sinon
        .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
        .rejects(new Error('pg-boss unavailable'));

      try {
        await service.triggerAnchorComputationForSubmission(1);
        expect.fail('expected triggerAnchorComputationForSubmission to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('pg-boss unavailable');
      }
    });
  });

  describe('deleteStaleAnchorBatch', () => {
    it('delegates to repository and returns batch result', async () => {
      const stub = sinon
        .stub(SecurityScopeRepository.prototype, 'deleteStaleAnchorBatch')
        .resolves({ pageLastId: 5000 });

      const result = await service.deleteStaleAnchorBatch('scope-1', 0);

      expect(stub).to.have.been.calledOnceWith('scope-1', 0);
      expect(result).to.deep.equal({ pageLastId: 5000 });
    });

    it('returns null when no more anchors', async () => {
      sinon.stub(SecurityScopeRepository.prototype, 'deleteStaleAnchorBatch').resolves(null);

      const result = await service.deleteStaleAnchorBatch('scope-1', 5000);

      expect(result).to.be.null;
    });
  });

  describe('resolveUrnForScope', () => {
    it('returns URN from repository', async () => {
      const urn = { urn_submission_id: '*', urn_feature_type: 'telemetry', urn_feature_id: '*' };
      sinon.stub(SecurityScopeRepository.prototype, 'resolveUrnForScope').resolves(urn);

      const result = await service.resolveUrnForScope('scope-1');

      expect(result).to.deep.equal(urn);
    });

    it('returns null when no active policy statements', async () => {
      sinon.stub(SecurityScopeRepository.prototype, 'resolveUrnForScope').resolves(null);

      const result = await service.resolveUrnForScope('scope-1');

      expect(result).to.be.null;
    });
  });

  describe('computeAnchorBatch', () => {
    const urn = { urn_submission_id: '*', urn_feature_type: 'telemetry', urn_feature_id: '*' };

    it('delegates to repository and returns batch result', async () => {
      const stub = sinon.stub(SecurityScopeRepository.prototype, 'computeAnchorBatch').resolves({ pageLastId: 5000 });

      const result = await service.computeAnchorBatch('scope-1', urn, 0);

      expect(stub).to.have.been.calledOnceWith('scope-1', urn, 0);
      expect(result).to.deep.equal({ pageLastId: 5000 });
    });

    it('returns null when no more candidates', async () => {
      sinon.stub(SecurityScopeRepository.prototype, 'computeAnchorBatch').resolves(null);

      const result = await service.computeAnchorBatch('scope-1', urn, 5000);

      expect(result).to.be.null;
    });
  });
});
