import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { SecurityScope } from '../../models/security-scope';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
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

  describe('materializeScopeForPolicyStatement', () => {
    const policyStatementId = '11111111-1111-1111-1111-111111111111';
    const urn = 'urn:10:telemetry:*';
    const scopeHash = 'fakehash123';
    const securityScopeId = '22222222-2222-2222-2222-222222222222';

    beforeEach(() => {
      sinon.stub(SecurityScopeService.dependencies, 'computeScopeHash').returns(scopeHash);
    });

    it('creates a new scope, mapping, and publishes anchor job when scope_hash is new', async () => {
      const newScope: SecurityScope = { security_scope_id: securityScopeId, scope_hash: scopeHash };
      const insertStub = sinon.stub(SecurityScopeRepository.prototype, 'insertSecurityScope').resolves(newScope);
      const mappingStub = sinon.stub(SecurityScopeRepository.prototype, 'insertPolicyStatementScope').resolves();
      const publishStub = sinon
        .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      const result = await service.materializeScopeForPolicyStatement(policyStatementId, urn);

      expect(SecurityScopeService.dependencies.computeScopeHash).to.have.been.calledWith(urn);
      expect(insertStub).to.have.been.calledWith(scopeHash);
      expect(mappingStub).to.have.been.calledWith(policyStatementId, securityScopeId);
      expect(publishStub).to.have.been.calledOnceWith(mockDBConnection, { securityScopeId });
      expect(result).to.equal(securityScopeId);
    });

    it('looks up existing scope, creates mapping, and publishes anchor job when scope_hash already exists', async () => {
      const existingScope: SecurityScope = { security_scope_id: securityScopeId, scope_hash: scopeHash };
      const insertStub = sinon.stub(SecurityScopeRepository.prototype, 'insertSecurityScope').resolves(null);
      const getStub = sinon
        .stub(SecurityScopeRepository.prototype, 'getSecurityScopeByScopeHash')
        .resolves(existingScope);
      const mappingStub = sinon.stub(SecurityScopeRepository.prototype, 'insertPolicyStatementScope').resolves();
      const publishStub = sinon
        .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      const result = await service.materializeScopeForPolicyStatement(policyStatementId, urn);

      expect(insertStub).to.have.been.calledWith(scopeHash);
      expect(getStub).to.have.been.calledWith(scopeHash);
      expect(mappingStub).to.have.been.calledWith(policyStatementId, securityScopeId);
      expect(publishStub).to.have.been.calledOnceWith(mockDBConnection, { securityScopeId });
      expect(result).to.equal(securityScopeId);
    });

    it('creates the policy_statement_scope mapping regardless of whether scope is new or existing', async () => {
      // New scope path
      const newScope: SecurityScope = { security_scope_id: securityScopeId, scope_hash: scopeHash };
      sinon.stub(SecurityScopeRepository.prototype, 'insertSecurityScope').resolves(newScope);
      const mappingStub = sinon.stub(SecurityScopeRepository.prototype, 'insertPolicyStatementScope').resolves();
      sinon
        .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      await service.materializeScopeForPolicyStatement(policyStatementId, urn);

      expect(mappingStub).to.have.been.calledOnce;
      expect(mappingStub).to.have.been.calledWith(policyStatementId, securityScopeId);
    });

    it('throws when publishComputeScopeAnchorsJob throws (new scope branch)', async () => {
      const newScope: SecurityScope = { security_scope_id: securityScopeId, scope_hash: scopeHash };
      sinon.stub(SecurityScopeRepository.prototype, 'insertSecurityScope').resolves(newScope);
      sinon.stub(SecurityScopeRepository.prototype, 'insertPolicyStatementScope').resolves();
      sinon
        .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
        .rejects(new Error('pg-boss unavailable'));

      try {
        await service.materializeScopeForPolicyStatement(policyStatementId, urn);
        expect.fail('expected materializeScopeForPolicyStatement to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('pg-boss unavailable');
      }
    });

    it('throws when publishComputeScopeAnchorsJob throws (existing scope branch)', async () => {
      const existingScope: SecurityScope = { security_scope_id: securityScopeId, scope_hash: scopeHash };
      sinon.stub(SecurityScopeRepository.prototype, 'insertSecurityScope').resolves(null);
      sinon.stub(SecurityScopeRepository.prototype, 'getSecurityScopeByScopeHash').resolves(existingScope);
      sinon.stub(SecurityScopeRepository.prototype, 'insertPolicyStatementScope').resolves();
      sinon
        .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
        .rejects(new Error('pg-boss unavailable'));

      try {
        await service.materializeScopeForPolicyStatement(policyStatementId, urn);
        expect.fail('expected materializeScopeForPolicyStatement to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('pg-boss unavailable');
      }
    });
  });

  describe('cleanupScopesForDeletedStatements', () => {
    it('gathers scope IDs, deletes mappings, rebuilds teams, and enqueues jobs for orphaned scopes', async () => {
      const getScopeIdsStub = sinon
        .stub(SecurityScopeRepository.prototype, 'findScopeIdsForStatements')
        .resolves([{ security_scope_id: 'scope-1' }, { security_scope_id: 'scope-2' }]);
      const deleteStub = sinon.stub(SecurityScopeRepository.prototype, 'deletePolicyStatementScopes').resolves();
      const deleteTeamScopesStub = sinon.stub(SecurityScopeRepository.prototype, 'deleteTeamSecurityScopes').resolves();
      const insertFromChainStub = sinon
        .stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesFromPolicyChain')
        .resolves();
      // scope-1 is orphaned, scope-2 is still referenced by another statement
      const orphanStub = sinon
        .stub(SecurityScopeRepository.prototype, 'findOrphanedScopeIds')
        .resolves([{ security_scope_id: 'scope-1' }]);
      const publishStub = sinon
        .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      await service.cleanupScopesForDeletedStatements(['ps-1', 'ps-2'], ['team-a', 'team-b']);

      // Gather scope IDs BEFORE deleting mappings
      expect(getScopeIdsStub).to.have.been.calledOnceWith(['ps-1', 'ps-2']);
      expect(getScopeIdsStub).to.have.been.calledBefore(deleteStub);

      expect(deleteStub).to.have.been.calledOnceWith(['ps-1', 'ps-2']);
      expect(deleteTeamScopesStub).to.have.been.calledTwice;
      expect(deleteTeamScopesStub.firstCall).to.have.been.calledWith('team-a');
      expect(deleteTeamScopesStub.secondCall).to.have.been.calledWith('team-b');
      expect(insertFromChainStub).to.have.been.calledTwice;
      expect(insertFromChainStub.firstCall).to.have.been.calledWith('team-a');
      expect(insertFromChainStub.secondCall).to.have.been.calledWith('team-b');

      // Only orphaned scopes get anchor cleanup jobs (shared scopes are skipped)
      expect(orphanStub).to.have.been.calledOnceWith(['scope-1', 'scope-2']);
      expect(publishStub).to.have.been.calledOnceWith(mockDBConnection, { securityScopeId: 'scope-1' });
    });

    it('publishes jobs only for orphaned scopes, not shared ones', async () => {
      sinon
        .stub(SecurityScopeRepository.prototype, 'findScopeIdsForStatements')
        .resolves([{ security_scope_id: 'scope-1' }, { security_scope_id: 'scope-2' }]);
      sinon.stub(SecurityScopeRepository.prototype, 'deletePolicyStatementScopes').resolves();
      sinon.stub(SecurityScopeRepository.prototype, 'deleteTeamSecurityScopes').resolves();
      sinon.stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesFromPolicyChain').resolves();
      // No scopes are orphaned — all still referenced by other statements
      sinon.stub(SecurityScopeRepository.prototype, 'findOrphanedScopeIds').resolves([]);
      const publishStub = sinon
        .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      await service.cleanupScopesForDeletedStatements(['ps-1'], ['team-a']);

      expect(publishStub).not.to.have.been.called;
    });

    it('skips orphan check when no scopes were affected', async () => {
      sinon.stub(SecurityScopeRepository.prototype, 'findScopeIdsForStatements').resolves([]);
      sinon.stub(SecurityScopeRepository.prototype, 'deletePolicyStatementScopes').resolves();
      sinon.stub(SecurityScopeRepository.prototype, 'deleteTeamSecurityScopes').resolves();
      sinon.stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesFromPolicyChain').resolves();
      const orphanStub = sinon.stub(SecurityScopeRepository.prototype, 'findOrphanedScopeIds');
      const publishStub = sinon
        .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      await service.cleanupScopesForDeletedStatements(['ps-1'], ['team-a']);

      expect(orphanStub).not.to.have.been.called;
      expect(publishStub).not.to.have.been.called;
    });

    it('throws when publishComputeScopeAnchorsJob throws (cleanup loop)', async () => {
      sinon
        .stub(SecurityScopeRepository.prototype, 'findScopeIdsForStatements')
        .resolves([{ security_scope_id: 'scope-1' }]);
      sinon.stub(SecurityScopeRepository.prototype, 'deletePolicyStatementScopes').resolves();
      sinon.stub(SecurityScopeRepository.prototype, 'deleteTeamSecurityScopes').resolves();
      sinon.stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesFromPolicyChain').resolves();
      sinon
        .stub(SecurityScopeRepository.prototype, 'findOrphanedScopeIds')
        .resolves([{ security_scope_id: 'scope-1' }]);
      sinon
        .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
        .rejects(new Error('pg-boss unavailable'));

      try {
        await service.cleanupScopesForDeletedStatements(['ps-1'], ['team-1']);
        expect.fail('expected cleanupScopesForDeletedStatements to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('pg-boss unavailable');
      }
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
    const statementOneId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const statementTwoId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const urnOne = 'urn:10:telemetry:*';
    const urnTwo = 'urn:10:observation:*';
    const scopeIdOne = '11111111-1111-1111-1111-111111111111';
    const scopeIdTwo = '22222222-2222-2222-2222-222222222222';

    it('A1: materializes ALLOW statements then issues the team grant (effect gate + ordering)', async () => {
      const getStatementsStub = sinon
        .stub(SecurityScopeRepository.prototype, 'getActiveAllowStatementsForApprovedPolicy')
        .resolves([
          { policy_statement_id: statementOneId, submission_feature_urn: urnOne },
          { policy_statement_id: statementTwoId, submission_feature_urn: urnTwo }
        ]);

      const computeHashStub = sinon
        .stub(SecurityScopeService.dependencies, 'computeScopeHash')
        .onFirstCall()
        .returns('hash-1')
        .onSecondCall()
        .returns('hash-2');

      const insertScopeStub = sinon
        .stub(SecurityScopeRepository.prototype, 'insertSecurityScope')
        .onFirstCall()
        .resolves({ security_scope_id: scopeIdOne, scope_hash: 'hash-1' })
        .onSecondCall()
        .resolves({ security_scope_id: scopeIdTwo, scope_hash: 'hash-2' });

      const insertMappingStub = sinon.stub(SecurityScopeRepository.prototype, 'insertPolicyStatementScope').resolves();

      const publishStub = sinon
        .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      const insertTeamGrantStub = sinon
        .stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesForPolicy')
        .resolves();

      await service.materializeStatementScopesAndTeamAccess(teamId, policyId);

      expect(getStatementsStub).to.have.been.calledOnceWith(policyId);
      expect(computeHashStub).to.have.been.calledTwice;
      expect(insertScopeStub).to.have.been.calledTwice;
      expect(insertMappingStub).to.have.been.calledTwice;
      expect(insertMappingStub.firstCall).to.have.been.calledWith(statementOneId, scopeIdOne);
      expect(insertMappingStub.secondCall).to.have.been.calledWith(statementTwoId, scopeIdTwo);
      expect(publishStub).to.have.been.calledTwice;
      expect(insertTeamGrantStub).to.have.been.calledOnceWith(teamId, policyId);
      // Materialize-then-grant ordering: every mapping insert precedes the team grant.
      expect(insertMappingStub).to.have.been.calledBefore(insertTeamGrantStub);
      expect(publishStub).to.have.been.calledBefore(insertTeamGrantStub);
    });

    it('A2: not approved → short-circuits before any materialization or team grant', async () => {
      sinon.stub(SecurityScopeRepository.prototype, 'getActiveAllowStatementsForApprovedPolicy').resolves([]);

      const insertScopeStub = sinon.stub(SecurityScopeRepository.prototype, 'insertSecurityScope');
      const insertMappingStub = sinon.stub(SecurityScopeRepository.prototype, 'insertPolicyStatementScope');
      const publishStub = sinon.stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob');
      const insertTeamGrantStub = sinon.stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesForPolicy');

      await service.materializeStatementScopesAndTeamAccess(teamId, policyId);

      expect(insertScopeStub).not.to.have.been.called;
      expect(insertMappingStub).not.to.have.been.called;
      expect(publishStub).not.to.have.been.called;
      expect(insertTeamGrantStub).not.to.have.been.called;
    });

    it('A3: approved with zero ALLOW statements → same observable behavior as A2 (no team grant)', async () => {
      // The repository returns `[]` both when the policy is not approved AND when
      // the policy is approved but has no active ALLOW statements (the SQL filters
      // on both gates). At the service layer the two cases are indistinguishable
      // and both short-circuit before the team-grant insert. The integration test
      // suite covers the SQL-layer distinction.
      sinon.stub(SecurityScopeRepository.prototype, 'getActiveAllowStatementsForApprovedPolicy').resolves([]);

      const insertScopeStub = sinon.stub(SecurityScopeRepository.prototype, 'insertSecurityScope');
      const insertTeamGrantStub = sinon.stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesForPolicy');

      await service.materializeStatementScopesAndTeamAccess(teamId, policyId);

      expect(insertScopeStub).not.to.have.been.called;
      expect(insertTeamGrantStub).not.to.have.been.called;
    });

    it('A4: ALLOW statement URN already has a scope → existing scope reused, mapping inserted, anchor re-queued', async () => {
      sinon
        .stub(SecurityScopeRepository.prototype, 'getActiveAllowStatementsForApprovedPolicy')
        .resolves([{ policy_statement_id: statementOneId, submission_feature_urn: urnOne }]);

      sinon.stub(SecurityScopeService.dependencies, 'computeScopeHash').returns('hash-1');

      // First insert returns null (existing scope wins the conflict).
      sinon.stub(SecurityScopeRepository.prototype, 'insertSecurityScope').resolves(null);
      const getExistingStub = sinon
        .stub(SecurityScopeRepository.prototype, 'getSecurityScopeByScopeHash')
        .resolves({ security_scope_id: scopeIdOne, scope_hash: 'hash-1' });

      const insertMappingStub = sinon.stub(SecurityScopeRepository.prototype, 'insertPolicyStatementScope').resolves();
      const publishStub = sinon
        .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
        .resolves({ status: 'published', jobId: 'job-1' });
      const insertTeamGrantStub = sinon
        .stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesForPolicy')
        .resolves();

      await service.materializeStatementScopesAndTeamAccess(teamId, policyId);

      expect(getExistingStub).to.have.been.calledOnceWith('hash-1');
      expect(insertMappingStub).to.have.been.calledOnceWith(statementOneId, scopeIdOne);
      expect(publishStub).to.have.been.calledOnceWith(mockDBConnection, { securityScopeId: scopeIdOne });
      expect(insertTeamGrantStub).to.have.been.calledOnceWith(teamId, policyId);
    });

    it('A5: called twice with the same args → both resolve (idempotency)', async () => {
      sinon
        .stub(SecurityScopeRepository.prototype, 'getActiveAllowStatementsForApprovedPolicy')
        .resolves([{ policy_statement_id: statementOneId, submission_feature_urn: urnOne }]);
      sinon.stub(SecurityScopeService.dependencies, 'computeScopeHash').returns('hash-1');
      sinon
        .stub(SecurityScopeRepository.prototype, 'insertSecurityScope')
        .resolves({ security_scope_id: scopeIdOne, scope_hash: 'hash-1' });
      sinon.stub(SecurityScopeRepository.prototype, 'insertPolicyStatementScope').resolves();
      sinon
        .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
        .resolves({ status: 'published', jobId: 'job-1' });
      sinon.stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesForPolicy').resolves();

      await service.materializeStatementScopesAndTeamAccess(teamId, policyId);
      await service.materializeStatementScopesAndTeamAccess(teamId, policyId);
    });

    it('A6: publish failure on the first statement aborts before the team grant runs', async () => {
      sinon.stub(SecurityScopeRepository.prototype, 'getActiveAllowStatementsForApprovedPolicy').resolves([
        { policy_statement_id: statementOneId, submission_feature_urn: urnOne },
        { policy_statement_id: statementTwoId, submission_feature_urn: urnTwo }
      ]);

      sinon.stub(SecurityScopeService.dependencies, 'computeScopeHash').returns('hash-1');
      const insertScopeStub = sinon
        .stub(SecurityScopeRepository.prototype, 'insertSecurityScope')
        .resolves({ security_scope_id: scopeIdOne, scope_hash: 'hash-1' });
      sinon.stub(SecurityScopeRepository.prototype, 'insertPolicyStatementScope').resolves();
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
      expect(insertScopeStub).to.have.been.calledOnce;
      expect(insertTeamGrantStub).not.to.have.been.called;
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
