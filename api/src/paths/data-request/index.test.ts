import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { findDataRequests } from '.';
import { SYSTEM_ROLE } from '../../constants/roles';
import * as db from '../../database/db';
import { ApiError } from '../../errors/api-error';
import { DataRequest } from '../../models/data-request';
import { SystemUserExtended } from '../../models/user';
import { DataRequestService } from '../../services/data-request-service';
import { UserService } from '../../services/user-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';

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
    status: 'requested'
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
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
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
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
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
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
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
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
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
});
