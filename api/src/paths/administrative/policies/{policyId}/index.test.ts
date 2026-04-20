import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { deletePolicy, getPolicy, updatePolicy } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { HTTPError } from '../../../../errors/http-error';
import { PolicyEffect } from '../../../../models/policy-statement';
import { PolicyService } from '../../../../services/access-policy/policy-service';
import { PolicyWithStatements } from '../../../../services/access-policy/policy-service.interface';

chai.use(sinonChai);

describe('paths/administrative/policies/{policyId}/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getPolicy', () => {
    it('should re-throw any error that is thrown', async () => {
      const mockDBConnection = getMockDBConnection({
        open: () => {
          throw new Error('test error');
        }
      });

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      const requestHandler = getPolicy();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).message).to.equal('test error');
      }
    });

    it('should call service.getPolicyWithStatements and return the policy', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockPolicy: PolicyWithStatements = {
        policy_id: '123',
        name: 'Test Policy',
        description: 'Test description',
        status: 'approved',
        statements: [
          {
            policy_statement_id: 's1',
            policy_id: '123',
            effect: PolicyEffect.ALLOW,
            submission_feature_urn: 'urn:*:*:*',
            conditions: []
          }
        ]
      };

      const getPolicyWithStatementsStub = sinon
        .stub(PolicyService.prototype, 'getPolicyWithStatements')
        .resolves(mockPolicy);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        policyId: '123'
      };

      const requestHandler = getPolicy();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getPolicyWithStatementsStub).to.have.been.calledOnceWith('123');
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(mockPolicy);
    });
  });

  describe('updatePolicy', () => {
    it('should re-throw any error that is thrown', async () => {
      const mockDBConnection = getMockDBConnection({
        open: () => {
          throw new Error('test error');
        }
      });

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      const requestHandler = updatePolicy();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).message).to.equal('test error');
      }
    });

    it('should call service.updatePolicyWithStatements and return the updated policy', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockUpdatedPolicy: PolicyWithStatements = {
        policy_id: '123',
        name: 'Updated Policy',
        description: 'Updated description',
        status: 'approved',
        statements: [
          {
            policy_statement_id: 's1',
            policy_id: '123',
            effect: PolicyEffect.DENY,
            submission_feature_urn: 'urn:*:telemetry:*',
            conditions: []
          }
        ]
      };

      const updatePolicyWithStatementsStub = sinon
        .stub(PolicyService.prototype, 'updatePolicyWithStatements')
        .resolves(mockUpdatedPolicy);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        policyId: '123'
      };
      mockReq.body = {
        name: 'Updated Policy',
        description: 'Updated description',
        status: 'reviewed',
        statements: [
          {
            effect: PolicyEffect.DENY,
            submission_feature_urn: 'urn:*:telemetry:*'
          }
        ]
      };

      const requestHandler = updatePolicy();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(updatePolicyWithStatementsStub).to.have.been.calledOnceWith(
        '123',
        { name: 'Updated Policy', description: 'Updated description', status: 'reviewed' },
        [{ effect: PolicyEffect.DENY, submission_feature_urn: 'urn:*:telemetry:*' }]
      );
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(mockUpdatedPolicy);
    });

    it('should call service.updatePolicyWithStatements with provided empty statements array', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockUpdatedPolicy: PolicyWithStatements = {
        policy_id: '123',
        name: 'Policy No Statements',
        description: null,
        status: 'approved',
        statements: []
      };

      const updatePolicyWithStatementsStub = sinon
        .stub(PolicyService.prototype, 'updatePolicyWithStatements')
        .resolves(mockUpdatedPolicy);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        policyId: '123'
      };
      mockReq.body = {
        name: 'Policy No Statements',
        statements: []
      };

      const requestHandler = updatePolicy();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(updatePolicyWithStatementsStub).to.have.been.calledOnceWith(
        '123',
        { name: 'Policy No Statements', description: undefined, status: undefined },
        []
      );
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(mockUpdatedPolicy);
    });
  });

  describe('deletePolicy', () => {
    it('should re-throw any error that is thrown', async () => {
      const mockDBConnection = getMockDBConnection({
        open: () => {
          throw new Error('test error');
        }
      });

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      const requestHandler = deletePolicy();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).message).to.equal('test error');
      }
    });

    it('should call service.deletePolicy and return 204', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const deletePolicyStub = sinon.stub(PolicyService.prototype, 'deletePolicy').resolves();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        policyId: '123'
      };

      const requestHandler = deletePolicy();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(deletePolicyStub).to.have.been.calledOnceWith('123');
      expect(mockRes.statusValue).to.equal(204);
    });
  });
});
