import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import * as db from '../../database/db';
import { HTTPError } from '../../errors/http-error';
import { UserService } from '../../services/user-service';
import * as user_endpoint from './{systemUserId}';

chai.use(sinonChai);

describe('updateSystemUser', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should throw a 400 error when record_end_date is missing', async () => {
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = { systemUserId: '1' };
    mockReq.body = {};

    try {
      const requestHandler = user_endpoint.updateSystemUser();

      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).status).to.equal(400);
      expect((actualError as HTTPError).message).to.equal('Missing required body param: record_end_date');
    }
  });

  it('should catch and re-throw an error if the database fails to update the system user', async () => {
    const dbConnectionObj = getMockDBConnection();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = { systemUserId: '1' };
    mockReq.body = { record_end_date: '2026-01-01T00:00:00.000Z' };

    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    const expectedError = new Error('A database error');
    sinon.stub(UserService.prototype, 'updateSystemUser').rejects(expectedError);

    try {
      const requestHandler = user_endpoint.updateSystemUser();

      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect(actualError).to.equal(expectedError);
    }
  });

  it('should return 200 on success', async () => {
    const dbConnectionObj = getMockDBConnection();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = { systemUserId: '1' };
    mockReq.body = { record_end_date: null };

    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    const updateSystemUserStub = sinon.stub(UserService.prototype, 'updateSystemUser').resolves();

    const requestHandler = user_endpoint.updateSystemUser();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(updateSystemUserStub).to.have.been.calledOnceWith(1, { record_end_date: null });
  });
});
