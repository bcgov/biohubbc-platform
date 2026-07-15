import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createPolicyStatement } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { HTTPError } from '../../../../../errors/http-error';
import { PolicyEffect } from '../../../../../models/policy-statement';
import { PolicyStatementService } from '../../../../../services/access-policy/policy-statement-service';

chai.use(sinonChai);

describe('paths/administrative/policies/{policyId}/statements/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createPolicyStatement', () => {
    it('should re-throw any error that is thrown', async () => {
      const mockDBConnection = getMockDBConnection({
        open: () => {
          throw new Error('test error');
        }
      });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      const requestHandler = createPolicyStatement();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).message).to.equal('test error');
      }
    });

    it('should call service.createPolicyStatement and return the created statement', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const mockStatement = {
        policy_statement_id: 's1',
        policy_id: '123',
        effect: PolicyEffect.ALLOW,
        security_scope_id: 'scope-1',
        submission_feature_urn: 'urn:*:*:*',
        policy_expression_id: null
      };

      const createPolicyStatementStub = sinon
        .stub(PolicyStatementService.prototype, 'createPolicyStatement')
        .resolves(mockStatement);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        policyId: '123'
      };
      mockReq.body = {
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:*:*:*',
        policy_expression_id: null
      };

      const requestHandler = createPolicyStatement();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(createPolicyStatementStub).to.have.been.calledOnceWith({
        policy_id: '123',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:*:*:*',
        policy_expression_id: null
      });
      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.eql(mockStatement);
    });
  });
});
