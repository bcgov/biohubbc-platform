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
        pagination: { total: 1, per_page: 10, current_page: 1, last_page: 1 }
      };

      const getPoliciesWithStatementsStub = sinon
        .stub(PolicyService.prototype, 'getPoliciesWithStatements')
        .resolves(mockPoliciesResponse);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = {
        page: '1',
        limit: '10'
      };

      const requestHandler = getPolicies();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getPoliciesWithStatementsStub).to.have.been.calledOnceWith(undefined, {
        page: 1,
        limit: 10,
        sort: undefined,
        order: undefined
      });
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
        pagination: { total: 0, per_page: 25, current_page: 2, last_page: 1 }
      };

      const getPoliciesWithStatementsStub = sinon
        .stub(PolicyService.prototype, 'getPoliciesWithStatements')
        .resolves(mockPoliciesResponse);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = {
        page: '2',
        limit: '25',
        search: 'test'
      };

      const requestHandler = getPolicies();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getPoliciesWithStatementsStub).to.have.been.calledOnceWith('test', {
        page: 2,
        limit: 25,
        sort: undefined,
        order: undefined
      });
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(mockPoliciesResponse);
    });

    it('should call service.getPoliciesWithStatements with sort ascending', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockPoliciesResponse = {
        policies: [
          { policy_id: '1', name: 'Alpha Policy', description: null, statements: [] },
          { policy_id: '2', name: 'Beta Policy', description: null, statements: [] }
        ],
        pagination: { total: 2, per_page: 10, current_page: 1, last_page: 1, sort: 'name', order: 'asc' as const }
      };

      const getPoliciesWithStatementsStub = sinon
        .stub(PolicyService.prototype, 'getPoliciesWithStatements')
        .resolves(mockPoliciesResponse);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = {
        page: '1',
        limit: '10',
        sort: 'name',
        order: 'asc'
      };

      const requestHandler = getPolicies();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getPoliciesWithStatementsStub).to.have.been.calledOnceWith(undefined, {
        page: 1,
        limit: 10,
        sort: 'name',
        order: 'asc'
      });
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(mockPoliciesResponse);
    });

    it('should call service.getPoliciesWithStatements with sort descending', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockPoliciesResponse = {
        policies: [
          { policy_id: '2', name: 'Zebra Policy', description: null, statements: [] },
          { policy_id: '1', name: 'Alpha Policy', description: null, statements: [] }
        ],
        pagination: { total: 2, per_page: 10, current_page: 1, last_page: 1, sort: 'name', order: 'desc' as const }
      };

      const getPoliciesWithStatementsStub = sinon
        .stub(PolicyService.prototype, 'getPoliciesWithStatements')
        .resolves(mockPoliciesResponse);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = {
        page: '1',
        limit: '10',
        sort: 'name',
        order: 'desc'
      };

      const requestHandler = getPolicies();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getPoliciesWithStatementsStub).to.have.been.calledOnceWith(undefined, {
        page: 1,
        limit: 10,
        sort: 'name',
        order: 'desc'
      });
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
