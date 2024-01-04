import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { HTTPError } from '../../../errors/http-error';
import { UserService } from '../../../services/user-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as delete_endpoint from './delete';

chai.use(sinonChai);

describe('removeSystemUser', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should throw a 400 error when user record has expired', async () => {
    const dbConnectionObj = getMockDBConnection();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = { userId: '1' };
    mockReq.body = { roles: [1, 2] };

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    sinon.stub(UserService.prototype, 'getUserById').resolves({
      system_user_id: 1,
      user_identifier: 'testname',
      user_identity_source_id: 2,
      user_guid: '123-456-789',
      identity_source: 'idir',
      record_effective_date: '2010-10-10',
      record_end_date: '2010-10-10',
      create_user: 1,
      create_date: '',
      update_user: null,
      update_date: null,
      revision_count: 0,
      role_ids: [1, 2],
      role_names: ['role 1', 'role 2']
    });

    try {
      const requestHandler = delete_endpoint.removeSystemUser();

      await requestHandler(mockReq, mockRes, mockNext);

      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).status).to.equal(400);
      expect((actualError as HTTPError).message).to.equal('The system user is not active');
    }
  });

  it('should catch and re-throw an error if the database fails to delete all system roles', async () => {
    const dbConnectionObj = getMockDBConnection();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = { userId: '1' };
    mockReq.body = { roles: [1, 2] };

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    sinon.stub(UserService.prototype, 'getUserById').resolves({
      system_user_id: 1,
      user_identifier: 'testname',
      user_identity_source_id: 2,
      user_guid: '123-456-789',
      identity_source: 'idir',
      record_effective_date: '2010-10-10',
      record_end_date: '',
      create_user: 1,
      create_date: '',
      update_user: null,
      update_date: null,
      revision_count: 0,
      role_ids: [1, 2],
      role_names: ['role 1', 'role 2']
    });

    const expectedError = new Error('A database error');
    sinon.stub(UserService.prototype, 'deleteUserSystemRoles').rejects(expectedError);

    try {
      const requestHandler = delete_endpoint.removeSystemUser();

      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect(actualError).to.equal(expectedError);
    }
  });

  it('should catch and re-throw an error if the database fails to deactivate the system user', async () => {
    const dbConnectionObj = getMockDBConnection();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = { userId: '1' };
    mockReq.body = { roles: [1, 2] };

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    sinon.stub(UserService.prototype, 'getUserById').resolves({
      system_user_id: 1,
      user_identifier: 'testname',
      user_identity_source_id: 2,
      user_guid: '123-456-789',
      identity_source: 'idir',
      record_effective_date: '2010-10-10',
      record_end_date: '',
      create_user: 1,
      create_date: '',
      update_user: null,
      update_date: null,
      revision_count: 0,
      role_ids: [1, 2],
      role_names: ['role 1', 'role 2']
    });

    sinon.stub(UserService.prototype, 'deleteUserSystemRoles').resolves();

    const expectedError = new Error('A database error');
    sinon.stub(UserService.prototype, 'deactivateSystemUser').rejects(expectedError);

    try {
      const requestHandler = delete_endpoint.removeSystemUser();

      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect(actualError).to.equal(expectedError);
    }
  });

  it('should return 200 on success', async () => {
    const dbConnectionObj = getMockDBConnection();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = { userId: '1' };
    mockReq.body = { roles: [1, 2] };

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    sinon.stub(UserService.prototype, 'getUserById').resolves({
      system_user_id: 1,
      user_identifier: 'testname',
      user_identity_source_id: 2,
      user_guid: '123-456-789',
      identity_source: 'idir',
      record_effective_date: '2010-10-10',
      record_end_date: '',
      create_user: 1,
      create_date: '',
      update_user: null,
      update_date: null,
      revision_count: 0,
      role_ids: [1, 2],
      role_names: ['role 1', 'role 2']
    });

    sinon.stub(UserService.prototype, 'deleteUserSystemRoles').resolves();
    sinon.stub(UserService.prototype, 'deactivateSystemUser').resolves();

    const requestHandler = delete_endpoint.removeSystemUser();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
  });
});
