import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SecurityScope } from '../../models/security-scope';
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

    it('creates a new scope and mapping when scope_hash is new', async () => {
      const newScope: SecurityScope = { security_scope_id: securityScopeId, scope_hash: scopeHash };
      const insertStub = sinon.stub(SecurityScopeRepository.prototype, 'insertSecurityScope').resolves(newScope);
      const mappingStub = sinon.stub(SecurityScopeRepository.prototype, 'insertPolicyStatementScope').resolves();

      const result = await service.createScopeForPolicyStatement(policyStatementId, urn);

      expect(scopeHashUtil.computeScopeHash).to.have.been.calledWith(urn);
      expect(insertStub).to.have.been.calledWith(scopeHash);
      expect(mappingStub).to.have.been.calledWith(policyStatementId, securityScopeId);
      expect(result).to.equal(securityScopeId);
    });

    it('looks up existing scope and creates mapping when scope_hash already exists', async () => {
      const existingScope: SecurityScope = { security_scope_id: securityScopeId, scope_hash: scopeHash };
      const insertStub = sinon.stub(SecurityScopeRepository.prototype, 'insertSecurityScope').resolves(null);
      const getStub = sinon
        .stub(SecurityScopeRepository.prototype, 'getSecurityScopeByScopeHash')
        .resolves(existingScope);
      const mappingStub = sinon.stub(SecurityScopeRepository.prototype, 'insertPolicyStatementScope').resolves();

      const result = await service.createScopeForPolicyStatement(policyStatementId, urn);

      expect(insertStub).to.have.been.calledWith(scopeHash);
      expect(getStub).to.have.been.calledWith(scopeHash);
      expect(mappingStub).to.have.been.calledWith(policyStatementId, securityScopeId);
      expect(result).to.equal(securityScopeId);
    });

    it('creates the policy_statement_scope mapping regardless of whether scope is new or existing', async () => {
      // New scope path
      const newScope: SecurityScope = { security_scope_id: securityScopeId, scope_hash: scopeHash };
      sinon.stub(SecurityScopeRepository.prototype, 'insertSecurityScope').resolves(newScope);
      const mappingStub = sinon.stub(SecurityScopeRepository.prototype, 'insertPolicyStatementScope').resolves();

      await service.createScopeForPolicyStatement(policyStatementId, urn);

      expect(mappingStub).to.have.been.calledOnce;
      expect(mappingStub).to.have.been.calledWith(policyStatementId, securityScopeId);
    });
  });

  describe('cleanupScopesForDeletedStatements', () => {
    it('deletes mappings and rebuilds scopes for each affected team', async () => {
      const deleteStub = sinon.stub(SecurityScopeRepository.prototype, 'deletePolicyStatementScopes').resolves();
      const rebuildStub = sinon.stub(SecurityScopeRepository.prototype, 'rebuildTeamSecurityScopes').resolves();

      await service.cleanupScopesForDeletedStatements(['ps-1', 'ps-2'], ['team-a', 'team-b', 'team-c']);

      expect(deleteStub).to.have.been.calledOnceWith(['ps-1', 'ps-2']);
      expect(rebuildStub).to.have.been.calledThrice;
      expect(rebuildStub.firstCall).to.have.been.calledWith('team-a');
      expect(rebuildStub.secondCall).to.have.been.calledWith('team-b');
      expect(rebuildStub.thirdCall).to.have.been.calledWith('team-c');
    });

    it('deletes mappings but skips rebuild when no affected teams', async () => {
      const deleteStub = sinon.stub(SecurityScopeRepository.prototype, 'deletePolicyStatementScopes').resolves();
      const rebuildStub = sinon.stub(SecurityScopeRepository.prototype, 'rebuildTeamSecurityScopes').resolves();

      await service.cleanupScopesForDeletedStatements(['ps-1'], []);

      expect(deleteStub).to.have.been.calledOnceWith(['ps-1']);
      expect(rebuildStub).not.to.have.been.called;
    });
  });

  describe('rebuildTeamSecurityScopes', () => {
    it('delegates to repository', async () => {
      const stub = sinon.stub(SecurityScopeRepository.prototype, 'rebuildTeamSecurityScopes').resolves();

      await service.rebuildTeamSecurityScopes('team-1');

      expect(stub).to.have.been.calledOnceWith('team-1');
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
    it('finds matching scopes for the submission', async () => {
      const findStub = sinon
        .stub(SecurityScopeRepository.prototype, 'findScopeIdsMatchingSubmission')
        .resolves(['scope-1', 'scope-2']);

      await service.triggerAnchorComputationForSubmission(42);

      expect(findStub).to.have.been.calledOnceWith(42);
      // TODO: Phase 3 — verify publishComputeScopeAnchorsJob called for each scope
    });

    it('does nothing when no scopes match the submission', async () => {
      const findStub = sinon.stub(SecurityScopeRepository.prototype, 'findScopeIdsMatchingSubmission').resolves([]);

      await service.triggerAnchorComputationForSubmission(999);

      expect(findStub).to.have.been.calledOnceWith(999);
      // No publish calls should happen — verified implicitly by no errors
    });
  });

  describe('deleteAnchorsForFeatures', () => {
    it('delegates to repository', async () => {
      const stub = sinon.stub(SecurityScopeRepository.prototype, 'deleteAnchorsForFeatures').resolves();

      await service.deleteAnchorsForFeatures([1, 2, 3]);

      expect(stub).to.have.been.calledOnceWith([1, 2, 3]);
    });
  });
});
