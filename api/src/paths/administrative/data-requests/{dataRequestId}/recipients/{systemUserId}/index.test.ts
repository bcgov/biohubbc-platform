import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { deleteDataRequestRecipient } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import * as db from '../../../../../../database/db';
import { ApiNotFoundError } from '../../../../../../errors/api-error';
import { DataRequestService } from '../../../../../../services/data-request-service';

chai.use(sinonChai);

describe('administrative/data-requests/{dataRequestId}/recipients/{systemUserId}', () => {
  afterEach(() => {
    sinon.restore();
  });

  const dataRequestId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  describe('DELETE/deleteDataRequestRecipient', () => {
    it('removes the recipient and returns 204', async () => {
      const mockDBConnection = getMockDBConnection({ commit: sinon.stub(), release: sinon.stub() });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const deleteStub = sinon.stub(DataRequestService.prototype, 'deleteDataRequestRecipient').resolves();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { dataRequestId, systemUserId: '42' };

      await deleteDataRequestRecipient()(mockReq, mockRes, mockNext);

      expect(deleteStub).to.have.been.calledOnceWith(dataRequestId, 42);
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(204);
    });

    it('rolls back and rethrows when the data request does not exist', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon
        .stub(DataRequestService.prototype, 'deleteDataRequestRecipient')
        .rejects(new ApiNotFoundError('Data request not found'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { dataRequestId, systemUserId: '42' };

      try {
        await deleteDataRequestRecipient()(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('Data request not found');
        expect(mockDBConnection.commit).not.to.have.been.called;
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });
  });
});
