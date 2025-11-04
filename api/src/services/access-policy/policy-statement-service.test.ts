import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  CreatePolicyStatement,
  PolicyEffect,
  PolicyStatement,
  UpdatePolicyStatement
} from '../../models/policy-statement';
import { PolicyStatementRepository } from '../../repositories/authorization/policy-statement-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { PolicyStatementService } from './policy-statement-service';

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
        submission_feature_urn: 'urn:1:dataset:1'
      };
      const stub = sinon.stub(PolicyStatementRepository.prototype, 'insertPolicyStatement').resolves(mockStatement);

      const input: CreatePolicyStatement = {
        policy_id: '22222222-2222-2222-2222-222222222222',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:1:dataset:1'
      };

      const result = await service.createPolicyStatement(input);

      expect(stub).to.have.been.calledWith(input);
      expect(result).to.eql(mockStatement);
    });
  });
  describe('getPolicyStatements', () => {
    it('should call repository.getPolicyStatements and return the records', async () => {
      const mockStatements: PolicyStatement[] = [
        {
          policy_statement_id: '11111111-1111-1111-1111-111111111111',
          policy_id: '22222222-2222-2222-2222-222222222222',
          effect: PolicyEffect.DENY,
          submission_feature_urn: 'urn:1:dataset:1'
        },
        {
          policy_statement_id: '33333333-3333-3333-3333-333333333333',
          policy_id: '22222222-2222-2222-2222-222222222222',
          effect: PolicyEffect.ALLOW,
          submission_feature_urn: 'urn:1:dataset:3'
        }
      ];

      const stub = sinon.stub(PolicyStatementRepository.prototype, 'getPolicyStatements').resolves(mockStatements);

      const result = await service.getPolicyStatements('22222222-2222-2222-2222-222222222222');

      expect(stub).to.have.been.calledWith('22222222-2222-2222-2222-222222222222');
      expect(result).to.eql(mockStatements);
    });
  });

  describe('updatePolicyStatement', () => {
    it('should call repository.updatePolicyStatement and return the updated record', async () => {
      const mockStatement: PolicyStatement = {
        policy_statement_id: '11111111-1111-1111-1111-111111111111',
        policy_id: '22222222-2222-2222-2222-222222222222',
        effect: PolicyEffect.DENY,
        submission_feature_urn: 'urn:1:dataset:1'
      };
      const stub = sinon.stub(PolicyStatementRepository.prototype, 'updatePolicyStatement').resolves(mockStatement);

      const updateData: UpdatePolicyStatement = {
        effect: PolicyEffect.DENY,
        submission_feature_urn: 'urn:1:dataset:1'
      };

      const result = await service.updatePolicyStatement('11111111-1111-1111-1111-111111111111', updateData);

      expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111', updateData);
      expect(result).to.eql(mockStatement);
    });
  });

  describe('deletePolicyStatement', () => {
    it('should call repository.deletePolicyStatement', async () => {
      const stub = sinon.stub(PolicyStatementRepository.prototype, 'deletePolicyStatement').resolves();

      await service.deletePolicyStatement('11111111-1111-1111-1111-111111111111');

      expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
    });
  });
});
