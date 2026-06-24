import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { ApiValidationError } from '../../errors/api-error';
import {
  CreatePolicyStatement,
  PolicyEffect,
  PolicyStatement,
  UpdatePolicyStatement
} from '../../models/policy-statement';
import { PolicyStatementRepository } from '../../repositories/authorization/policy-statement-repository';
import { TeamPolicyRepository } from '../../repositories/authorization/team-policy-repository';
import { PolicyExpressionRepository } from '../../repositories/policy-expression-repository';
import { PolicyStatementService } from './policy-statement-service';
import { SecurityScopeService } from './security-scope-service';

chai.use(sinonChai);

describe('PolicyStatementService', () => {
  let mockDBConnection: any;
  let service: PolicyStatementService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new PolicyStatementService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createPolicyStatement', () => {
    it('should call repository.insertPolicyStatement and return the created record', async () => {
      const mockStatement: PolicyStatement = {
        policy_statement_id: '11111111-1111-1111-1111-111111111111',
        policy_id: '22222222-2222-2222-2222-222222222222',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:1:dataset:1',
        policy_expression_id: null
      };
      const stub = sinon.stub(PolicyStatementRepository.prototype, 'insertPolicyStatement').resolves(mockStatement);
      const refreshStub = sinon.stub(SecurityScopeService.prototype, 'refreshAccessForPolicy').resolves();

      const input: CreatePolicyStatement = {
        policy_id: '22222222-2222-2222-2222-222222222222',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:1:dataset:1'
      };

      const result = await service.createPolicyStatement(input);

      expect(stub).to.have.been.calledWith(input);
      expect(refreshStub).to.have.been.calledOnceWith('22222222-2222-2222-2222-222222222222');
      expect(result).to.eql(mockStatement);
    });

    it('validates and persists policy_expression_id when provided', async () => {
      const linkedStatement: PolicyStatement = {
        policy_statement_id: '11111111-1111-1111-1111-111111111111',
        policy_id: '22222222-2222-2222-2222-222222222222',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:1:dataset:1',
        policy_expression_id: '33333333-3333-3333-3333-333333333333'
      };
      const insertStub = sinon
        .stub(PolicyStatementRepository.prototype, 'insertPolicyStatement')
        .resolves(linkedStatement);
      sinon.stub(PolicyExpressionRepository.prototype, 'getPolicyExpressionById').resolves({
        policy_expression_id: '33333333-3333-3333-3333-333333333333',
        policy_id: '22222222-2222-2222-2222-222222222222',
        expression_id: '44444444-4444-4444-4444-444444444444',
        name: null,
        description: null
      });
      const refreshStub = sinon.stub(SecurityScopeService.prototype, 'refreshAccessForPolicy').resolves();

      const input: CreatePolicyStatement = {
        policy_id: '22222222-2222-2222-2222-222222222222',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:1:dataset:1',
        policy_expression_id: '33333333-3333-3333-3333-333333333333'
      };
      const result = await service.createPolicyStatement(input);

      expect(insertStub).to.have.been.calledOnceWithExactly(input);
      expect(refreshStub).to.have.been.calledOnceWith('22222222-2222-2222-2222-222222222222');
      expect(result).to.eql(linkedStatement);
    });
  });
  describe('getPolicyStatements', () => {
    it('should call repository.getPolicyStatements and return the records', async () => {
      const mockStatements: PolicyStatement[] = [
        {
          policy_statement_id: '11111111-1111-1111-1111-111111111111',
          policy_id: '22222222-2222-2222-2222-222222222222',
          effect: PolicyEffect.DENY,
          submission_feature_urn: 'urn:1:dataset:1',
          policy_expression_id: null
        },
        {
          policy_statement_id: '33333333-3333-3333-3333-333333333333',
          policy_id: '22222222-2222-2222-2222-222222222222',
          effect: PolicyEffect.ALLOW,
          submission_feature_urn: 'urn:1:dataset:3',
          policy_expression_id: null
        }
      ];

      const stub = sinon.stub(PolicyStatementRepository.prototype, 'getPolicyStatements').resolves(mockStatements);

      const result = await service.getPolicyStatements('22222222-2222-2222-2222-222222222222');

      expect(stub).to.have.been.calledWith('22222222-2222-2222-2222-222222222222');
      expect(result).to.eql(mockStatements);
    });
  });

  describe('getActiveStatementsWithExpressionByPolicyId', () => {
    it('passes through to the repository and returns the result unchanged', async () => {
      const mockRows = [
        {
          policy_statement_id: '11111111-1111-1111-1111-111111111111',
          urn_feature_type: 'dataset',
          expression_id: null
        },
        {
          policy_statement_id: '22222222-2222-2222-2222-222222222222',
          urn_feature_type: 'observation',
          expression_id: '33333333-3333-3333-3333-333333333333'
        }
      ];
      const stub = sinon
        .stub(PolicyStatementRepository.prototype, 'getActiveStatementsWithExpressionByPolicyId')
        .resolves(mockRows);

      const result = await service.getActiveStatementsWithExpressionByPolicyId('44444444-4444-4444-4444-444444444444');

      expect(stub).to.have.been.calledOnceWith('44444444-4444-4444-4444-444444444444');
      expect(result).to.eql(mockRows);
    });
  });

  describe('updatePolicyStatement', () => {
    it('should call repository.updatePolicyStatement and return the updated record', async () => {
      const mockStatement: PolicyStatement = {
        policy_statement_id: '11111111-1111-1111-1111-111111111111',
        policy_id: '22222222-2222-2222-2222-222222222222',
        effect: PolicyEffect.DENY,
        submission_feature_urn: 'urn:1:dataset:1',
        policy_expression_id: null
      };
      const stub = sinon.stub(PolicyStatementRepository.prototype, 'updatePolicyStatement').resolves(mockStatement);
      sinon.stub(PolicyStatementRepository.prototype, 'getPolicyStatement').resolves(mockStatement);
      const refreshStub = sinon.stub(SecurityScopeService.prototype, 'refreshAccessForPolicy').resolves();

      const updateData: UpdatePolicyStatement = {
        effect: PolicyEffect.DENY,
        submission_feature_urn: 'urn:1:dataset:1'
      };

      const result = await service.updatePolicyStatement('11111111-1111-1111-1111-111111111111', updateData);

      expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111', updateData);
      expect(refreshStub).to.not.have.been.called;
      expect(result).to.eql(mockStatement);
    });

    it('updates policy_expression_id without refreshing URN-derived access scopes', async () => {
      const updatedStatement: PolicyStatement = {
        policy_statement_id: '11111111-1111-1111-1111-111111111111',
        policy_id: '22222222-2222-2222-2222-222222222222',
        effect: PolicyEffect.DENY,
        submission_feature_urn: 'urn:1:dataset:1',
        policy_expression_id: null
      };
      const linkedStatement: PolicyStatement = {
        ...updatedStatement,
        policy_expression_id: '33333333-3333-3333-3333-333333333333'
      };
      const updateStub = sinon
        .stub(PolicyStatementRepository.prototype, 'updatePolicyStatement')
        .resolves(linkedStatement);
      sinon.stub(PolicyStatementRepository.prototype, 'getPolicyStatement').resolves(updatedStatement);
      sinon.stub(PolicyExpressionRepository.prototype, 'getPolicyExpressionById').resolves({
        policy_expression_id: '33333333-3333-3333-3333-333333333333',
        policy_id: '22222222-2222-2222-2222-222222222222',
        expression_id: '44444444-4444-4444-4444-444444444444',
        name: null,
        description: null
      });
      const refreshStub = sinon.stub(SecurityScopeService.prototype, 'refreshAccessForPolicy').resolves();

      const updateData = {
        policy_expression_id: '33333333-3333-3333-3333-333333333333'
      };
      const result = await service.updatePolicyStatement('11111111-1111-1111-1111-111111111111', updateData);

      expect(updateStub).to.have.been.calledOnceWithExactly('11111111-1111-1111-1111-111111111111', updateData);
      expect(refreshStub).to.not.have.been.called;
      expect(result).to.eql(linkedStatement);
    });

    it('clears policy_expression_id without refreshing URN-derived access scopes', async () => {
      const updatedStatement: PolicyStatement = {
        policy_statement_id: '11111111-1111-1111-1111-111111111111',
        policy_id: '22222222-2222-2222-2222-222222222222',
        effect: PolicyEffect.DENY,
        submission_feature_urn: 'urn:1:dataset:1',
        policy_expression_id: '33333333-3333-3333-3333-333333333333'
      };
      const unlinkedStatement: PolicyStatement = { ...updatedStatement, policy_expression_id: null };
      sinon.stub(PolicyStatementRepository.prototype, 'updatePolicyStatement').resolves(unlinkedStatement);
      sinon.stub(PolicyStatementRepository.prototype, 'getPolicyStatement').resolves(updatedStatement);
      const refreshStub = sinon.stub(SecurityScopeService.prototype, 'refreshAccessForPolicy').resolves();

      const result = await service.updatePolicyStatement('11111111-1111-1111-1111-111111111111', {
        policy_expression_id: null
      });

      expect(refreshStub).to.not.have.been.called;
      expect(result).to.eql(unlinkedStatement);
    });

    it('cleans old statement scopes and refreshes access when the URN changes', async () => {
      const existingStatement: PolicyStatement = {
        policy_statement_id: '11111111-1111-1111-1111-111111111111',
        policy_id: '22222222-2222-2222-2222-222222222222',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:1:dataset:1',
        policy_expression_id: null
      };
      const updatedStatement: PolicyStatement = {
        ...existingStatement,
        submission_feature_urn: 'urn:1:dataset:2'
      };
      sinon.stub(PolicyStatementRepository.prototype, 'getPolicyStatement').resolves(existingStatement);
      sinon.stub(PolicyStatementRepository.prototype, 'updatePolicyStatement').resolves(updatedStatement);
      sinon
        .stub(TeamPolicyRepository.prototype, 'getTeamPolicies')
        .resolves([{ team_policy_id: 'tp-1', team_id: 'team-1', policy_id: existingStatement.policy_id } as any]);
      const cleanupStub = sinon.stub(SecurityScopeService.prototype, 'cleanupScopesForDeletedStatements').resolves();
      const refreshStub = sinon.stub(SecurityScopeService.prototype, 'refreshAccessForPolicy').resolves();

      await service.updatePolicyStatement(existingStatement.policy_statement_id, {
        submission_feature_urn: 'urn:1:dataset:2'
      });

      expect(cleanupStub).to.have.been.calledOnceWith([existingStatement.policy_statement_id], ['team-1']);
      expect(refreshStub).to.have.been.calledOnceWith(existingStatement.policy_id);
    });

    it('rejects moving an existing statement to another policy', async () => {
      const existingStatement: PolicyStatement = {
        policy_statement_id: '11111111-1111-1111-1111-111111111111',
        policy_id: '22222222-2222-2222-2222-222222222222',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:1:dataset:1',
        policy_expression_id: '33333333-3333-3333-3333-333333333333'
      };
      sinon.stub(PolicyStatementRepository.prototype, 'getPolicyStatement').resolves(existingStatement);
      const updateStub = sinon.stub(PolicyStatementRepository.prototype, 'updatePolicyStatement');
      const refreshStub = sinon.stub(SecurityScopeService.prototype, 'refreshAccessForPolicy').resolves();

      try {
        await service.updatePolicyStatement(existingStatement.policy_statement_id, {
          policy_id: '44444444-4444-4444-4444-444444444444'
        });
        expect.fail('expected updatePolicyStatement to reject policy moves');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiValidationError);
        expect((error as ApiValidationError).message).to.equal(
          'Policy statement cannot be moved to a different policy'
        );
      }

      expect(updateStub).to.not.have.been.called;
      expect(refreshStub).to.not.have.been.called;
    });
  });

  describe('deletePolicyStatement', () => {
    it('should call repository.deletePolicyStatement', async () => {
      const mockStatement: PolicyStatement = {
        policy_statement_id: '11111111-1111-1111-1111-111111111111',
        policy_id: '22222222-2222-2222-2222-222222222222',
        effect: PolicyEffect.DENY,
        submission_feature_urn: 'urn:1:dataset:1',
        policy_expression_id: null
      };
      sinon.stub(PolicyStatementRepository.prototype, 'getPolicyStatement').resolves(mockStatement);
      sinon
        .stub(TeamPolicyRepository.prototype, 'getTeamPolicies')
        .resolves([{ team_policy_id: 'tp-1', team_id: 'team-1', policy_id: mockStatement.policy_id } as any]);
      const stub = sinon.stub(PolicyStatementRepository.prototype, 'deletePolicyStatement').resolves();
      const cleanupStub = sinon.stub(SecurityScopeService.prototype, 'cleanupScopesForDeletedStatements').resolves();
      const refreshStub = sinon.stub(SecurityScopeService.prototype, 'refreshAccessForPolicy').resolves();

      await service.deletePolicyStatement('11111111-1111-1111-1111-111111111111');

      expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
      expect(cleanupStub).to.have.been.calledOnceWith(['11111111-1111-1111-1111-111111111111'], ['team-1']);
      expect(refreshStub).to.not.have.been.called;
    });
  });
});
