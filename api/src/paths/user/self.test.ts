import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import { SYSTEM_IDENTITY_SOURCE } from '../../constants/database';
import { SYSTEM_ROLE } from '../../constants/roles';
import { HTTP401, HTTPError } from '../../errors/http-error';
import { SystemUserExtended } from '../../repositories/user-repository';
import { UserService } from '../../services/user-service';
import * as self from './self';

chai.use(sinonChai);

type SelfDependencyStubOptions = {
  dbConnectionObj?: ReturnType<typeof getMockDBConnection>;
  userGuid?: string | null;
  userIdentifier?: string | null;
  userIdentitySource?: SYSTEM_IDENTITY_SOURCE;
  displayName?: string | null;
  email?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  agency?: string | null;
};

const stubSelfDependencies = ({
  dbConnectionObj = getMockDBConnection(),
  userGuid = '123-456-789',
  userIdentifier = 'testuser',
  userIdentitySource = SYSTEM_IDENTITY_SOURCE.IDIR,
  displayName = 'Test User',
  email = 'test@example.com',
  givenName = 'Test',
  familyName = 'User',
  agency = null
}: SelfDependencyStubOptions = {}) => {
  sinon.stub(self.selfDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
  sinon.stub(self.selfDependencies, 'getUserGuid').returns(userGuid);
  sinon.stub(self.selfDependencies, 'getUserIdentifier').returns(userIdentifier);
  sinon.stub(self.selfDependencies, 'getUserIdentitySource').returns(userIdentitySource);
  sinon.stub(self.selfDependencies, 'getDisplayName').returns(displayName);
  sinon.stub(self.selfDependencies, 'getEmail').returns(email);
  sinon.stub(self.selfDependencies, 'getGivenName').returns(givenName);
  sinon.stub(self.selfDependencies, 'getFamilyName').returns(familyName);
  sinon.stub(self.selfDependencies, 'getAgency').returns(agency);

  return dbConnectionObj;
};

describe('upsertUser', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should throw a 400 error when user GUID is missing from token', async () => {
    stubSelfDependencies({ userGuid: null });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    try {
      const requestHandler = self.upsertUser();

      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).status).to.equal(400);
      expect((actualError as HTTPError).message).to.equal('Failed to identify user GUID from token');
    }
  });

  it('should throw a 400 error when user identifier is missing from token', async () => {
    stubSelfDependencies({ userIdentifier: null });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    try {
      const requestHandler = self.upsertUser();

      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).status).to.equal(400);
      expect((actualError as HTTPError).message).to.equal('Failed to identify user identifier from token');
    }
  });

  it('should create a new user and return 201 when user does not exist', async () => {
    stubSelfDependencies();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const newUser = {
      system_user_id: 1,
      user_identity_source_id: 2,
      user_identifier: 'testuser',
      user_guid: '123-456-789',
      record_effective_date: 'date',
      record_end_date: null,
      create_date: 'date',
      create_user: 1,
      update_date: null,
      update_user: null,
      revision_count: 0,
      identity_source: 'IDIR',
      role_ids: [3],
      role_names: [SYSTEM_ROLE.MEMBER],
      display_name: 'Test User',
      given_name: 'Test',
      family_name: 'User',
      email: 'test@example.com',
      agency: null,
      notes: null
    } as SystemUserExtended;

    sinon.stub(UserService.prototype, 'upsertSelf').resolves({ user: newUser, created: true });

    const requestHandler = self.upsertUser();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue.system_user_id).to.equal(1);
    expect(mockRes.jsonValue.user_guid).to.equal('123-456-789');
    expect(mockRes.jsonValue.role_names).to.eql([SYSTEM_ROLE.MEMBER]);
    expect(mockRes.jsonValue.display_name).to.equal('Test User');
  });

  it('should update existing user and return 200 when user exists and is active', async () => {
    stubSelfDependencies({
      displayName: 'Updated Name',
      email: 'updated@example.com',
      givenName: 'Updated',
      familyName: 'Name'
    });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const updatedUser = {
      system_user_id: 1,
      user_identity_source_id: 2,
      user_identifier: 'testuser',
      user_guid: '123-456-789',
      record_effective_date: 'date',
      record_end_date: null,
      create_date: 'date',
      create_user: 1,
      update_date: 'date',
      update_user: 1,
      revision_count: 1,
      identity_source: 'IDIR',
      role_ids: [3],
      role_names: [SYSTEM_ROLE.MEMBER],
      display_name: 'Updated Name',
      given_name: 'Updated',
      family_name: 'Name',
      email: 'updated@example.com',
      agency: null,
      notes: null
    } as SystemUserExtended;

    sinon.stub(UserService.prototype, 'upsertSelf').resolves({ user: updatedUser, created: false });

    const requestHandler = self.upsertUser();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue.system_user_id).to.equal(1);
    expect(mockRes.jsonValue.display_name).to.equal('Updated Name');
    expect(mockRes.jsonValue.email).to.equal('updated@example.com');
  });

  it('should throw a 401 error when user is expired', async () => {
    stubSelfDependencies({
      displayName: 'Expired User',
      email: 'expired@example.com',
      givenName: 'Expired',
      familyName: 'User'
    });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const http401Error = new HTTP401('User account is expired or inactive');
    sinon.stub(UserService.prototype, 'upsertSelf').rejects(http401Error);

    try {
      const requestHandler = self.upsertUser();

      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).status).to.equal(401);
      expect((actualError as HTTPError).message).to.equal('User account is expired or inactive');
    }
  });

  it('should throw an error when a failure occurs', async () => {
    stubSelfDependencies();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const expectedError = new Error('cannot process query');

    sinon.stub(UserService.prototype, 'upsertSelf').rejects(expectedError);

    try {
      const requestHandler = self.upsertUser();

      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).message).to.equal(expectedError.message);
    }
  });
});
