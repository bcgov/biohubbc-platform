import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SecurityScope } from '../../models/security-scope';
import * as publisher from '../../queue/publisher';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import * as scopeHashUtil from '../../utils/scope-hash';
import { getMockDBConnection } from '../../__mocks__/db';
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

  describe('createScopeForPolicyStatement', () => {
    const policyStatementId = '11111111-1111-1111-1111-111111111111';
    const urn = 'urn:10:telemetry:*';
    const scopeHash = 'fakehash123';
    const securityScopeId = '22222222-2222-2222-2222-222222222222';

    beforeEach(() => {
      sinon.stub(scopeHashUtil, 'computeScopeHash').returns(scopeHash);
    });

    it('creates a new scope, mapping, and publishes anchor job when scope_hash is new', async () => {
      const newScope: SecurityScope = { security_scope_id: securityScopeId, scope_hash: scopeHash };
      const insertStub = sinon.stub(SecurityScopeRepository.prototype, 'insertSecurityScope').resolves(newScope);
      const mappingStub = sinon.stub(SecurityScopeRepository.prototype, 'insertPolicyStatementScope').resolves();
      const publishStub = sinon
        .stub(publisher, 'publishComputeScopeAnchorsJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      const result = await service.createScopeForPolicyStatement(policyStatementId, urn);

      expect(scopeHashUtil.computeScopeHash).to.have.been.calledWith(urn);
      expect(insertStub).to.have.been.calledWith(scopeHash);
      expect(mappingStub).to.have.been.calledWith(policyStatementId, securityScopeId);
      expect(publishStub).to.have.been.calledOnceWith(mockDBConnection, { securityScopeId });
      expect(result).to.equal(securityScopeId);
    });

    it('looks up existing scope and creates mapping without publishing when scope_hash already exists', async () => {
      const existingScope: SecurityScope = { security_scope_id: securityScopeId, scope_hash: scopeHash };
      const insertStub = sinon.stub(SecurityScopeRepository.prototype, 'insertSecurityScope').resolves(null);
      const getStub = sinon
        .stub(SecurityScopeRepository.prototype, 'getSecurityScopeByScopeHash')
        .resolves(existingScope);
      const mappingStub = sinon.stub(SecurityScopeRepository.prototype, 'insertPolicyStatementScope').resolves();
      const publishStub = sinon
        .stub(publisher, 'publishComputeScopeAnchorsJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      const result = await service.createScopeForPolicyStatement(policyStatementId, urn);

      expect(insertStub).to.have.been.calledWith(scopeHash);
      expect(getStub).to.have.been.calledWith(scopeHash);
      expect(mappingStub).to.have.been.calledWith(policyStatementId, securityScopeId);
      expect(publishStub).not.to.have.been.called;
      expect(result).to.equal(securityScopeId);
    });

    it('creates the policy_statement_scope mapping regardless of whether scope is new or existing', async () => {
      // New scope path
      const newScope: SecurityScope = { security_scope_id: securityScopeId, scope_hash: scopeHash };
      sinon.stub(SecurityScopeRepository.prototype, 'insertSecurityScope').resolves(newScope);
      const mappingStub = sinon.stub(SecurityScopeRepository.prototype, 'insertPolicyStatementScope').resolves();
      sinon.stub(publisher, 'publishComputeScopeAnchorsJob').resolves({ status: 'published', jobId: 'job-1' });

      await service.createScopeForPolicyStatement(policyStatementId, urn);

      expect(mappingStub).to.have.been.calledOnce;
      expect(mappingStub).to.have.been.calledWith(policyStatementId, securityScopeId);
    });
  });

  describe('cleanupScopesForDeletedStatements', () => {
    it('gathers scope IDs, deletes mappings, rebuilds teams, and cleans up orphaned anchors', async () => {
      const getScopeIdsStub = sinon
        .stub(SecurityScopeRepository.prototype, 'findScopeIdsForStatements')
        .resolves([{ security_scope_id: 'scope-1' }, { security_scope_id: 'scope-2' }]);
      const deleteStub = sinon.stub(SecurityScopeRepository.prototype, 'deletePolicyStatementScopes').resolves();
      const deleteTeamScopesStub = sinon.stub(SecurityScopeRepository.prototype, 'deleteTeamSecurityScopes').resolves();
      const insertFromChainStub = sinon
        .stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesFromPolicyChain')
        .resolves();
      const orphanStub = sinon.stub(SecurityScopeRepository.prototype, 'deleteAnchorsForOrphanedScopes').resolves();

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

      // Orphaned anchor cleanup happens after mappings are deleted
      expect(orphanStub).to.have.been.calledOnceWith(['scope-1', 'scope-2']);
      expect(orphanStub).to.have.been.calledAfter(deleteStub);
    });

    it('deletes mappings but skips rebuild when no affected teams', async () => {
      sinon
        .stub(SecurityScopeRepository.prototype, 'findScopeIdsForStatements')
        .resolves([{ security_scope_id: 'scope-1' }]);
      const deleteStub = sinon.stub(SecurityScopeRepository.prototype, 'deletePolicyStatementScopes').resolves();
      sinon.stub(SecurityScopeRepository.prototype, 'deleteTeamSecurityScopes').resolves();
      sinon.stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesFromPolicyChain').resolves();
      const orphanStub = sinon.stub(SecurityScopeRepository.prototype, 'deleteAnchorsForOrphanedScopes').resolves();

      await service.cleanupScopesForDeletedStatements(['ps-1'], []);

      expect(deleteStub).to.have.been.calledOnceWith(['ps-1']);
      expect(orphanStub).to.have.been.calledOnceWith(['scope-1']);
    });

    it('skips orphan cleanup when no scopes were affected', async () => {
      sinon.stub(SecurityScopeRepository.prototype, 'findScopeIdsForStatements').resolves([]);
      sinon.stub(SecurityScopeRepository.prototype, 'deletePolicyStatementScopes').resolves();
      sinon.stub(SecurityScopeRepository.prototype, 'deleteTeamSecurityScopes').resolves();
      sinon.stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesFromPolicyChain').resolves();
      const orphanStub = sinon.stub(SecurityScopeRepository.prototype, 'deleteAnchorsForOrphanedScopes').resolves();

      await service.cleanupScopesForDeletedStatements(['ps-1'], ['team-a']);

      expect(orphanStub).not.to.have.been.called;
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

  describe('grantTeamScopesForPolicy', () => {
    it('delegates to repository', async () => {
      const stub = sinon.stub(SecurityScopeRepository.prototype, 'insertTeamSecurityScopesForPolicy').resolves();

      await service.grantTeamScopesForPolicy('team-1', 'policy-1');

      expect(stub).to.have.been.calledOnceWith('team-1', 'policy-1');
    });
  });

  describe('triggerAnchorComputationForSubmission', () => {
    it('publishes anchor computation jobs for each matching scope', async () => {
      const findStub = sinon
        .stub(SecurityScopeRepository.prototype, 'findScopeIdsMatchingSubmission')
        .resolves([{ security_scope_id: 'scope-1' }, { security_scope_id: 'scope-2' }]);
      const publishStub = sinon
        .stub(publisher, 'publishComputeScopeAnchorsJob')
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
        .stub(publisher, 'publishComputeScopeAnchorsJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      await service.triggerAnchorComputationForSubmission(999);

      expect(findStub).to.have.been.calledOnceWith(999);
      expect(publishStub).not.to.have.been.called;
    });
  });

  describe('computeAnchorsForScope', () => {
    it('calls deleteStaleAnchorsForScope then computeAnchorsForScope on the repository in order', async () => {
      const deleteStub = sinon.stub(SecurityScopeRepository.prototype, 'deleteStaleAnchorsForScope').resolves();
      const computeStub = sinon.stub(SecurityScopeRepository.prototype, 'computeAnchorsForScope').resolves();

      await service.computeAnchorsForScope('scope-1');

      expect(deleteStub).to.have.been.calledOnceWith('scope-1');
      expect(computeStub).to.have.been.calledOnceWith('scope-1');
      expect(deleteStub).to.have.been.calledBefore(computeStub);
    });
  });
});
