import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { CreateDataRequestPayload, DataRequest, UpdateDataRequest } from '../models/data-request';
import { PolicyEffect } from '../models/policy-statement';
import { TeamMemberWithUser } from '../models/team-member';
import { TeamPolicy } from '../models/team-policy';
import { DataRequestRepository } from '../repositories/data-request-repository';
import { PolicyService } from './access-policy/policy-service';
import { TeamMemberService } from './access-policy/team-member-service';
import { TeamPolicyService } from './access-policy/team-policy-service';
import { TeamService } from './access-policy/team-service';
import { DataRequestService } from './data-request-service';
import { TicketService } from './ticket-service';

chai.use(sinonChai);

describe('DataRequestService', () => {
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
    create_date: '2026-04-17T00:00:00.000Z'
  };

  const mockTeamMember: TeamMemberWithUser = {
    team_member_id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    system_user_id: 1,
    user_identifier: 'user_1',
    email: 'user_1@test.com'
  };

  it('findDataRequestById returns repository value', async () => {
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    const stub = sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(mockDataRequest);

    const result = await service.findDataRequestById(mockDataRequest.data_request_id);

    expect(stub).to.have.been.calledOnceWith(mockDataRequest.data_request_id);
    expect(result).to.deep.equal(mockDataRequest);
  });

  it('findDataRequestsByTeamMembership delegates to repository with system user ids', async () => {
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);
    const userIds = [1, 2];
    const filters = { status: 'requested' as const };

    const stub = sinon
      .stub(DataRequestRepository.prototype, 'findDataRequestsByTeamMembership')
      .resolves([mockDataRequest]);

    const result = await service.findDataRequestsByTeamMembership(userIds, filters);

    expect(stub).to.have.been.calledOnceWith(userIds, filters);
    expect(result).to.deep.equal([mockDataRequest]);
  });

  it('createDataRequest creates a ticket then delegates to createDataRequestForTicket', async () => {
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    const payload: CreateDataRequestPayload = {
      requested_by: mockDataRequest.requested_by,
      reason: 'New research project',
      system_user_ids: [2, 3]
    };

    const createTicketStub = sinon.stub(TicketService.prototype, 'createTicket').resolves({
      ticket_id: mockDataRequest.ticket_id,
      ticket_slug: '11000001',
      subject: 'Data Request',
      description: payload.reason,
      team_id: '22222222-2222-2222-2222-222222222222',
      create_date: '2026-04-17T00:00:00.000Z',
      priority: 'medium',
      status: 'open'
    });
    const createForTicketStub = sinon
      .stub(DataRequestService.prototype, 'createDataRequestForTicket')
      .resolves(mockDataRequest);

    const result = await service.createDataRequest(payload);

    expect(createTicketStub).to.have.been.calledOnceWith({
      subject: 'Data Request - New research project',
      description: payload.reason,
      priority: 'medium'
    });
    expect(createForTicketStub).to.have.been.calledOnceWith(mockDataRequest.ticket_id, {
      ...payload
    });
    expect(result).to.deep.equal(mockDataRequest);
  });

  it('createDataRequestForTicket creates separate teams, links policy team, and creates request', async () => {
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    const mockPolicy = {
      policy_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
      name: 'Data request policy - uuid',
      description: null,
      status: 'requested' as const,
      statements: []
    };
    const mockTeamPolicy: TeamPolicy = {
      team_policy_id: '12341234-5678-90ab-cdef-123412341234',
      team_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      policy_id: mockPolicy.policy_id
    };

    const payload: CreateDataRequestPayload = {
      requested_by: mockDataRequest.requested_by,
      reason: 'New research project',
      system_user_ids: [2, 3]
    };

    const dataRequestTeamId = mockDataRequest.team_id;
    const policyTeamId = mockTeamPolicy.team_id;

    sinon
      .stub(TeamService.prototype, 'createTeam')
      .onFirstCall()
      .resolves({ team_id: dataRequestTeamId, name: 'dr-team', description: null, member_count: 0 })
      .onSecondCall()
      .resolves({ team_id: policyTeamId, name: 'policy-team', description: null, member_count: 0 });

    const createTeamMemberStub = sinon.stub(TeamMemberService.prototype, 'createTeamMember').resolves(mockTeamMember);
    const createPolicyStub = sinon.stub(PolicyService.prototype, 'createPolicyWithStatements').resolves(mockPolicy);
    const createTeamPolicyStub = sinon.stub(TeamPolicyService.prototype, 'createTeamPolicy').resolves(mockTeamPolicy);
    const createRequestStub = sinon.stub(DataRequestRepository.prototype, 'createDataRequest').resolves({
      ...mockDataRequest,
      team_id: dataRequestTeamId,
      policy_id: mockPolicy.policy_id
    });
    sinon.stub(DataRequestService.prototype, 'getDataRequestById').resolves({
      ...mockDataRequest,
      team_id: dataRequestTeamId,
      policy_id: mockPolicy.policy_id,
      status: 'requested'
    });

    const result = await service.createDataRequestForTicket(mockDataRequest.ticket_id, payload);

    expect(createPolicyStub).to.have.been.calledOnce;
    expect(createPolicyStub.firstCall.args[0].status).to.equal('requested');
    expect(createPolicyStub.firstCall.args[1]).to.deep.equal([
      { effect: PolicyEffect.DENY, submission_feature_urn: 'urn:*:*:*' }
    ]);
    expect(createTeamPolicyStub).to.have.been.calledOnceWith({
      team_id: policyTeamId,
      policy_id: mockPolicy.policy_id
    });
    expect(createRequestStub).to.have.been.calledOnce;
    expect(createRequestStub.firstCall.args[0]).to.deep.equal({
      requested_by: payload.requested_by,
      reason: payload.reason,
      team_id: dataRequestTeamId,
      ticket_id: mockDataRequest.ticket_id,
      policy_id: mockPolicy.policy_id
    });
    expect(createTeamMemberStub).to.have.callCount(4);

    for (const call of createTeamMemberStub.getCalls()) {
      const args = call.args[0];
      expect(args.system_user_id).to.be.oneOf([2, 3]);
      expect(args.team_id).to.be.oneOf([dataRequestTeamId, policyTeamId]);
    }

    expect(result.status).to.equal('requested');
  });

  it('updateDataRequest delegates to repository', async () => {
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    const updateStub = sinon.stub(DataRequestRepository.prototype, 'updateDataRequest').resolves();
    const payload: UpdateDataRequest = { reason: 'Updated reason' };

    const result = await service.updateDataRequest(mockDataRequest.data_request_id, payload);

    expect(updateStub).to.have.been.calledOnceWith(mockDataRequest.data_request_id, payload);
    expect(result).to.be.undefined;
  });
});
