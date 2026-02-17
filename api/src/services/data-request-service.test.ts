import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  CreateDataRequest,
  DataRequest,
  DataRequestStatus,
  DataRequestStatusEnum,
  DataRequestWithStatus,
  UpdateDataRequest
} from '../models/data-request';
import { TeamMember } from '../models/team-member';
import { DataRequestRepository } from '../repositories/data-request-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { DataRequestService } from './data-request-service';
import { UserService } from './user-service';

chai.use(sinonChai);

describe('DataRequestService', () => {
  afterEach(() => {
    sinon.restore();
  });

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

  const mockDataRequestWithStatus: DataRequestWithStatus = {
    ...mockDataRequest,
    data_request_status: mockDataRequestStatus
  };

  const mockTeamMember: TeamMember = {
    team_member_id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    system_user_id: 1,
    team_id: mockDataRequest.team_id
  };

  describe('findDataRequestById', () => {
    it('should return a data request for a given dataRequestId', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      const stub = sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(mockDataRequest);

      const result = await service.findDataRequestById(mockDataRequest.data_request_id);

      expect(stub).to.have.been.calledOnceWith(mockDataRequest.data_request_id);
      expect(result).to.deep.equal(mockDataRequest);
    });

    it('should return null when data request is not found', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(null as unknown as DataRequest);

      const result = await service.findDataRequestById('non-existent-id');

      expect(result).to.be.null;
    });

    it('should propagate repository errors', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').rejects(new Error('DB error'));

      try {
        await service.findDataRequestById(mockDataRequest.data_request_id);
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.message).to.equal('DB error');
      }
    });
  });

  describe('getDataRequestById', () => {
    describe('when the user is not authorized', () => {
      it('should throw HTTP 403 when user is not a system admin and not a team member', async () => {
        const mockDBConnection = getMockDBConnection({
          systemUserId: () => 99
        });
        const service = new DataRequestService(mockDBConnection);

        sinon.stub(DataRequestRepository.prototype, 'getDataRequestById').resolves(mockDataRequest);
        sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(false);
        sinon.stub(DataRequestService.prototype, 'findTeamMember').resolves(null);

        try {
          await service.getDataRequestById(mockDataRequest.data_request_id);
          expect.fail('Expected HTTP403 to be thrown');
        } catch (err: any) {
          expect(err.status).to.equal(403);
          expect(err.message).to.equal('Access Denied');
        }
      });

      it('should propagate repository errors before authorization is checked', async () => {
        const mockDBConnection = getMockDBConnection();
        const service = new DataRequestService(mockDBConnection);

        sinon.stub(DataRequestRepository.prototype, 'getDataRequestById').rejects(new Error('DB error'));

        try {
          await service.getDataRequestById(mockDataRequest.data_request_id);
          expect.fail('Expected error to be thrown');
        } catch (err: any) {
          expect(err.message).to.equal('DB error');
        }
      });
    });

    describe('when the user is authorized as a system administrator', () => {
      it('should return the data request', async () => {
        const mockDBConnection = getMockDBConnection({
          systemUserId: () => 99
        });
        const service = new DataRequestService(mockDBConnection);

        sinon.stub(DataRequestRepository.prototype, 'getDataRequestById').resolves(mockDataRequest);
        sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(true);

        const result = await service.getDataRequestById(mockDataRequest.data_request_id);

        expect(result).to.deep.equal(mockDataRequest);
      });

      it('should not check team membership when user is a system admin', async () => {
        const mockDBConnection = getMockDBConnection({
          systemUserId: () => 99
        });
        const service = new DataRequestService(mockDBConnection);

        sinon.stub(DataRequestRepository.prototype, 'getDataRequestById').resolves(mockDataRequest);
        sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(true);
        const findTeamMemberStub = sinon.stub(DataRequestService.prototype, 'findTeamMember');

        await service.getDataRequestById(mockDataRequest.data_request_id);

        expect(findTeamMemberStub).to.not.have.been.called;
      });
    });

    describe('when the user is authorized as a team member but not a system administrator', () => {
      it('should return the data request when user belongs to the team', async () => {
        const mockDBConnection = getMockDBConnection({
          systemUserId: () => mockTeamMember.system_user_id
        });
        const service = new DataRequestService(mockDBConnection);

        sinon.stub(DataRequestRepository.prototype, 'getDataRequestById').resolves(mockDataRequest);
        sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(false);
        sinon.stub(DataRequestService.prototype, 'findTeamMember').resolves(mockTeamMember);

        const result = await service.getDataRequestById(mockDataRequest.data_request_id);

        expect(result).to.deep.equal(mockDataRequest);
      });

      it('should check team membership with the correct team_id and user_id', async () => {
        const mockDBConnection = getMockDBConnection({
          systemUserId: () => mockTeamMember.system_user_id
        });
        const service = new DataRequestService(mockDBConnection);

        sinon.stub(DataRequestRepository.prototype, 'getDataRequestById').resolves(mockDataRequest);
        sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(false);
        const findTeamMemberStub = sinon.stub(DataRequestService.prototype, 'findTeamMember').resolves(mockTeamMember);

        await service.getDataRequestById(mockDataRequest.data_request_id);

        expect(findTeamMemberStub).to.have.been.calledOnceWith(mockDataRequest.team_id, mockTeamMember.system_user_id);
      });
    });
  });

  describe('findDataRequests', () => {
    it('should return data requests when no filters provided', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      const mockRequests = [mockDataRequest];
      const stub = sinon.stub(DataRequestRepository.prototype, 'findDataRequests').resolves(mockRequests);

      const result = await service.findDataRequests();

      expect(stub).to.have.been.calledOnceWith(undefined);
      expect(result).to.deep.equal(mockRequests);
    });

    it('should return filtered data requests when filters provided', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      const filters = {
        date_from: '2025-01-01',
        date_to: '2025-01-31',
        requested_by: 1,
        team_id: mockDataRequest.team_id
      };
      const mockRequests = [mockDataRequest];
      const stub = sinon.stub(DataRequestRepository.prototype, 'findDataRequests').resolves(mockRequests);

      const result = await service.findDataRequests(filters);

      expect(stub).to.have.been.calledOnceWith(filters);
      expect(result).to.deep.equal(mockRequests);
    });

    it('should pass status in filters to repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      const filters = { status: 'REQUESTED' as const };
      const mockRequests = [mockDataRequest];
      const stub = sinon.stub(DataRequestRepository.prototype, 'findDataRequests').resolves(mockRequests);

      const result = await service.findDataRequests(filters);

      expect(stub).to.have.been.calledOnceWith(filters);
      expect(result).to.deep.equal(mockRequests);
    });

    it('should propagate repository errors', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      sinon.stub(DataRequestRepository.prototype, 'findDataRequests').rejects(new Error('DB error'));

      try {
        await service.findDataRequests();
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.message).to.equal('DB error');
      }
    });
  });

  describe('createDataRequest', () => {
    it('should create a new data request and return it with status', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      const payload: CreateDataRequest = { reason: 'New research project' };
      const createStub = sinon.stub(DataRequestRepository.prototype, 'createDataRequest').resolves(mockDataRequest);
      sinon.stub(DataRequestRepository.prototype, 'createDataRequestStatus').resolves(mockDataRequestStatus);

      const result = await service.createDataRequest(mockDataRequest.requested_by, payload, mockDataRequest.team_id);

      expect(createStub).to.have.been.calledOnceWith(mockDataRequest.team_id, mockDataRequest.requested_by, payload);
      expect(result).to.deep.equal(mockDataRequestWithStatus);
    });

    it('should return a response containing the data_request_id', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      const payload: CreateDataRequest = { reason: 'New research project' };
      sinon.stub(DataRequestRepository.prototype, 'createDataRequest').resolves(mockDataRequest);
      sinon.stub(DataRequestRepository.prototype, 'createDataRequestStatus').resolves(mockDataRequestStatus);

      const result = await service.createDataRequest(mockDataRequest.requested_by, payload, mockDataRequest.team_id);

      expect(result.data_request_id).to.equal(mockDataRequest.data_request_id);
    });

    it('should set the initial status to REQUESTED', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      const payload: CreateDataRequest = { reason: 'New research project' };
      sinon.stub(DataRequestRepository.prototype, 'createDataRequest').resolves(mockDataRequest);
      const statusStub = sinon
        .stub(DataRequestRepository.prototype, 'createDataRequestStatus')
        .resolves(mockDataRequestStatus);

      await service.createDataRequest(mockDataRequest.requested_by, payload, mockDataRequest.team_id);

      expect(statusStub).to.have.been.calledOnceWith(
        mockDataRequest.data_request_id,
        DataRequestStatusEnum.enum.REQUESTED,
        null
      );
    });

    it('should propagate repository errors', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      const payload: CreateDataRequest = { reason: 'Test' };
      sinon.stub(DataRequestRepository.prototype, 'createDataRequest').rejects(new Error('DB error'));

      try {
        await service.createDataRequest(1, payload, 'team-id');
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.message).to.equal('DB error');
      }
    });
  });

  describe('updateDataRequest', () => {
    describe('when the user is not authorized', () => {
      it('should throw HTTP 403 when user is not a system admin and not a team member', async () => {
        const mockDBConnection = getMockDBConnection({
          systemUserId: () => 99
        });
        const service = new DataRequestService(mockDBConnection);

        sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(mockDataRequest);
        sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(false);
        sinon.stub(DataRequestService.prototype, 'findTeamMember').resolves(null);

        const payload: UpdateDataRequest = { reason: 'Updated reason' };

        try {
          await service.updateDataRequest(mockDataRequest.data_request_id, payload);
          expect.fail('Expected HTTP403 to be thrown');
        } catch (err: any) {
          expect(err.status).to.equal(403);
          expect(err.message).to.equal('Access Denied');
        }
      });
    });

    describe('when the user is authorized as a system administrator', () => {
      it('should update and return the data request', async () => {
        const mockDBConnection = getMockDBConnection({
          systemUserId: () => 99
        });
        const service = new DataRequestService(mockDBConnection);

        sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(mockDataRequest);
        sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(true);
        const payload: UpdateDataRequest = { reason: 'Updated reason' };
        const updatedRequest: DataRequest = { ...mockDataRequest, reason: 'Updated reason' };
        const stub = sinon.stub(DataRequestRepository.prototype, 'updateDataRequest').resolves(updatedRequest);

        const result = await service.updateDataRequest(mockDataRequest.data_request_id, payload);

        expect(stub).to.have.been.calledOnceWith(mockDataRequest.data_request_id, payload);
        expect(result).to.deep.equal(updatedRequest);
      });
    });

    describe('when the user is authorized as a team member but not a system administrator', () => {
      it('should update and return the data request', async () => {
        const mockDBConnection = getMockDBConnection({
          systemUserId: () => mockTeamMember.system_user_id
        });
        const service = new DataRequestService(mockDBConnection);

        sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(mockDataRequest);
        sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(false);
        sinon.stub(DataRequestService.prototype, 'findTeamMember').resolves(mockTeamMember);
        const payload: UpdateDataRequest = { reason: 'Updated reason' };
        const updatedRequest: DataRequest = { ...mockDataRequest, reason: 'Updated reason' };
        const stub = sinon.stub(DataRequestRepository.prototype, 'updateDataRequest').resolves(updatedRequest);

        const result = await service.updateDataRequest(mockDataRequest.data_request_id, payload);

        expect(stub).to.have.been.calledOnceWith(mockDataRequest.data_request_id, payload);
        expect(result).to.deep.equal(updatedRequest);
      });
    });

    it('should propagate repository errors', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      sinon.stub(DataRequestService.prototype, '_authorizeAccessForDataRequest').resolves(true);
      sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(mockDataRequest);
      const payload: UpdateDataRequest = { reason: 'Updated' };
      sinon.stub(DataRequestRepository.prototype, 'updateDataRequest').rejects(new Error('DB error'));

      try {
        await service.updateDataRequest(mockDataRequest.data_request_id, payload);
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.message).to.equal('DB error');
      }
    });
  });

  describe('deleteDataRequest', () => {
    describe('when the user is not authorized', () => {
      it('should throw HTTP 403 when user is not a system admin and not a team member', async () => {
        const mockDBConnection = getMockDBConnection({
          systemUserId: () => 99
        });
        const service = new DataRequestService(mockDBConnection);

        sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(mockDataRequest);
        sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(false);
        sinon.stub(DataRequestService.prototype, 'findTeamMember').resolves(null);

        try {
          await service.deleteDataRequest(mockDataRequest.data_request_id);
          expect.fail('Expected HTTP403 to be thrown');
        } catch (err: any) {
          expect(err.status).to.equal(403);
          expect(err.message).to.equal('Access Denied');
        }
      });
    });

    describe('when the user is authorized as a system administrator', () => {
      it('should delete the data request successfully', async () => {
        const mockDBConnection = getMockDBConnection({
          systemUserId: () => 99
        });
        const service = new DataRequestService(mockDBConnection);

        sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(mockDataRequest);
        sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(true);
        const stub = sinon.stub(DataRequestRepository.prototype, 'deleteDataRequest').resolves();

        await service.deleteDataRequest(mockDataRequest.data_request_id);

        expect(stub).to.have.been.calledOnceWith(mockDataRequest.data_request_id);
      });
    });

    describe('when the user is authorized as a team member but not a system administrator', () => {
      it('should delete the data request successfully', async () => {
        const mockDBConnection = getMockDBConnection({
          systemUserId: () => mockTeamMember.system_user_id
        });
        const service = new DataRequestService(mockDBConnection);

        sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(mockDataRequest);
        sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(false);
        sinon.stub(DataRequestService.prototype, 'findTeamMember').resolves(mockTeamMember);
        const stub = sinon.stub(DataRequestRepository.prototype, 'deleteDataRequest').resolves();

        await service.deleteDataRequest(mockDataRequest.data_request_id);

        expect(stub).to.have.been.calledOnceWith(mockDataRequest.data_request_id);
      });
    });

    it('should propagate repository errors', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      sinon.stub(DataRequestService.prototype, '_authorizeAccessForDataRequest').resolves(true);
      sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(mockDataRequest);
      sinon.stub(DataRequestRepository.prototype, 'deleteDataRequest').rejects(new Error('DB error'));

      try {
        await service.deleteDataRequest(mockDataRequest.data_request_id);
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.message).to.equal('DB error');
      }
    });
  });
});
