import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { CreateDataRequest, DataRequest, FlatDataRequestWithStatus, UpdateDataRequest } from '../models/data-request';
import { DataRequestStatus, DataRequestStatusEnum } from '../models/data-request-status';
import { PolicyEffect } from '../models/policy-statement';
import { TeamMemberWithUser } from '../models/team-member';
import { DataRequestRepository } from '../repositories/data-request-repository';
import { PolicyService } from './access-policy/policy-service';
import { TeamMemberService } from './access-policy/team-member-service';
import { TeamPolicyService } from './access-policy/team-policy-service';
import { TeamService } from './access-policy/team-service';
import { DataRequestService } from './data-request-service';
import { DataRequestStatusService } from './data-request-status-service';
import { TicketService } from './ticket-service';

chai.use(sinonChai);

describe('DataRequestService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockFlatDataRequest: FlatDataRequestWithStatus = {
    data_request_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    data_request_status_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    reason: 'Research purposes',
    team_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    requested_by: 1,
    ticket_id: 'd4e5f6a7-b8c9-0123-def0-234567890123',
    comment_id: null,
    request_status: 'REQUESTED'
  };

  const mockDataRequest: DataRequest = {
    data_request_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    reason: 'Research purposes',
    team_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    requested_by: 1,
    ticket_id: 'd4e5f6a7-b8c9-0123-def0-234567890123'
  };

  const mockDataRequestStatus: DataRequestStatus = {
    data_request_status_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    data_request_id: mockDataRequest.data_request_id,
    comment_id: null,
    request_status: 'REQUESTED'
  };

  const mockTeamMember: TeamMemberWithUser = {
    team_member_id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    system_user_id: 1,
    user_identifier: 'user_1',
    email: 'user_1@test.com'
  };

  describe('findDataRequestById', () => {
    it('should return a data request for a given dataRequestId', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      const stub = sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(mockFlatDataRequest);

      const result = await service.findDataRequestById(mockDataRequest.data_request_id);

      expect(stub).to.have.been.calledOnceWith(mockDataRequest.data_request_id);
      expect(result).to.deep.equal(mockFlatDataRequest);
    });

    it('should return null when data request is not found', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(null);

      const result = await service.findDataRequestById('non-existent-id');

      expect(result).to.be.null;
    });
  });

  describe('getDataRequestById', () => {
    it('should return the transformed data request with nested status', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      const stub = sinon.stub(DataRequestRepository.prototype, 'getDataRequestById').resolves(mockFlatDataRequest);

      const result = await service.getDataRequestById(mockDataRequest.data_request_id);

      expect(stub).to.have.been.calledOnceWith(mockDataRequest.data_request_id);
      expect(result.data_request_id).to.equal(mockFlatDataRequest.data_request_id);
      expect(result.data_request_status).to.deep.equal({
        data_request_status_id: mockFlatDataRequest.data_request_status_id,
        data_request_id: mockFlatDataRequest.data_request_id,
        comment_id: mockFlatDataRequest.comment_id,
        request_status: mockFlatDataRequest.request_status
      });
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      sinon.stub(DataRequestRepository.prototype, 'getDataRequestById').rejects(new Error('DB error'));

      try {
        await service.getDataRequestById(mockDataRequest.data_request_id);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as Error).message).to.equal('DB error');
      }
    });
  });

  describe('findDataRequests', () => {
    it('should return transformed data requests when no filters provided', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      const stub = sinon.stub(DataRequestRepository.prototype, 'findDataRequests').resolves([mockFlatDataRequest]);

      const result = await service.findDataRequests();

      expect(stub).to.have.been.calledOnceWith(undefined);
      expect(result).to.have.length(1);
      expect(result[0].data_request_status).to.deep.equal({
        data_request_status_id: mockFlatDataRequest.data_request_status_id,
        data_request_id: mockFlatDataRequest.data_request_id,
        comment_id: mockFlatDataRequest.comment_id,
        request_status: mockFlatDataRequest.request_status
      });
    });

    it('should pass filters to repository', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      const filters = {
        date_from: '2025-01-01',
        date_to: '2025-01-31',
        requested_by: 1,
        team_id: mockDataRequest.team_id
      };
      const stub = sinon.stub(DataRequestRepository.prototype, 'findDataRequests').resolves([mockFlatDataRequest]);

      await service.findDataRequests(filters);

      expect(stub).to.have.been.calledOnceWith(filters);
    });
  });

  describe('findDataRequestsBySystemUserId', () => {
    it('should call findDataRequestsByTeamMembership with systemUserId and return transformed results', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      const systemUserId = mockDataRequest.requested_by;
      const stub = sinon
        .stub(DataRequestRepository.prototype, 'findDataRequestsByTeamMembership')
        .resolves([mockFlatDataRequest]);

      const result = await service.findDataRequestsBySystemUserId(systemUserId);

      expect(stub).to.have.been.calledOnceWith(systemUserId, undefined);
      expect(result).to.have.length(1);
      expect(result[0].data_request_status).to.deep.equal({
        data_request_status_id: mockFlatDataRequest.data_request_status_id,
        data_request_id: mockFlatDataRequest.data_request_id,
        comment_id: mockFlatDataRequest.comment_id,
        request_status: mockFlatDataRequest.request_status
      });
    });

    it('should pass filters to findDataRequestsByTeamMembership', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      const systemUserId = mockDataRequest.requested_by;
      const filters = { status: 'REQUESTED' as const };
      const stub = sinon
        .stub(DataRequestRepository.prototype, 'findDataRequestsByTeamMembership')
        .resolves([mockFlatDataRequest]);

      await service.findDataRequestsBySystemUserId(systemUserId, filters);

      expect(stub).to.have.been.calledOnceWith(systemUserId, filters);
    });

    it('should return empty array when user has no team memberships with data requests', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      sinon.stub(DataRequestRepository.prototype, 'findDataRequestsByTeamMembership').resolves([]);

      const result = await service.findDataRequestsBySystemUserId(999);

      expect(result).to.eql([]);
    });
  });

  describe('createDataRequest', () => {
    const mockApprovedStatus: DataRequestStatus = {
      ...mockDataRequestStatus,
      request_status: 'APPROVED'
    };

    const mockPolicy = {
      policy_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
      name: 'Data request policy - uuid',
      description: null,
      statements: []
    };

    const mockTeamPolicy = {
      team_policy_id: '12345678-abcd-ef01-2345-678901234567',
      team_id: mockDataRequest.team_id,
      policy_id: mockPolicy.policy_id
    };

    const stubCreateDataRequestDependencies = (
      overrides: {
        teamId?: string;
        createNewTeam?: boolean;
      } = {}
    ) => {
      const { teamId = mockDataRequest.team_id, createNewTeam = false } = overrides;

      if (createNewTeam) {
        sinon
          .stub(TeamService.prototype, 'createTeam')
          .resolves({ team_id: teamId, name: 'test', description: null, member_count: 1 });
        sinon.stub(TeamMemberService.prototype, 'createTeamMember').resolves(mockTeamMember);
      }

      sinon.stub(TicketService.prototype, 'createTicket').resolves({
        ticket_id: mockDataRequest.ticket_id,
        ticket_slug: '06600000',
        subject: 'Data Request',
        description: null,
        team_id: teamId,
        create_date: '2026-03-06',
        priority: 'medium',
        status: 'open'
      });

      sinon
        .stub(DataRequestRepository.prototype, 'createDataRequest')
        .resolves({ ...mockDataRequest, team_id: teamId });
      sinon.stub(PolicyService.prototype, 'createPolicyWithStatements').resolves(mockPolicy);
      sinon.stub(TeamPolicyService.prototype, 'createTeamPolicy').resolves({ ...mockTeamPolicy, team_id: teamId });
      sinon.stub(DataRequestStatusService.prototype, 'createDataRequestStatus').resolves(mockApprovedStatus);
    };

    it('should create a data request with provided team_id, create a policy, and auto-approve', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      const payload: CreateDataRequest = {
        requested_by: mockDataRequest.requested_by,
        reason: 'New research project',
        team_id: mockDataRequest.team_id
      };

      stubCreateDataRequestDependencies();

      const createStub = DataRequestRepository.prototype.createDataRequest as sinon.SinonStub;
      const policyStub = PolicyService.prototype.createPolicyWithStatements as sinon.SinonStub;
      const teamPolicyStub = TeamPolicyService.prototype.createTeamPolicy as sinon.SinonStub;
      const statusStub = DataRequestStatusService.prototype.createDataRequestStatus as sinon.SinonStub;

      const result = await service.createDataRequest(payload);

      expect(createStub).to.have.been.calledOnceWith(mockDataRequest.requested_by, {
        ...payload,
        team_id: mockDataRequest.team_id,
        ticket_id: mockDataRequest.ticket_id
      });

      expect(policyStub).to.have.been.calledOnce;
      const policyArgs = policyStub.firstCall.args;
      expect(policyArgs[1]).to.deep.equal([{ effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:*:*:*' }]);
      expect(policyArgs[0]).to.have.property('record_end_date').that.is.a('string');

      expect(teamPolicyStub).to.have.been.calledOnceWith({
        team_id: mockDataRequest.team_id,
        policy_id: mockPolicy.policy_id
      });

      expect(statusStub).to.have.been.calledOnceWith(
        mockDataRequest.data_request_id,
        DataRequestStatusEnum.enum.APPROVED,
        undefined
      );

      expect(result.data_request_id).to.equal(mockDataRequest.data_request_id);
      expect(result.data_request_status.request_status).to.equal('APPROVED');
    });

    it('should create a ticket when creating a data request', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      const payload: CreateDataRequest = {
        requested_by: mockDataRequest.requested_by,
        reason: 'New research project',
        team_id: mockDataRequest.team_id
      };
      const expectedTicketSubject = `Data Request - ${payload.reason.split(' ').slice(0, 10).join(' ')}`;

      stubCreateDataRequestDependencies();

      const createStub = DataRequestRepository.prototype.createDataRequest as sinon.SinonStub;
      const ticketStub = TicketService.prototype.createTicket as sinon.SinonStub;

      await service.createDataRequest(payload);

      expect(createStub).to.have.been.calledOnceWith(mockDataRequest.requested_by, {
        ...payload,
        team_id: mockDataRequest.team_id,
        ticket_id: mockDataRequest.ticket_id
      });

      expect(ticketStub).to.have.been.calledOnceWith({
        subject: expectedTicketSubject,
        description: null,
        priority: 'medium'
      });
    });

    it('should create a new team when payload.team_id is undefined', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      const newTeamId = 'e5f6a7b8-c9d0-1234-efab-345678901234';
      stubCreateDataRequestDependencies({ teamId: newTeamId, createNewTeam: true });

      const teamStub = TeamService.prototype.createTeam as sinon.SinonStub;
      const memberStub = TeamMemberService.prototype.createTeamMember as sinon.SinonStub;
      const teamPolicyStub = TeamPolicyService.prototype.createTeamPolicy as sinon.SinonStub;

      const payload: CreateDataRequest = {
        requested_by: mockDataRequest.requested_by,
        reason: 'New research project'
      };
      await service.createDataRequest(payload);

      expect(teamStub).to.have.been.calledOnce;
      expect(memberStub).to.have.been.calledOnceWith({
        system_user_id: mockDataRequest.requested_by,
        team_id: newTeamId
      });
      expect(teamPolicyStub).to.have.been.calledOnceWith({
        team_id: newTeamId,
        policy_id: mockPolicy.policy_id
      });
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      const payload: CreateDataRequest = {
        requested_by: 1,
        reason: 'Test',
        team_id: mockDataRequest.team_id
      };
      sinon.stub(TicketService.prototype, 'createTicket').resolves({
        ticket_id: mockDataRequest.ticket_id,
        ticket_slug: '06600000',
        subject: 'Data Request',
        description: null,
        team_id: mockDataRequest.team_id,
        create_date: '2026-03-06',
        priority: 'medium',
        status: 'open'
      });
      sinon.stub(DataRequestRepository.prototype, 'createDataRequest').rejects(new Error('DB error'));

      try {
        await service.createDataRequest(payload);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as Error).message).to.equal('DB error');
      }
    });
  });

  describe('updateDataRequest', () => {
    it('should update the data request and return void', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(mockFlatDataRequest);
      const updateStub = sinon.stub(DataRequestRepository.prototype, 'updateDataRequest').resolves();

      const payload: UpdateDataRequest = { reason: 'Updated reason' };

      const result = await service.updateDataRequest(mockDataRequest.data_request_id, payload);

      expect(updateStub).to.have.been.calledOnceWith(mockDataRequest.data_request_id, payload);
      expect(result).to.be.undefined;
    });

    it('should throw HTTP 404 when data request is not found', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(null);
      const payload: UpdateDataRequest = { reason: 'Updated reason' };

      try {
        await service.updateDataRequest('non-existent-id', payload);
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.status).to.equal(404);
        expect(err.message).to.equal('Data request not found');
      }
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(mockFlatDataRequest);
      sinon.stub(DataRequestRepository.prototype, 'updateDataRequest').rejects(new Error('DB error'));
      const payload: UpdateDataRequest = { reason: 'Updated' };

      try {
        await service.updateDataRequest(mockDataRequest.data_request_id, payload);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as Error).message).to.equal('DB error');
      }
    });
  });

  describe('deleteDataRequest', () => {
    it('should delete the data request successfully', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(mockFlatDataRequest);
      const stub = sinon.stub(DataRequestRepository.prototype, 'deleteDataRequest').resolves();

      await service.deleteDataRequest(mockDataRequest.data_request_id);

      expect(stub).to.have.been.calledOnceWith(mockDataRequest.data_request_id);
    });

    it('should throw HTTP 404 when data request is not found', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(null);

      try {
        await service.deleteDataRequest('non-existent-id');
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.status).to.equal(404);
        expect(err.message).to.equal('Data request not found');
      }
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(mockFlatDataRequest);
      sinon.stub(DataRequestRepository.prototype, 'deleteDataRequest').rejects(new Error('DB error'));

      try {
        await service.deleteDataRequest(mockDataRequest.data_request_id);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as Error).message).to.equal('DB error');
      }
    });
  });
});
