import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { CreatePolicy, Policy, UpdatePolicy } from '../../models/policy';
import { PolicyEffect, PolicyStatement } from '../../models/policy-statement';
import { PolicyConditionOperator, PolicyStatementCondition } from '../../models/policy-statement-condition';
import { PolicyRepository } from '../../repositories/authorization/policy-repository';
import { PolicyStatementConditionRepository } from '../../repositories/authorization/policy-statement-condition-repository';
import { PolicyStatementRepository } from '../../repositories/authorization/policy-statement-repository';
import { TeamPolicyRepository } from '../../repositories/authorization/team-policy-repository';
import { PolicyService } from './policy-service';
import { SecurityScopeService } from './security-scope-service';

chai.use(sinonChai);

describe('PolicyService', () => {
  let mockDBConnection: any;
  let policyService: PolicyService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    policyService = new PolicyService(mockDBConnection);
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
  });

  describe('deletePolicy', () => {
    it('should fetch teams and statements before soft-delete, then clean up scope mappings', async () => {
      const mockStatements: PolicyStatement[] = [
        {
          policy_statement_id: 's1',
          policy_id: '1',
          effect: PolicyEffect.ALLOW,
          submission_feature_urn: 'urn:*:*:*'
        }
      ];

      const getTeamPoliciesStub = sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves([
        {
          team_policy_id: 'tp1',
          team_id: 'team-1',
          policy_id: '1',
          team_name: 'Team 1',
          policy_name: 'Policy 1'
        }
      ]);
      const getStatementsStub = sinon
        .stub(PolicyStatementRepository.prototype, 'getPolicyStatements')
        .resolves(mockStatements);
      const deletePolicyStub = sinon.stub(PolicyRepository.prototype, 'deletePolicy').resolves();
      const cleanupStub = sinon.stub(SecurityScopeService.prototype, 'cleanupScopesForDeletedStatements').resolves();

      await policyService.deletePolicy('1');

      // Verify teams and statements fetched before delete
      expect(getTeamPoliciesStub).to.have.been.calledWith({ policyIds: ['1'] });
      expect(getStatementsStub).to.have.been.calledWith('1');
      expect(deletePolicyStub).to.have.been.calledWith('1');

      // Verify cleanup called with correct IDs
      expect(cleanupStub).to.have.been.calledOnce;
      expect(cleanupStub).to.have.been.calledWith(['s1'], ['team-1']);
    });

    it('should skip cleanup when policy has no statements', async () => {
      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves([]);
      sinon.stub(PolicyStatementRepository.prototype, 'getPolicyStatements').resolves([]);
      sinon.stub(PolicyRepository.prototype, 'deletePolicy').resolves();
      const cleanupStub = sinon.stub(SecurityScopeService.prototype, 'cleanupScopesForDeletedStatements').resolves();

      await policyService.deletePolicy('1');

      expect(cleanupStub).to.not.have.been.called;
    });
  });

  describe('getPoliciesWithStatements', () => {
    it('should call repository.getPolicies and return policies with statements', async () => {
      const mockPolicies: Policy[] = [
        { policy_id: '1', name: 'Policy 1', description: 'Desc 1', status: 'approved' },
        { policy_id: '2', name: 'Policy 2', description: 'Desc 2', status: 'approved' }
      ];
      const mockStatements: PolicyStatement[] = [
        { policy_statement_id: 's1', policy_id: '1', effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:*:*:*' }
      ];
      const mockConditions: PolicyStatementCondition[] = [
        {
          policy_statement_condition_id: 'c1',
          policy_statement_id: 's1',
          operator: PolicyConditionOperator.STRING_EQUALS,
          key: 'test',
          value: 'value'
        }
      ];

      const getPoliciesStub = sinon.stub(PolicyRepository.prototype, 'getPolicies').resolves(mockPolicies);
      const getPolicyStatementsStub = sinon
        .stub(PolicyStatementRepository.prototype, 'getPolicyStatements')
        .resolves(mockStatements);
      const getConditionsStub = sinon
        .stub(PolicyStatementConditionRepository.prototype, 'getPolicyStatementConditions')
        .resolves(mockConditions);

      const result = await policyService.getPoliciesWithStatements(undefined, { page: 1, limit: 10 });

      expect(getPoliciesStub).to.have.been.calledWith(undefined, { page: 1, limit: 10 });
      expect(getPolicyStatementsStub).to.have.been.called;
      expect(getConditionsStub).to.have.been.called;
      expect(result).to.eql([
        { ...mockPolicies[0], statements: [{ ...mockStatements[0], conditions: mockConditions }] },
        { ...mockPolicies[1], statements: [{ ...mockStatements[0], conditions: mockConditions }] }
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
          submission_feature_urn: 'urn:*:telemetry:*'
        }
      ];
      const mockConditions: PolicyStatementCondition[] = [];

      const getPolicyStub = sinon.stub(PolicyRepository.prototype, 'getPolicy').resolves(mockPolicy);
      const getPolicyStatementsStub = sinon
        .stub(PolicyStatementRepository.prototype, 'getPolicyStatements')
        .resolves(mockStatements);
      const getConditionsStub = sinon
        .stub(PolicyStatementConditionRepository.prototype, 'getPolicyStatementConditions')
        .resolves(mockConditions);

      const result = await policyService.getPolicyWithStatements('1');

      expect(getPolicyStub).to.have.been.calledWith('1');
      expect(getPolicyStatementsStub).to.have.been.calledWith('1');
      expect(getConditionsStub).to.have.been.calledWith('s1');
      expect(result).to.eql({
        ...mockPolicy,
        statements: [{ ...mockStatements[0], conditions: [] }]
      });
    });
  });

  describe('getStatementsWithConditions', () => {
    it('should call repository.getPolicyStatements and return statements with conditions', async () => {
      const mockStatements: PolicyStatement[] = [
        { policy_statement_id: 's1', policy_id: '1', effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:*:*:*' },
        {
          policy_statement_id: 's2',
          policy_id: '1',
          effect: PolicyEffect.DENY,
          submission_feature_urn: 'urn:*:sensitive:*'
        }
      ];
      const mockConditions: PolicyStatementCondition[] = [
        {
          policy_statement_condition_id: 'c1',
          policy_statement_id: 's1',
          operator: PolicyConditionOperator.STRING_EQUALS,
          key: 'key',
          value: 'val'
        }
      ];

      const getPolicyStatementsStub = sinon
        .stub(PolicyStatementRepository.prototype, 'getPolicyStatements')
        .resolves(mockStatements);
      const getConditionsStub = sinon
        .stub(PolicyStatementConditionRepository.prototype, 'getPolicyStatementConditions')
        .resolves(mockConditions);

      const result = await policyService.getStatementsWithConditions('1');

      expect(getPolicyStatementsStub).to.have.been.calledWith('1');
      expect(getConditionsStub).to.have.been.calledTwice;
      expect(result).to.eql([
        { ...mockStatements[0], conditions: mockConditions },
        { ...mockStatements[1], conditions: mockConditions }
      ]);
    });
  });

  describe('createPolicyWithStatements', () => {
    it('should create policy, statements, and scopes for each statement', async () => {
      const mockPolicy: Policy = { policy_id: '1', name: 'New Policy', description: 'Desc', status: 'requested' };
      const mockStatement: PolicyStatement = {
        policy_statement_id: 's1',
        policy_id: '1',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:*:telemetry:*'
      };
      const mockCondition: PolicyStatementCondition = {
        policy_statement_condition_id: 'c1',
        policy_statement_id: 's1',
        operator: PolicyConditionOperator.STRING_EQUALS,
        key: 'region',
        value: 'north'
      };

      const insertPolicyStub = sinon.stub(PolicyRepository.prototype, 'insertPolicy').resolves(mockPolicy);
      const insertStatementStub = sinon
        .stub(PolicyStatementRepository.prototype, 'insertPolicyStatement')
        .resolves(mockStatement);
      const insertConditionStub = sinon
        .stub(PolicyStatementConditionRepository.prototype, 'insertPolicyStatementCondition')
        .resolves(mockCondition);
      const createScopeStub = sinon
        .stub(SecurityScopeService.prototype, 'createScopeForPolicyStatement')
        .resolves('scope-1');

      const result = await policyService.createPolicyWithStatements(
        { name: 'New Policy', description: 'Desc', status: 'requested' } as CreatePolicy,
        [
          {
            effect: PolicyEffect.ALLOW,
            submission_feature_urn: 'urn:*:telemetry:*',
            conditions: [{ operator: PolicyConditionOperator.STRING_EQUALS, key: 'region', value: 'north' }]
          }
        ]
      );

      expect(insertPolicyStub).to.have.been.calledWith({
        name: 'New Policy',
        description: 'Desc',
        status: 'requested'
      });
      expect(insertStatementStub).to.have.been.calledOnce;
      expect(insertConditionStub).to.have.been.calledOnce;
      expect(createScopeStub).to.have.been.calledOnce;
      expect(createScopeStub).to.have.been.calledWith('s1', 'urn:*:telemetry:*');
      expect(result).to.eql({
        ...mockPolicy,
        statements: [{ ...mockStatement, conditions: [mockCondition] }]
      });
    });

    it('should not call createScopeForPolicyStatement when no statements provided', async () => {
      const mockPolicy: Policy = {
        policy_id: '1',
        name: 'Empty Policy',
        description: 'No statements',
        status: 'requested'
      };
      sinon.stub(PolicyRepository.prototype, 'insertPolicy').resolves(mockPolicy);
      const createScopeStub = sinon
        .stub(SecurityScopeService.prototype, 'createScopeForPolicyStatement')
        .resolves('scope-1');

      const result = await policyService.createPolicyWithStatements(
        { name: 'Empty Policy', description: 'No statements', status: 'requested' } as CreatePolicy,
        []
      );

      expect(createScopeStub).to.not.have.been.called;
      expect(result).to.eql({ ...mockPolicy, statements: [] });
    });

    it('should create scopes for multiple statements', async () => {
      const mockPolicy: Policy = { policy_id: '1', name: 'Multi Policy', description: 'Desc', status: 'requested' };
      const mockStatement1: PolicyStatement = {
        policy_statement_id: 's1',
        policy_id: '1',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:*:telemetry:*'
      };
      const mockStatement2: PolicyStatement = {
        policy_statement_id: 's2',
        policy_id: '1',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:10:*:*'
      };

      sinon.stub(PolicyRepository.prototype, 'insertPolicy').resolves(mockPolicy);
      const insertStatementStub = sinon.stub(PolicyStatementRepository.prototype, 'insertPolicyStatement');
      insertStatementStub.onCall(0).resolves(mockStatement1);
      insertStatementStub.onCall(1).resolves(mockStatement2);
      sinon.stub(PolicyStatementConditionRepository.prototype, 'insertPolicyStatementCondition');
      const createScopeStub = sinon
        .stub(SecurityScopeService.prototype, 'createScopeForPolicyStatement')
        .resolves('scope-1');

      await policyService.createPolicyWithStatements({ name: 'Multi Policy', description: 'Desc' } as CreatePolicy, [
        { effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:*:telemetry:*' },
        { effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:10:*:*' }
      ]);

      expect(createScopeStub).to.have.been.calledTwice;
      expect(createScopeStub.firstCall).to.have.been.calledWith('s1', 'urn:*:telemetry:*');
      expect(createScopeStub.secondCall).to.have.been.calledWith('s2', 'urn:10:*:*');
    });
  });

  describe('updatePolicyWithStatements', () => {
    it('should clean up old scope mappings, create new scopes, and rebuild affected teams', async () => {
      const mockPolicy: Policy = {
        policy_id: '1',
        name: 'Updated Policy',
        description: 'Updated',
        status: 'requested'
      };
      const existingStatements: PolicyStatement[] = [
        {
          policy_statement_id: 'old-s1',
          policy_id: '1',
          effect: PolicyEffect.DENY,
          submission_feature_urn: 'urn:old:*:*'
        }
      ];
      const newStatement: PolicyStatement = {
        policy_statement_id: 'new-s1',
        policy_id: '1',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:*:telemetry:*'
      };

      sinon.stub(PolicyRepository.prototype, 'updatePolicy').resolves(mockPolicy);
      sinon.stub(PolicyStatementRepository.prototype, 'getPolicyStatements').resolves(existingStatements);
      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves([
        {
          team_policy_id: 'tp1',
          team_id: 'team-1',
          policy_id: '1',
          team_name: 'Team 1',
          policy_name: 'Policy 1'
        }
      ]);
      sinon.stub(PolicyStatementRepository.prototype, 'deletePolicyStatement').resolves();
      sinon.stub(PolicyStatementRepository.prototype, 'insertPolicyStatement').resolves(newStatement);
      const createScopeStub = sinon
        .stub(SecurityScopeService.prototype, 'createScopeForPolicyStatement')
        .resolves('scope-1');
      const cleanupStub = sinon.stub(SecurityScopeService.prototype, 'cleanupScopesForDeletedStatements').resolves();

      const result = await policyService.updatePolicyWithStatements(
        '1',
        { name: 'Updated Policy', description: 'Updated' } as UpdatePolicy,
        [{ effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:*:telemetry:*' }]
      );

      expect(createScopeStub).to.have.been.calledOnce;
      expect(createScopeStub).to.have.been.calledWith('new-s1', 'urn:*:telemetry:*');
      expect(cleanupStub).to.have.been.calledOnce;
      expect(cleanupStub).to.have.been.calledWith(['old-s1'], ['team-1']);
      expect(result).to.eql({
        ...mockPolicy,
        statements: [{ ...newStatement, conditions: [] }]
      });
    });

    it('should clean up old scope mappings and skip scope creation when updating with empty statements', async () => {
      const mockPolicy: Policy = { policy_id: '1', name: 'Policy', description: 'Desc', status: 'requested' };
      const existingStatements: PolicyStatement[] = [
        { policy_statement_id: 's1', policy_id: '1', effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:*:*:*' },
        { policy_statement_id: 's2', policy_id: '1', effect: PolicyEffect.DENY, submission_feature_urn: 'urn:*:*:*' }
      ];

      sinon.stub(PolicyRepository.prototype, 'updatePolicy').resolves(mockPolicy);
      sinon.stub(PolicyStatementRepository.prototype, 'getPolicyStatements').resolves(existingStatements);
      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves([]);
      sinon.stub(PolicyStatementRepository.prototype, 'deletePolicyStatement').resolves();
      const createScopeStub = sinon
        .stub(SecurityScopeService.prototype, 'createScopeForPolicyStatement')
        .resolves('scope-1');
      const cleanupStub = sinon.stub(SecurityScopeService.prototype, 'cleanupScopesForDeletedStatements').resolves();

      const result = await policyService.updatePolicyWithStatements(
        '1',
        { name: 'Policy', description: 'Desc' } as UpdatePolicy,
        []
      );

      expect(createScopeStub).to.not.have.been.called;
      expect(cleanupStub).to.have.been.calledOnce;
      expect(cleanupStub).to.have.been.calledWith(['s1', 's2'], []);
      expect(result).to.eql({ ...mockPolicy, statements: [] });
    });
  });
});
