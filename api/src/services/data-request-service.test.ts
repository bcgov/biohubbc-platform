import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { CreateDataRequest, DataRequest, FlatDataRequestWithStatus, UpdateDataRequest } from '../models/data-request';
import { DataRequestStatus, DataRequestStatusEnum } from '../models/data-request-status';
import { TeamMemberWithUser } from '../models/team-member';
import { DataRequestRepository } from '../repositories/data-request-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { TeamMemberService } from './access-policy/team-member-service';
import { TeamService } from './access-policy/team-service';
import { DataRequestService } from './data-request-service';
import { DataRequestStatusService } from './data-request-status-service';

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
    comment_id: null,
    request_status: 'REQUESTED'
  };

  const mockDataRequest: DataRequest = {
    data_request_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    reason: 'Research purposes',
    team_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    requested_by: 1
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

  describe('createDataRequest', () => {
    it('should create a data request with provided team_id and return it with status', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      const payload: CreateDataRequest = { reason: 'New research project', team_id: mockDataRequest.team_id };
      const createStub = sinon.stub(DataRequestRepository.prototype, 'createDataRequest').resolves(mockDataRequest);
      const statusStub = sinon
        .stub(DataRequestStatusService.prototype, 'createDataRequestStatus')
        .resolves(mockDataRequestStatus);

      const result = await service.createDataRequest(mockDataRequest.requested_by, payload);

      expect(createStub).to.have.been.calledOnceWith(mockDataRequest.requested_by, payload);
      expect(statusStub).to.have.been.calledOnceWith(
        mockDataRequest.data_request_id,
        DataRequestStatusEnum.enum.REQUESTED,
        undefined
      );
      expect(result.data_request_id).to.equal(mockDataRequest.data_request_id);
      expect(result.data_request_status).to.deep.equal(mockDataRequestStatus);
    });

    it('should create a new team when payload.team_id is undefined', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      const newTeamId = 'e5f6a7b8-c9d0-1234-efab-345678901234';
      const teamStub = sinon
        .stub(TeamService.prototype, 'createTeam')
        .resolves({ team_id: newTeamId, name: 'test', description: null, member_count: 0 });
      const memberStub = sinon.stub(TeamMemberService.prototype, 'createTeamMember').resolves(mockTeamMember);
      sinon.stub(DataRequestRepository.prototype, 'createDataRequest').resolves({
        ...mockDataRequest,
        team_id: newTeamId
      });
      sinon.stub(DataRequestStatusService.prototype, 'createDataRequestStatus').resolves(mockDataRequestStatus);

      const payload: CreateDataRequest = { reason: 'New research project' };
      await service.createDataRequest(mockDataRequest.requested_by, payload);

      expect(teamStub).to.have.been.calledOnce;
      expect(memberStub).to.have.been.calledOnceWith({
        system_user_id: mockDataRequest.requested_by,
        team_id: newTeamId
      });
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestService(mockDB);

      const payload: CreateDataRequest = { reason: 'Test', team_id: mockDataRequest.team_id };
      sinon.stub(DataRequestRepository.prototype, 'createDataRequest').rejects(new Error('DB error'));

      try {
        await service.createDataRequest(1, payload);
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
