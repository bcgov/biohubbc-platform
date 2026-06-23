import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createPolicyExpression, getPolicyExpressions } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { HTTPError } from '../../../../../errors/http-error';
import { PolicyService } from '../../../../../services/access-policy/policy-service';
import { PolicyExpressionWithExpression } from '../../../../../services/access-policy/policy-service.interface';

chai.use(sinonChai);

describe('paths/administrative/policies/{policyId}/expressions/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getPolicyExpressions', () => {
    it('should call service list/count methods and return paginated policy expressions', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const expression = {
        type: 'expression' as const,
        operator: 'AND' as const,
        clauses: [
          {
            type: 'predicate' as const,
            feature_property_id: 1,
            feature_type_property_id: null,
            operator: 'Equals' as const,
            value: 'sensitive'
          }
        ]
      };
      const mockPolicyExpression: PolicyExpressionWithExpression = {
        policy_expression_id: 'pe-1',
        policy_id: 'policy-1',
        expression_id: 'expr-1',
        name: 'Sensitive species',
        description: 'Filters sensitive species observations',
        expression
      };
      const getPolicyExpressionsStub = sinon
        .stub(PolicyService.prototype, 'getPolicyExpressionsWithExpression')
        .resolves([mockPolicyExpression]);
      const getPolicyExpressionsCountStub = sinon
        .stub(PolicyService.prototype, 'getPolicyExpressionsCount')
        .resolves(1);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        policyId: 'policy-1'
      };
      mockReq.query = {
        page: '2',
        limit: '10',
        sort: 'name',
        order: 'asc'
      };

      const requestHandler = getPolicyExpressions();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getPolicyExpressionsStub).to.have.been.calledOnceWith('policy-1', {
        page: 2,
        limit: 10,
        sort: 'name',
        order: 'asc'
      });
      expect(getPolicyExpressionsCountStub).to.have.been.calledOnceWith('policy-1');
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({
        expressions: [mockPolicyExpression],
        pagination: {
          total: 1,
          per_page: 10,
          current_page: 2,
          last_page: 1,
          sort: 'name',
          order: 'asc'
        }
      });
    });
  });

  describe('createPolicyExpression', () => {
    it('should re-throw any error that is thrown', async () => {
      const mockDBConnection = getMockDBConnection({
        open: () => {
          throw new Error('test error');
        }
      });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      const requestHandler = createPolicyExpression();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).message).to.equal('test error');
      }
    });

    it('should call service.createPolicyExpression and return the created policy expression', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const expression = {
        type: 'expression' as const,
        operator: 'AND' as const,
        clauses: [
          {
            type: 'predicate' as const,
            feature_property_id: 1,
            feature_type_property_id: null,
            operator: 'Equals' as const,
            value: 'sensitive'
          }
        ]
      };
      const mockPolicyExpression: PolicyExpressionWithExpression = {
        policy_expression_id: 'pe-1',
        policy_id: 'policy-1',
        expression_id: 'expr-1',
        name: 'Sensitive species',
        description: 'Filters sensitive species observations',
        expression
      };
      const createPolicyExpressionStub = sinon
        .stub(PolicyService.prototype, 'createPolicyExpression')
        .resolves(mockPolicyExpression);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        policyId: 'policy-1'
      };
      mockReq.body = {
        name: 'Sensitive species',
        description: 'Filters sensitive species observations',
        expression
      };

      const requestHandler = createPolicyExpression();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(createPolicyExpressionStub).to.have.been.calledOnceWith('policy-1', {
        name: 'Sensitive species',
        description: 'Filters sensitive species observations',
        expression
      });
      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.eql(mockPolicyExpression);
    });
  });
});
