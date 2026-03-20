import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiNotFoundError } from '../../errors/api-error';
import { FeaturePropertyCode } from '../../models/feature-property';
import {
  CreatePolicyStatementCondition,
  PolicyConditionOperator,
  PolicyStatementCondition
} from '../../models/policy-statement-condition';
import { PolicyStatementConditionRepository } from '../../repositories/authorization/policy-statement-condition-repository';
import { CodeRepository } from '../../repositories/code-repository';
import { getMockDBConnection } from '../../__mocks__/db';
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
      const featureProperty: FeaturePropertyCode = {
        feature_property_id: 1,
        feature_property_name: 'key',
        feature_property_display_name: 'Key',
        feature_property_type_id: 1,
        feature_property_type_name: 'string'
      };
      const mockCondition: PolicyStatementCondition = {
        policy_statement_condition_id: '1',
        policy_statement_id: 'policy-1',
        key: 'key',
        operator: PolicyConditionOperator.STRING_EQUALS,
        value: 'some-value'
      };
      const featurePropertyStub = sinon
        .stub(CodeRepository.prototype, 'getFeaturePropertyByName')
        .resolves(featureProperty);
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
      expect(featurePropertyStub).to.have.been.calledOnceWith('key');
      expect(result).to.eql(mockCondition);
    });

    it('should bubble ApiNotFoundError when condition key is unknown', async () => {
      sinon
        .stub(CodeRepository.prototype, 'getFeaturePropertyByName')
        .rejects(new ApiNotFoundError('Feature property not found'));
      const insertStub = sinon.stub(PolicyStatementConditionRepository.prototype, 'insertPolicyStatementCondition');

      try {
        await service.createPolicyStatementCondition({
          policy_statement_id: 'policy-1',
          key: 'unknown_key',
          operator: PolicyConditionOperator.STRING_EQUALS,
          value: 'some-value'
        } as CreatePolicyStatementCondition);
        expect.fail('Expected createPolicyStatementCondition to throw');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }

      expect(insertStub).not.to.have.been.called;
    });

    it('should throw HTTP400 when condition value shape does not match operator', async () => {
      const featureProperty: FeaturePropertyCode = {
        feature_property_id: 1,
        feature_property_name: 'key',
        feature_property_display_name: 'Key',
        feature_property_type_id: 1,
        feature_property_type_name: 'string'
      };
      sinon.stub(CodeRepository.prototype, 'getFeaturePropertyByName').resolves(featureProperty);
      const insertStub = sinon.stub(PolicyStatementConditionRepository.prototype, 'insertPolicyStatementCondition');

      try {
        await service.createPolicyStatementCondition({
          policy_statement_id: 'policy-1',
          key: 'key',
          operator: PolicyConditionOperator.STRING_EQUALS,
          value: 42
        } as CreatePolicyStatementCondition);
        expect.fail('Expected createPolicyStatementCondition to throw');
      } catch (error) {
        expect(error).to.have.property('status', 400);
      }

      expect(insertStub).not.to.have.been.called;
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
