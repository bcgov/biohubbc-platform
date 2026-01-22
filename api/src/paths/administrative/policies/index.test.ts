import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createPolicy, getPolicies } from '.';
import * as db from '../../../database/db';
import { HTTPError } from '../../../errors/http-error';
import { PolicyEffect } from '../../../models/policy-statement';
import { PolicyService } from '../../../services/access-policy/policy-service';
import { PolicyWithStatements } from '../../../services/access-policy/policy-service.interface';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';

chai.use(sinonChai);

describe('paths/administrative/policies/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getPolicies', () => {
    it('should re-throw any error that is thrown', async () => {
      const mockDBConnection = getMockDBConnection({
        open: () => {
          throw new Error('test error');
        }
      });

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      const requestHandler = getPolicies();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).message).to.equal('test error');
      }
    });

    it('should call service.getPoliciesWithStatements and return policies with pagination', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockPoliciesResponse = {
        policies: [
          {
            policy_id: '1',
            name: 'Test Policy',
            description: 'Test description',
            statements: []
          }
        ],
        pagination: { total: 1, page: 0, limit: 50 }
      };

      const getPoliciesWithStatementsStub = sinon
        .stub(PolicyService.prototype, 'getPoliciesWithStatements')
        .resolves(mockPoliciesResponse);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = {
        page: '0',
        limit: '50'
      };

      const requestHandler = getPolicies();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getPoliciesWithStatementsStub).to.have.been.calledOnceWith({ page: 0, limit: 50, search: undefined });
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(mockPoliciesResponse);
    });

    it('should call service.getPoliciesWithStatements with search parameter', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockPoliciesResponse = {
        policies: [],
        pagination: { total: 0, page: 0, limit: 50 }
      };

      const getPoliciesWithStatementsStub = sinon
        .stub(PolicyService.prototype, 'getPoliciesWithStatements')
        .resolves(mockPoliciesResponse);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = {
        page: '1',
        limit: '25',
        search: 'test'
      };

      const requestHandler = getPolicies();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getPoliciesWithStatementsStub).to.have.been.calledOnceWith({ page: 1, limit: 25, search: 'test' });
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(mockPoliciesResponse);
    });
  });

  describe('createPolicy', () => {
    it('should re-throw any error that is thrown', async () => {
      const mockDBConnection = getMockDBConnection({
        open: () => {
          throw new Error('test error');
        }
      });

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      const requestHandler = createPolicy();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).message).to.equal('test error');
      }
    });

    it('should call service.createPolicyWithStatements and return created policy', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockCreatedPolicy: PolicyWithStatements = {
        policy_id: '1',
        name: 'New Policy',
        description: 'New description',
        statements: [
          {
            policy_statement_id: 's1',
            policy_id: '1',
            effect: PolicyEffect.ALLOW,
            submission_feature_urn: 'urn:*:*:*',
            conditions: []
          }
        ]
      };

      const createPolicyWithStatementsStub = sinon
        .stub(PolicyService.prototype, 'createPolicyWithStatements')
        .resolves(mockCreatedPolicy);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.body = {
        name: 'New Policy',
        description: 'New description',
        statements: [
          {
            effect: PolicyEffect.ALLOW,
            submission_feature_urn: 'urn:*:*:*'
          }
        ]
      };

      const requestHandler = createPolicy();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(createPolicyWithStatementsStub).to.have.been.calledOnceWith(
        { name: 'New Policy', description: 'New description' },
        [{ effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:*:*:*' }]
      );
      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.eql(mockCreatedPolicy);
    });

    it('should call service.createPolicyWithStatements with empty statements array', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockCreatedPolicy: PolicyWithStatements = {
        policy_id: '1',
        name: 'Empty Policy',
        description: null,
        statements: []
      };

      const createPolicyWithStatementsStub = sinon
        .stub(PolicyService.prototype, 'createPolicyWithStatements')
        .resolves(mockCreatedPolicy);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.body = {
        name: 'Empty Policy'
      };

      const requestHandler = createPolicy();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(createPolicyWithStatementsStub).to.have.been.calledOnceWith(
        { name: 'Empty Policy', description: undefined },
        []
      );
      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.eql(mockCreatedPolicy);
    });
  });
});
