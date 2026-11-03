import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getDataRequestRecipients } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { ApiNotFoundError } from '../../../../../errors/api-error';
import { DataRequestService } from '../../../../../services/data-request-service';

chai.use(sinonChai);

describe('administrative/data-requests/{dataRequestId}/recipients', () => {
  afterEach(() => {
    sinon.restore();
  });

  const dataRequestId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  describe('GET/getDataRequestRecipients', () => {
    it('returns the recipients', async () => {
      const mockDBConnection = getMockDBConnection({ commit: sinon.stub(), release: sinon.stub() });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const recipients = [
        { system_user_id: 1, user_identifier: 'ruser', display_name: 'User, Robin', email: 'robin@example.com' }
      ];
      const getStub = sinon.stub(DataRequestService.prototype, 'getDataRequestRecipients').resolves(recipients);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { dataRequestId };

      await getDataRequestRecipients()(mockReq, mockRes, mockNext);

      expect(getStub).to.have.been.calledOnceWith(dataRequestId);
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({ recipients });
    });

    it('rolls back and rethrows when the data request does not exist', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon
        .stub(DataRequestService.prototype, 'getDataRequestRecipients')
        .rejects(new ApiNotFoundError('Data request not found'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { dataRequestId };

      try {
        await getDataRequestRecipients()(mockReq, mockRes, mockNext);
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
