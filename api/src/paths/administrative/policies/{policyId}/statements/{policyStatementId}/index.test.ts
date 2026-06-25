import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { deletePolicyStatement, updatePolicyStatement } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import * as db from '../../../../../../database/db';
import { HTTPError } from '../../../../../../errors/http-error';
import { PolicyEffect, PolicyStatement } from '../../../../../../models/policy-statement';
import { PolicyStatementService } from '../../../../../../services/access-policy/policy-statement-service';

chai.use(sinonChai);

describe('paths/administrative/policies/{policyId}/statements/{policyStatementId}/index', () => {
  const existingStatement: PolicyStatement = {
    policy_statement_id: 's1',
    policy_id: '123',
    effect: PolicyEffect.ALLOW,
    security_scope_id: 'scope-1',
    submission_feature_urn: 'urn:*:*:*',
    policy_expression_id: null
  };

  afterEach(() => {
    sinon.restore();
  });

  describe('updatePolicyStatement', () => {
    it('should call service.updatePolicyStatement and return the updated statement', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(PolicyStatementService.prototype, 'getPolicyStatement').resolves(existingStatement);
      const updatedStatement = {
        ...existingStatement,
        effect: PolicyEffect.DENY,
        submission_feature_urn: 'urn:*:telemetry:*',
        policy_expression_id: 'pe-1'
      };
      const updatePolicyStatementStub = sinon
        .stub(PolicyStatementService.prototype, 'updatePolicyStatement')
        .resolves(updatedStatement);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        policyId: '123',
        policyStatementId: 's1'
      };
      mockReq.body = {
        effect: PolicyEffect.DENY,
        submission_feature_urn: 'urn:*:telemetry:*',
        policy_expression_id: 'pe-1'
      };

      const requestHandler = updatePolicyStatement();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(updatePolicyStatementStub).to.have.been.calledOnceWith('s1', {
        effect: PolicyEffect.DENY,
        submission_feature_urn: 'urn:*:telemetry:*',
        policy_expression_id: 'pe-1'
      });
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(updatedStatement);
    });

    it('should reject statement updates scoped to a different policy', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(PolicyStatementService.prototype, 'getPolicyStatement').resolves(existingStatement);
      const updatePolicyStatementStub = sinon.stub(PolicyStatementService.prototype, 'updatePolicyStatement');

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        policyId: 'different-policy',
        policyStatementId: 's1'
      };
      mockReq.body = {
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:*:*:*'
      };

      const requestHandler = updatePolicyStatement();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).message).to.equal('Policy statement does not belong to policy');
      }

      expect(updatePolicyStatementStub).to.not.have.been.called;
    });
  });

  describe('deletePolicyStatement', () => {
    it('should call service.deletePolicyStatement and return 204', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(PolicyStatementService.prototype, 'getPolicyStatement').resolves(existingStatement);
      const deletePolicyStatementStub = sinon
        .stub(PolicyStatementService.prototype, 'deletePolicyStatement')
        .resolves();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        policyId: '123',
        policyStatementId: 's1'
      };

      const requestHandler = deletePolicyStatement();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(deletePolicyStatementStub).to.have.been.calledOnceWith('s1');
      expect(mockRes.statusValue).to.equal(204);
    });

    it('should reject statement deletes scoped to a different policy', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(PolicyStatementService.prototype, 'getPolicyStatement').resolves(existingStatement);
      const deletePolicyStatementStub = sinon.stub(PolicyStatementService.prototype, 'deletePolicyStatement');

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        policyId: 'different-policy',
        policyStatementId: 's1'
      };

      const requestHandler = deletePolicyStatement();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).message).to.equal('Policy statement does not belong to policy');
      }

      expect(deletePolicyStatementStub).to.not.have.been.called;
    });
  });
});
