import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SYSTEM_IDENTITY_SOURCE } from '../../constants/database';
import * as db from '../../database/db';
import { HTTPError } from '../../errors/http-error';
import { UserRepository } from '../../repositories/user-repository';
import { UserService } from '../../services/user-service';
// import { UserService } from '../../services/user-service';
import * as keycloakUtils from '../../utils/keycloak-utils';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import * as self from './self';

chai.use(sinonChai);

describe('getUser', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should throw a 400 error when no system user id', async () => {
    const dbConnectionObj = getMockDBConnection();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    try {
      const requestHandler = self.getUser();

      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).status).to.equal(400);
      expect((actualError as HTTPError).message).to.equal("Failed to retrieve user's identifier or GUID");
    }
  });

  it('should return the user row on success', async () => {
    const dbConnectionObj = getMockDBConnection({ systemUserId: () => 1 });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    sinon.stub(keycloakUtils, 'getUserGuid').returns('aaaa');
    sinon.stub(keycloakUtils, 'getUserIdentitySource').returns(SYSTEM_IDENTITY_SOURCE.IDIR);
    sinon.stub(keycloakUtils, 'getUserIdentifier').returns('identifier');

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    sinon.stub(UserRepository.prototype, 'getUserByGuid').resolves([
      {
        system_user_id: 1,
        user_guid: 'aaaa',
        user_identifier: 'identifier',
        identity_source: 'idir',
        record_end_date: null,
        role_ids: [1, 2],
        role_names: ['role 1', 'role 2']
      }
    ]);

    const requestHandler = self.getUser();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.jsonValue.id).to.equal(1);
    expect(mockRes.jsonValue.user_guid).to.equal('aaaa');
    expect(mockRes.jsonValue.user_identifier).to.equal('identifier');
    expect(mockRes.jsonValue.identity_source).to.equal('idir');
    expect(mockRes.jsonValue.role_ids).to.eql([1, 2]);
    expect(mockRes.jsonValue.role_names).to.eql(['role 1', 'role 2']);
  });

  it('should parse out user guid, identifier and identity source from the keycloak token', async () => {
    const dbConnectionObj = getMockDBConnection({ systemUserId: () => 1 });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq['keycloak_token'] = {
      preferred_username: 'aaaa@idir',
      identity_source: 'idir',
      idir_username: 'username'
    };

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const userServiceStub = sinon.stub(UserService.prototype, 'getOrCreateSystemUser');

    const requestHandler = self.getUser();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(userServiceStub).to.be.calledWith('aaaa', 'username', SYSTEM_IDENTITY_SOURCE.IDIR);
  });

  it('should throw an error when a failure occurs', async () => {
    const dbConnectionObj = getMockDBConnection({ systemUserId: () => 1 });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const expectedError = new Error("Failed to retrieve user's identifier or GUID");

    sinon.stub(db, 'getDBConnection').returns({
      ...dbConnectionObj,
      systemUserId: () => {
        throw expectedError;
      }
    });

    try {
      const requestHandler = self.getUser();

      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).message).to.equal(expectedError.message);
    }
  });
});
