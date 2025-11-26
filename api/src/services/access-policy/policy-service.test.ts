import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { CreatePolicy, Policy, UpdatePolicy } from '../../models/policy';
import { PolicyRepository } from '../../repositories/authorization/policy-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { PolicyService } from './policy-service';

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

      expect(getPolicyStub).to.have.been.called;
      expect(result).to.eql(mockPolicy);
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

      expect(stub).to.have.been.calledWith(
        { submissionId: '123', featureTypeName: '*', submissionFeatureId: '*' },
        42
      );
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
      const stub = sinon.stub(PolicyRepository.prototype, 'deletePolicy').resolves();

      await policyService.deletePolicy('1');

      expect(stub).to.have.been.calledWith('1');
    });
  });
});
