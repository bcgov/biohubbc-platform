import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { CreatePolicy, Policy, UpdatePolicy } from '../../models/policy';
import { PolicyEffect, PolicyStatement } from '../../models/policy-statement';
import { PolicyConditionOperator, PolicyStatementCondition } from '../../models/policy-statement-condition';
import { PolicyRepository } from '../../repositories/authorization/policy-repository';
import { PolicyStatementConditionRepository } from '../../repositories/authorization/policy-statement-condition-repository';
import { PolicyStatementRepository } from '../../repositories/authorization/policy-statement-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { PolicyService } from './policy-service';
import { TeamFeatureService } from './team-feature-service';

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

  describe('createPolicy', () => {
    it('should call repository.insertPolicy and return the created policy', async () => {
      const mockPolicy: Policy = { policy_id: '1', name: 'Test Policy', description: 'Test' };
      const insertPolicyStub = sinon.stub(PolicyRepository.prototype, 'insertPolicy').resolves(mockPolicy);

      const result = await policyService.createPolicy({ name: 'Test Policy', description: 'Test' } as CreatePolicy);

      expect(insertPolicyStub).to.have.been.calledWith({ name: 'Test Policy', description: 'Test' });
      expect(result).to.eql(mockPolicy);
    });
  });

  describe('getPolicy', () => {
    it('should call repository.getPolicy and return a policy', async () => {
      const mockPolicy: Policy = { policy_id: '1', name: 'Test Policy', description: 'Test' };
      const getPolicyStub = sinon.stub(PolicyRepository.prototype, 'getPolicy').resolves(mockPolicy);

      const result = await policyService.getPolicy('1');

      expect(getPolicyStub).to.have.been.calledWith('1');
      expect(result).to.eql(mockPolicy);
    });
  });

  describe('getPolicies', () => {
    it('should call repository.getPolicy and return a policy', async () => {
      const mockPolicy: Policy[] = [{ policy_id: '1', name: 'Test Policy', description: 'Test' }];
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
        { policy_id: '1', name: 'Policy 1', description: 'Desc 1' },
        { policy_id: '2', name: 'Policy 2', description: 'Desc 2' }
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
        description: 'Updated desc'
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
    it('should call repository.deletePolicy', async () => {
      sinon.stub(TeamFeatureService.prototype, 'getTeamIdsForPolicy').resolves([]);
      const stub = sinon.stub(PolicyRepository.prototype, 'deletePolicy').resolves();
      sinon.stub(TeamFeatureService.prototype, 'refreshCacheForTeam').resolves();

      await policyService.deletePolicy('1');

      expect(stub).to.have.been.calledWith('1');
    });

    it('fetches team IDs before delete, then refreshes cache for each team', async () => {
      const policyId = '11111111-1111-1111-1111-111111111111';
      const teamIds = ['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'];
      const callOrder: string[] = [];

      sinon.stub(TeamFeatureService.prototype, 'getTeamIdsForPolicy').callsFake(async () => {
        callOrder.push('getTeamIds');
        return teamIds;
      });
      sinon.stub(PolicyRepository.prototype, 'deletePolicy').callsFake(async () => {
        callOrder.push('delete');
      });
      sinon.stub(TeamFeatureService.prototype, 'refreshCacheForTeam').callsFake(async () => {
        callOrder.push('refresh');
      });

      await policyService.deletePolicy(policyId);

      // Verify ordering: fetch teams → delete policy → refresh each team
      expect(callOrder).to.eql(['getTeamIds', 'delete', 'refresh', 'refresh']);
    });

    it('does not call refreshCacheForTeam when policy has no teams', async () => {
      sinon.stub(TeamFeatureService.prototype, 'getTeamIdsForPolicy').resolves([]);
      sinon.stub(PolicyRepository.prototype, 'deletePolicy').resolves();
      const refreshStub = sinon.stub(TeamFeatureService.prototype, 'refreshCacheForTeam').resolves();

      await policyService.deletePolicy('1');

      expect(refreshStub).to.not.have.been.called;
    });
  });

  describe('getPoliciesWithStatements', () => {
    it('should call repository.getPolicies and return policies with statements', async () => {
      const mockPolicies: Policy[] = [
        { policy_id: '1', name: 'Policy 1', description: 'Desc 1' },
        { policy_id: '2', name: 'Policy 2', description: 'Desc 2' }
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
      const mockPolicy: Policy = { policy_id: '1', name: 'Test Policy', description: 'Test' };
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
    it('should call repository.insertPolicy and return created policy with statements', async () => {
      const mockPolicy: Policy = { policy_id: '1', name: 'New Policy', description: 'Desc' };
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
      sinon.stub(TeamFeatureService.prototype, 'refreshCacheForPolicy').resolves();

      const result = await policyService.createPolicyWithStatements(
        { name: 'New Policy', description: 'Desc' } as CreatePolicy,
        [
          {
            effect: PolicyEffect.ALLOW,
            submission_feature_urn: 'urn:*:telemetry:*',
            conditions: [{ operator: PolicyConditionOperator.STRING_EQUALS, key: 'region', value: 'north' }]
          }
        ]
      );

      expect(insertPolicyStub).to.have.been.calledWith({ name: 'New Policy', description: 'Desc' });
      expect(insertStatementStub).to.have.been.calledOnce;
      expect(insertConditionStub).to.have.been.calledOnce;
      expect(result).to.eql({
        ...mockPolicy,
        statements: [{ ...mockStatement, conditions: [mockCondition] }]
      });
    });

    it('should call repository.insertPolicy and return policy with empty statements when none provided', async () => {
      const mockPolicy: Policy = { policy_id: '1', name: 'Empty Policy', description: 'No statements' };
      const insertPolicyStub = sinon.stub(PolicyRepository.prototype, 'insertPolicy').resolves(mockPolicy);
      sinon.stub(TeamFeatureService.prototype, 'refreshCacheForPolicy').resolves();

      const result = await policyService.createPolicyWithStatements(
        { name: 'Empty Policy', description: 'No statements' } as CreatePolicy,
        []
      );

      expect(insertPolicyStub).to.have.been.calledWith({ name: 'Empty Policy', description: 'No statements' });
      expect(result).to.eql({ ...mockPolicy, statements: [] });
    });

    it('refreshes team_feature cache with the correct policy ID', async () => {
      const mockPolicy: Policy = { policy_id: '1', name: 'Policy', description: null };

      sinon.stub(PolicyRepository.prototype, 'insertPolicy').resolves(mockPolicy);
      const refreshStub = sinon.stub(TeamFeatureService.prototype, 'refreshCacheForPolicy').resolves();

      await policyService.createPolicyWithStatements({ name: 'Policy' } as CreatePolicy, []);

      expect(refreshStub).to.have.been.calledOnceWith('1');
    });
  });

  describe('updatePolicyWithStatements', () => {
    it('should call repository.updatePolicy, delete old statements, and return updated policy', async () => {
      const mockPolicy: Policy = { policy_id: '1', name: 'Updated Policy', description: 'Updated' };
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

      const updatePolicyStub = sinon.stub(PolicyRepository.prototype, 'updatePolicy').resolves(mockPolicy);
      const getPolicyStatementsStub = sinon
        .stub(PolicyStatementRepository.prototype, 'getPolicyStatements')
        .resolves(existingStatements);
      const deleteStatementStub = sinon.stub(PolicyStatementRepository.prototype, 'deletePolicyStatement').resolves();
      const insertStatementStub = sinon
        .stub(PolicyStatementRepository.prototype, 'insertPolicyStatement')
        .resolves(newStatement);
      sinon.stub(TeamFeatureService.prototype, 'refreshCacheForPolicy').resolves();

      const result = await policyService.updatePolicyWithStatements(
        '1',
        { name: 'Updated Policy', description: 'Updated' } as UpdatePolicy,
        [{ effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:*:telemetry:*' }]
      );

      expect(updatePolicyStub).to.have.been.calledWith('1', { name: 'Updated Policy', description: 'Updated' });
      expect(getPolicyStatementsStub).to.have.been.calledWith('1');
      expect(deleteStatementStub).to.have.been.calledWith('old-s1');
      expect(insertStatementStub).to.have.been.calledOnce;
      expect(result).to.eql({
        ...mockPolicy,
        statements: [{ ...newStatement, conditions: [] }]
      });
    });

    it('should call repository.updatePolicy and delete all statements when updating with empty array', async () => {
      const mockPolicy: Policy = { policy_id: '1', name: 'Policy', description: 'Desc' };
      const existingStatements: PolicyStatement[] = [
        { policy_statement_id: 's1', policy_id: '1', effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:*:*:*' },
        { policy_statement_id: 's2', policy_id: '1', effect: PolicyEffect.DENY, submission_feature_urn: 'urn:*:*:*' }
      ];

      const updatePolicyStub = sinon.stub(PolicyRepository.prototype, 'updatePolicy').resolves(mockPolicy);
      const getPolicyStatementsStub = sinon
        .stub(PolicyStatementRepository.prototype, 'getPolicyStatements')
        .resolves(existingStatements);
      const deleteStub = sinon.stub(PolicyStatementRepository.prototype, 'deletePolicyStatement').resolves();
      sinon.stub(TeamFeatureService.prototype, 'refreshCacheForPolicy').resolves();

      const result = await policyService.updatePolicyWithStatements(
        '1',
        { name: 'Policy', description: 'Desc' } as UpdatePolicy,
        []
      );

      expect(updatePolicyStub).to.have.been.calledWith('1', { name: 'Policy', description: 'Desc' });
      expect(getPolicyStatementsStub).to.have.been.calledWith('1');
      expect(deleteStub).to.have.been.calledTwice;
      expect(result).to.eql({ ...mockPolicy, statements: [] });
    });

    it('refreshes team_feature cache with the correct policy ID', async () => {
      const mockPolicy: Policy = { policy_id: '1', name: 'Policy', description: null };

      sinon.stub(PolicyRepository.prototype, 'updatePolicy').resolves(mockPolicy);
      sinon.stub(PolicyStatementRepository.prototype, 'getPolicyStatements').resolves([]);
      const refreshStub = sinon.stub(TeamFeatureService.prototype, 'refreshCacheForPolicy').resolves();

      await policyService.updatePolicyWithStatements('1', { name: 'Policy' } as UpdatePolicy, []);

      expect(refreshStub).to.have.been.calledOnceWith('1');
    });
  });
});
