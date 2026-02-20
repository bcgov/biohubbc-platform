import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { DataRequestStatus, DataRequestStatusEnum } from '../models/data-request-status';
import { DataRequestStatusRepository } from '../repositories/data-request-status-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { DataRequestStatusService } from './data-request-status-service';

chai.use(sinonChai);

describe('DataRequestStatusService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockDataRequestStatus: DataRequestStatus = {
    data_request_status_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    data_request_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    comment_id: null,
    request_status: 'REQUESTED'
  };

  describe('getDataRequestStatusById', () => {
    it('should return a data request status for a given dataRequestStatusId', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestStatusService(mockDB);

      const stub = sinon
        .stub(DataRequestStatusRepository.prototype, 'getDataRequestStatusById')
        .resolves(mockDataRequestStatus);

      const result = await service.getDataRequestStatusById(mockDataRequestStatus.data_request_status_id);

      expect(stub).to.have.been.calledOnceWith(mockDataRequestStatus.data_request_status_id);
      expect(result).to.deep.equal(mockDataRequestStatus);
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestStatusService(mockDB);

      sinon.stub(DataRequestStatusRepository.prototype, 'getDataRequestStatusById').rejects(new Error('DB error'));

      try {
        await service.getDataRequestStatusById('some-id');
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as Error).message).to.equal('DB error');
      }
    });
  });

  describe('createDataRequestStatus', () => {
    it('should create a data request status with all parameters provided', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestStatusService(mockDB);

      const commentId = 'd4e5f6a7-b8c9-0123-defa-234567890123';
      const statusWithComment = { ...mockDataRequestStatus, comment_id: commentId };
      const stub = sinon
        .stub(DataRequestStatusRepository.prototype, 'createDataRequestStatus')
        .resolves(statusWithComment);

      const result = await service.createDataRequestStatus(
        mockDataRequestStatus.data_request_id,
        DataRequestStatusEnum.enum.REQUESTED,
        commentId
      );

      expect(stub).to.have.been.calledOnceWith(
        mockDataRequestStatus.data_request_id,
        DataRequestStatusEnum.enum.REQUESTED,
        commentId
      );
      expect(result).to.deep.equal(statusWithComment);
    });

    it('should create a data request status with default values when only dataRequestId provided', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestStatusService(mockDB);

      const stub = sinon
        .stub(DataRequestStatusRepository.prototype, 'createDataRequestStatus')
        .resolves(mockDataRequestStatus);

      const result = await service.createDataRequestStatus(mockDataRequestStatus.data_request_id);

      expect(stub).to.have.been.calledOnceWith(
        mockDataRequestStatus.data_request_id,
        DataRequestStatusEnum.enum.REQUESTED,
        null
      );
      expect(result).to.deep.equal(mockDataRequestStatus);
    });

    it('should create a data request status with custom status', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestStatusService(mockDB);

      const approvedStatus = { ...mockDataRequestStatus, request_status: 'APPROVED' as const };
      const stub = sinon
        .stub(DataRequestStatusRepository.prototype, 'createDataRequestStatus')
        .resolves(approvedStatus);

      const result = await service.createDataRequestStatus(
        mockDataRequestStatus.data_request_id,
        DataRequestStatusEnum.enum.APPROVED
      );

      expect(stub).to.have.been.calledOnceWith(
        mockDataRequestStatus.data_request_id,
        DataRequestStatusEnum.enum.APPROVED,
        null
      );
      expect(result).to.deep.equal(approvedStatus);
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestStatusService(mockDB);

      sinon.stub(DataRequestStatusRepository.prototype, 'createDataRequestStatus').rejects(new Error('DB error'));

      try {
        await service.createDataRequestStatus('some-id');
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as Error).message).to.equal('DB error');
      }
    });
  });

  describe('updateDataRequestStatus', () => {
    it('should update data request status with provided requestStatus', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestStatusService(mockDB);

      const approvedStatus = { ...mockDataRequestStatus, request_status: 'APPROVED' as const };
      const stub = sinon
        .stub(DataRequestStatusRepository.prototype, 'updateDataRequestStatus')
        .resolves(approvedStatus);

      const result = await service.updateDataRequestStatus(
        mockDataRequestStatus.data_request_status_id,
        DataRequestStatusEnum.enum.APPROVED
      );

      expect(stub).to.have.been.calledOnceWith(mockDataRequestStatus.data_request_status_id, {
        request_status: DataRequestStatusEnum.enum.APPROVED
      });
      expect(result).to.deep.equal(approvedStatus);
    });

    it('should update data request status with default REQUESTED when no status provided', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestStatusService(mockDB);

      const stub = sinon
        .stub(DataRequestStatusRepository.prototype, 'updateDataRequestStatus')
        .resolves(mockDataRequestStatus);

      const result = await service.updateDataRequestStatus(mockDataRequestStatus.data_request_status_id);

      expect(stub).to.have.been.calledOnceWith(mockDataRequestStatus.data_request_status_id, {
        request_status: DataRequestStatusEnum.enum.REQUESTED
      });
      expect(result).to.deep.equal(mockDataRequestStatus);
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new DataRequestStatusService(mockDB);

      sinon.stub(DataRequestStatusRepository.prototype, 'updateDataRequestStatus').rejects(new Error('DB error'));

      try {
        await service.updateDataRequestStatus('some-id');
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as Error).message).to.equal('DB error');
      }
    });
  });
});
