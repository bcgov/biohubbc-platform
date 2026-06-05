import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import {
  CreatePolicyStatementCondition,
  PolicyConditionOperator,
  PolicyStatementCondition
} from '../../models/policy-statement-condition';
import { PolicyStatementConditionRepository } from '../../repositories/authorization/policy-statement-condition-repository';
import { PolicyStatementConditionService } from './policy-statement-condition-service';

chai.use(sinonChai);

describe('PolicyStatementConditionService', () => {
  let mockDBConnection: any;
  let service: PolicyStatementConditionService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new PolicyStatementConditionService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createPolicyStatementCondition', () => {
    it('should call repository.insertPolicyStatementCondition and return the created record', async () => {
      const mockCondition: PolicyStatementCondition = {
        policy_statement_condition_id: '1',
        policy_statement_id: 'policy-1',
        key: 'key',
        operator: PolicyConditionOperator.STRING_EQUALS,
        value: 'some-value'
      };
      const stub = sinon
        .stub(PolicyStatementConditionRepository.prototype, 'insertPolicyStatementCondition')
        .resolves(mockCondition);

      const result = await service.createPolicyStatementCondition({
        policy_statement_id: 'policy-1',
        key: 'key',
        operator: PolicyConditionOperator.STRING_EQUALS,
        value: 'some-value'
      } as CreatePolicyStatementCondition);

      expect(stub).to.have.been.calledWith({
        policy_statement_id: 'policy-1',
        key: 'key',
        operator: PolicyConditionOperator.STRING_EQUALS,
        value: 'some-value'
      });
      expect(result).to.eql(mockCondition);
    });
  });

  describe('getPolicyStatementCondition', () => {
    it('should call repository.getPolicyStatementCondition and return the record', async () => {
      const mockCondition: PolicyStatementCondition = {
        policy_statement_condition_id: '1',
        policy_statement_id: 'policy-1',
        key: 'key',
        operator: PolicyConditionOperator.STRING_EQUALS,
        value: 'some-value'
      };
      const stub = sinon
        .stub(PolicyStatementConditionRepository.prototype, 'getPolicyStatementCondition')
        .resolves(mockCondition);

      const result = await service.getPolicyStatementCondition('1');

      expect(stub).to.have.been.calledWith('1');
      expect(result).to.eql(mockCondition);
    });
  });

  describe('getPolicyStatementConditions', () => {
    it('should call repository.getPolicyStatementConditions and return all conditions for a policy statement', async () => {
      const mockConditions: PolicyStatementCondition[] = [
        {
          policy_statement_condition_id: '1',
          policy_statement_id: 'policy-1',
          key: 'key1',
          operator: PolicyConditionOperator.STRING_EQUALS,
          value: 'value1'
        },
        {
          policy_statement_condition_id: '2',
          policy_statement_id: 'policy-1',
          key: 'key2',
          operator: PolicyConditionOperator.STRING_EQUALS,
          value: 'value2'
        }
      ];

      const stub = sinon
        .stub(PolicyStatementConditionRepository.prototype, 'getPolicyStatementConditions')
        .resolves(mockConditions);

      const result = await service.getPolicyStatementConditions('policy-1');

      expect(stub).to.have.been.calledWith('policy-1');
      expect(result).to.eql(mockConditions);
    });
  });

  describe('deletePolicyStatementCondition', () => {
    it('should call repository.deletePolicyStatementCondition', async () => {
      const stub = sinon
        .stub(PolicyStatementConditionRepository.prototype, 'deletePolicyStatementCondition')
        .resolves();

      await service.deletePolicyStatementCondition('1');

      expect(stub).to.have.been.calledWith('1');
    });
  });
});
