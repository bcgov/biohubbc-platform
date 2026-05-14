import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createDataRequest, findDataRequests } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import { SYSTEM_ROLE } from '../../constants/roles';
import * as db from '../../database/db';
import { ApiError } from '../../errors/api-error';
import { HTTP400 } from '../../errors/http-error';
import { DataRequest } from '../../models/data-request';
import { SystemUserExtended } from '../../models/user';
import { DataRequestService } from '../../services/data-request-service';
import { UserService } from '../../services/user-service';

chai.use(sinonChai);

describe('data-request', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockDataRequest: DataRequest = {
    data_request_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    reason: 'Research purposes',
    team_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    requested_by: 1,
    ticket_id: 'd4e5f6a7-b8c9-0123-def0-234567890123',
    policy_id: 'f5f6a7b8-c9d0-1234-efab-345678901234',
    status: 'requested',
    create_date: '2025-01-01T00:00:00.000Z'
  };

  const mockAdminUser: SystemUserExtended = {
    system_user_id: 1,
    user_identifier: 'admin@example.com',
    user_guid: 'admin-guid',
    user_identity_source_id: 1,
    identity_source: 'IDIR',
    record_effective_date: '2025-01-01',
    record_end_date: null,
    create_date: '2025-01-01',
    create_user: 1,
    update_date: null,
    update_user: null,
    revision_count: 0,
    display_name: 'Admin User',
    email: 'admin@example.com',
    given_name: 'Admin',
    family_name: 'User',
    agency: null,
    notes: null,
    role_ids: [1],
    role_names: [SYSTEM_ROLE.SYSTEM_ADMIN]
  };

  const mockNonAdminUser: SystemUserExtended = {
    ...mockAdminUser,
    system_user_id: 2,
    user_identifier: 'member@example.com',
    user_guid: 'member-guid',
    role_ids: [2],
    role_names: [SYSTEM_ROLE.MEMBER]
  };

  describe('findDataRequests', () => {
    it('throws error if DB connection fails to open', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').rejects(new Error('DB open failed'));

      const requestHandler = findDataRequests();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('DB open failed');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    it('calls DataRequestService.findDataRequestsByTeamMembership for non-admin with no filters and returns 200', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => mockNonAdminUser.system_user_id,
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(UserService.prototype, 'getUserById').resolves(mockNonAdminUser);

      const stub = sinon
        .stub(DataRequestService.prototype, 'findDataRequestsByTeamMembership')
        .resolves([mockDataRequest]);

      const requestHandler = findDataRequests();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(stub).to.have.been.calledOnceWith([mockNonAdminUser.system_user_id], {
        date_from: undefined,
        date_to: undefined,
        requested_by: undefined,
        team_id: undefined,
        status: undefined
      });
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql([mockDataRequest]);
    });

    it('parses query params and passes filters to service for non-admin', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => mockNonAdminUser.system_user_id,
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(UserService.prototype, 'getUserById').resolves(mockNonAdminUser);

      const stub = sinon
        .stub(DataRequestService.prototype, 'findDataRequestsByTeamMembership')
        .resolves([mockDataRequest]);

      const requestHandler = findDataRequests();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = {
        date_from: '2025-01-01',
        date_to: '2025-01-31',
        requested_by: '1' as any,
        team_id: mockDataRequest.team_id,
        status: 'requested'
      };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(stub).to.have.been.calledOnceWith([mockNonAdminUser.system_user_id], {
        date_from: '2025-01-01',
        date_to: '2025-01-31',
        requested_by: 1,
        team_id: mockDataRequest.team_id,
        status: 'requested'
      });
      expect(mockRes.statusValue).to.equal(200);
    });

    it('rolls back and rethrows if service throws', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => mockAdminUser.system_user_id,
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(UserService.prototype, 'getUserById').resolves(mockAdminUser);
      sinon.stub(DataRequestService.prototype, 'findDataRequestsByTeamMembership').rejects(new Error('Service error'));

      const requestHandler = findDataRequests();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('Service error');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });
  });

  describe('createDataRequest', () => {
    it('throws error if DB connection fails to open', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').rejects(new Error('DB open failed'));

      const requestHandler = createDataRequest();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = {
        reason: 'Test',
        system_user_ids: [],
        featureTypes: ['observation'],
        expression: null
      };

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('DB open failed');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    const expressionTree = {
      type: 'expression' as const,
      operator: 'AND' as const,
      clauses: [
        {
          type: 'predicate' as const,
          feature_property_id: 1,
          feature_type_property_id: null,
          operator: 'Equals' as const,
          value: 'mammalia'
        }
      ]
    };

    it('R1: forwards parsed payload (featureTypes + expression) to service with requested_by from systemUserId()', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => mockNonAdminUser.system_user_id,
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const createStub = sinon.stub(DataRequestService.prototype, 'createDataRequest').resolves(mockDataRequest);

      const requestHandler = createDataRequest();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = {
        reason: 'Need secured data for analysis',
        system_user_ids: [2, 3],
        featureTypes: ['observation'],
        expression: expressionTree
      };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(createStub).to.have.been.calledOnceWith({
        requested_by: mockNonAdminUser.system_user_id,
        reason: 'Need secured data for analysis',
        system_user_ids: [2, 3],
        featureTypes: ['observation'],
        expression: expressionTree
      });
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.eql(mockDataRequest);
    });

    it('R2: rejects unknown keys inside expression with 400 (Zod .strict())', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => mockNonAdminUser.system_user_id,
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const createStub = sinon.stub(DataRequestService.prototype, 'createDataRequest').resolves(mockDataRequest);

      const requestHandler = createDataRequest();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = {
        reason: 'reason text',
        system_user_ids: [],
        featureTypes: ['observation'],
        expression: {
          ...expressionTree,
          ui_id: 'rogue-key-from-frontend'
        }
      };

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw HTTP400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect((error as HTTP400).message).to.equal('Invalid request body');
        expect(createStub).to.not.have.been.called;
      }
    });

    it('R3: accepts expression: null literally and forwards as null', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => mockNonAdminUser.system_user_id,
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const createStub = sinon.stub(DataRequestService.prototype, 'createDataRequest').resolves(mockDataRequest);

      const requestHandler = createDataRequest();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = {
        reason: 'reason text',
        system_user_ids: [],
        featureTypes: ['observation'],
        expression: null
      };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(createStub).to.have.been.calledOnceWith({
        requested_by: mockNonAdminUser.system_user_id,
        reason: 'reason text',
        system_user_ids: [],
        featureTypes: ['observation'],
        expression: null
      });
      expect(mockRes.statusValue).to.equal(201);
    });

    it('R4: rejects payload missing featureTypes/expression with 400', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => mockNonAdminUser.system_user_id,
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const createStub = sinon.stub(DataRequestService.prototype, 'createDataRequest').resolves(mockDataRequest);

      const requestHandler = createDataRequest();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = {
        reason: 'Need secured data for analysis',
        system_user_ids: []
      };

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw HTTP400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect((error as HTTP400).message).to.equal('Invalid request body');
        expect(createStub).to.not.have.been.called;
      }
    });

    it('R5: rejects featureTypes: [] (minItems: 1) with 400', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => mockNonAdminUser.system_user_id,
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const createStub = sinon.stub(DataRequestService.prototype, 'createDataRequest').resolves(mockDataRequest);

      const requestHandler = createDataRequest();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = {
        reason: 'reason text',
        system_user_ids: [],
        featureTypes: [],
        expression: null
      };

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw HTTP400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect((error as HTTP400).message).to.equal('Invalid request body');
        expect(createStub).to.not.have.been.called;
      }
    });

    it('R6: rejects empty reason with 400', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => mockNonAdminUser.system_user_id,
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const createStub = sinon.stub(DataRequestService.prototype, 'createDataRequest').resolves(mockDataRequest);

      const requestHandler = createDataRequest();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = {
        reason: '',
        system_user_ids: []
      };

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw HTTP400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect((error as HTTP400).message).to.equal('Invalid request body');
        expect(createStub).to.not.have.been.called;
      }
    });

    it('R7: propagates HTTP400 from service (e.g. unknown feature type)', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => mockNonAdminUser.system_user_id,
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      sinon
        .stub(DataRequestService.prototype, 'createDataRequest')
        .rejects(new HTTP400('Unknown feature type(s)', [{ unknownFeatureTypes: ['weatherz'] }]));

      const requestHandler = createDataRequest();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = {
        reason: 'reason text',
        system_user_ids: [],
        featureTypes: ['weatherz'],
        expression: null
      };

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw HTTP400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect((error as HTTP400).message).to.equal('Unknown feature type(s)');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    it('R8: rejects requested_by in body (Zod .strict() at top level)', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => mockNonAdminUser.system_user_id,
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const createStub = sinon.stub(DataRequestService.prototype, 'createDataRequest').resolves(mockDataRequest);

      const requestHandler = createDataRequest();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = {
        reason: 'reason text',
        system_user_ids: [],
        requested_by: 99
      };

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw HTTP400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect((error as HTTP400).message).to.equal('Invalid request body');
        expect(createStub).to.not.have.been.called;
      }
    });

    it('rolls back and rethrows if service throws', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => mockNonAdminUser.system_user_id,
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      sinon.stub(DataRequestService.prototype, 'createDataRequest').rejects(new Error('Service error'));

      const requestHandler = createDataRequest();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = {
        reason: 'Test',
        system_user_ids: [2, 3],
        featureTypes: ['observation'],
        expression: null
      };

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('Service error');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });
  });
});
