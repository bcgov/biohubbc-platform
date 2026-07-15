import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { SYSTEM_IDENTITY_SOURCE } from '../constants/database';
import { SYSTEM_ROLE } from '../constants/roles';
import { ApiError } from '../errors/api-error';
import { HTTP401 } from '../errors/http-error';
import { SystemRoles, SystemUser, SystemUserExtended } from '../models/system-user';
import { UserRepository } from '../repositories/user-repository';
import { IUserProfile, UserService } from './user-service';

chai.use(sinonChai);

describe('UserService', () => {
  describe('getRoles', function () {
    afterEach(() => {
      sinon.restore();
    });

    it('returns all system roles', async function () {
      const mockDBConnection = getMockDBConnection();

      const mockResponseRow = [{ system_role_id: 1, name: 'admin' }];
      const mockUserRepository = sinon.stub(UserRepository.prototype, 'getRoles');
      mockUserRepository.resolves(mockResponseRow as SystemRoles[]);

      const userService = new UserService(mockDBConnection);

      const result = await userService.getRoles();

      expect(result).to.eql(mockResponseRow);
      expect(mockUserRepository).to.have.been.calledOnce;
    });
  });

  describe('getUserById', function () {
    afterEach(() => {
      sinon.restore();
    });

    it('returns a system user', async function () {
      const mockDBConnection = getMockDBConnection();

      const mockResponseRow = { system_user_id: 123 };
      const mockUserRepository = sinon.stub(UserRepository.prototype, 'getUserById');
      mockUserRepository.resolves(mockResponseRow as unknown as SystemUserExtended);

      const userService = new UserService(mockDBConnection);

      const result = await userService.getUserById(1);

      expect(result).to.eql(mockResponseRow);
      expect(mockUserRepository).to.have.been.calledOnce;
    });
  });

  describe('getUserByGuid', function () {
    afterEach(() => {
      sinon.restore();
    });

    it('returns null if the query response has no rows', async function () {
      const mockDBConnection = getMockDBConnection();
      const mockUserRepository = sinon.stub(UserRepository.prototype, 'getUserByGuid');
      mockUserRepository.resolves([]);

      const userService = new UserService(mockDBConnection);

      const result = await userService.getUserByGuid('123-456-789');

      expect(result).to.be.null;
      expect(mockUserRepository).to.have.been.calledOnce;
    });

    it('returns a system user for the first row of the response', async function () {
      const mockDBConnection = getMockDBConnection();

      const mockResponseRow = [{ system_user_id: 123 }];
      const mockUserRepository = sinon.stub(UserRepository.prototype, 'getUserByGuid');
      mockUserRepository.resolves(mockResponseRow as unknown as SystemUserExtended[]);

      const userService = new UserService(mockDBConnection);

      const result = await userService.getUserByGuid('123-456-789');

      expect(result).to.eql(mockResponseRow[0]);
      expect(mockUserRepository).to.have.been.calledOnce;
    });
  });

  describe('isSystemUserAdmin', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should not be an admin', async () => {
      const mockDBConnection = getMockDBConnection();
      const userService = new UserService(mockDBConnection);
      const mockUserObject = {
        role_names: [],
        display_name: null,
        given_name: null,
        family_name: null,
        email: null,
        agency: null,
        notes: null
      } as unknown as SystemUserExtended;
      sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

      const isAdmin = await userService.isSystemUserAdmin();
      expect(isAdmin).to.be.false;
    });

    it('should be an admin as data admin', async () => {
      const mockDBConnection = getMockDBConnection();
      const userService = new UserService(mockDBConnection);
      const mockUserObject = {
        role_names: [SYSTEM_ROLE.DATA_ADMINISTRATOR],
        display_name: null,
        given_name: null,
        family_name: null,
        email: null,
        agency: null,
        notes: null
      } as unknown as SystemUserExtended;
      sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

      const isAdmin = await userService.isSystemUserAdmin();
      expect(isAdmin).to.be.true;
    });

    it('should be an admin as system admin', async () => {
      const mockDBConnection = getMockDBConnection();
      const userService = new UserService(mockDBConnection);
      const mockUserObject = {
        role_names: [SYSTEM_ROLE.SYSTEM_ADMIN],
        display_name: null,
        given_name: null,
        family_name: null,
        email: null,
        agency: null,
        notes: null
      } as unknown as SystemUserExtended;
      sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

      const isAdmin = await userService.isSystemUserAdmin();
      expect(isAdmin).to.be.true;
    });
  });

  describe('addSystemUser', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should not throw an error on success', async () => {
      const mockDBConnection = getMockDBConnection();

      const mockRowObj = { system_user_id: 123 };
      const mockUserRepository = sinon.stub(UserRepository.prototype, 'addSystemUser');
      mockUserRepository.resolves(mockRowObj as unknown as SystemUserExtended);

      const userService = new UserService(mockDBConnection);

      const userIdentifier = 'username';
      const userGuid = '123-456-789';
      const identitySource = SYSTEM_IDENTITY_SOURCE.IDIR;

      const result = await userService.addSystemUser(userGuid, userIdentifier, identitySource);

      expect(result).to.eql(mockRowObj);
      expect(mockUserRepository).to.have.been.calledOnce;
    });
  });

  describe('listSystemUsers', function () {
    afterEach(() => {
      sinon.restore();
    });

    it('returns empty array if the query response has no rows', async function () {
      const mockDBConnection = getMockDBConnection();
      const mockUserRepository = sinon.stub(UserRepository.prototype, 'listSystemUsers');
      mockUserRepository.resolves([]);

      const userService = new UserService(mockDBConnection);

      const result = await userService.listSystemUsers();

      expect(result).to.eql([]);
    });

    it('returns a system user for each row of the response', async function () {
      const mockDBConnection = getMockDBConnection();

      const mockResponseRows = [{ system_user_id: 123 }, { system_user_id: 456 }, { system_user_id: 789 }];
      const mockUserRepository = sinon.stub(UserRepository.prototype, 'listSystemUsers');
      mockUserRepository.resolves(mockResponseRows as SystemUserExtended[]);

      const userService = new UserService(mockDBConnection);

      const result = await userService.listSystemUsers();

      expect(result).to.eql([mockResponseRows[0], mockResponseRows[1], mockResponseRows[2]]);
    });
  });

  describe('getSystemUsersCount', function () {
    afterEach(() => {
      sinon.restore();
    });

    it('returns the system users count', async function () {
      const mockDBConnection = getMockDBConnection();
      const mockUserRepository = sinon.stub(UserRepository.prototype, 'getSystemUsersCount');
      mockUserRepository.resolves(3);

      const userService = new UserService(mockDBConnection);

      const result = await userService.getSystemUsersCount('search');

      expect(result).to.equal(3);
      expect(mockUserRepository).to.have.been.calledOnceWith('search');
    });
  });

  describe('ensureSystemUser', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws an error if it fails to get the current system user id', async () => {
      const mockDBConnection = getMockDBConnection({ systemUserId: () => null as unknown as number });

      const existingSystemUser = null;
      const getUserByGuidStub = sinon.stub(UserService.prototype, 'getUserByGuid').resolves(existingSystemUser);

      const addSystemUserStub = sinon.stub(UserService.prototype, 'addSystemUser');
      const userIdentifier = 'username';
      const userGuid = '123-456-789';
      const identitySource = SYSTEM_IDENTITY_SOURCE.IDIR;

      const userService = new UserService(mockDBConnection);

      try {
        await userService.ensureSystemUser(userGuid, userIdentifier, identitySource);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiError).message).to.equal('Failed to identify system user ID');
      }

      expect(getUserByGuidStub).to.have.been.calledOnce;
      expect(addSystemUserStub).not.to.have.been.called;
    });

    it('adds a new system user if one does not already exist', async () => {
      const mockDBConnection = getMockDBConnection({ systemUserId: () => 1 });

      const existingSystemUser = null;
      const getUserByGuidStub = sinon.stub(UserService.prototype, 'getUserByGuid').resolves(existingSystemUser);

      const addedSystemUser = { system_user_id: 2, record_end_date: null };
      const addSystemUserStub = sinon
        .stub(UserService.prototype, 'addSystemUser')
        .resolves(addedSystemUser as unknown as SystemUser);

      const getUserById = sinon
        .stub(UserService.prototype, 'getUserById')
        .resolves(addedSystemUser as unknown as SystemUserExtended);

      const userIdentifier = 'username';
      const userGuid = 'aaaa';
      const identitySource = SYSTEM_IDENTITY_SOURCE.IDIR;

      const userService = new UserService(mockDBConnection);

      const result = await userService.ensureSystemUser(userGuid, userIdentifier, identitySource);

      expect(result.system_user_id).to.equal(2);
      expect(result.record_end_date).to.equal(null);

      expect(getUserByGuidStub).to.have.been.calledOnce;
      expect(addSystemUserStub).to.have.been.calledOnce;
      expect(getUserById).to.have.been.calledOnce;
    });

    it('gets an existing system user that is already activate', async () => {
      const mockDBConnection = getMockDBConnection({ systemUserId: () => 1 });

      const existingInactiveSystemUser: SystemUserExtended = {
        system_user_id: 2,
        user_identifier: 'username',
        user_identity_source_id: 2,
        identity_source: SYSTEM_IDENTITY_SOURCE.IDIR,
        user_guid: '',
        record_effective_date: '2020-10-10',
        record_end_date: null,
        role_ids: [1],
        create_user: 1,
        create_date: '',
        update_user: null,
        update_date: null,
        revision_count: 0,
        role_names: ['Collaborator'],
        display_name: null,
        given_name: null,
        family_name: null,
        email: null,
        agency: null,
        notes: null
      };

      const getUserByGuidStub = sinon.stub(UserService.prototype, 'getUserByGuid').resolves(existingInactiveSystemUser);

      const addSystemUserStub = sinon.stub(UserService.prototype, 'addSystemUser');

      const userIdentifier = 'username';
      const userGuid = 'aaaa';
      const identitySource = SYSTEM_IDENTITY_SOURCE.IDIR;

      const userService = new UserService(mockDBConnection);

      const result = await userService.ensureSystemUser(userGuid, userIdentifier, identitySource);

      expect(result.system_user_id).to.equal(2);
      expect(result.record_end_date).to.equal(null);

      expect(getUserByGuidStub).to.have.been.calledOnce;
      expect(addSystemUserStub).not.to.have.been.called;
    });

    it('throws HTTP401 for an existing system user that is blocked', async () => {
      const mockDBConnection = getMockDBConnection({ systemUserId: () => 1 });

      const existingSystemUser: SystemUserExtended = {
        system_user_id: 2,
        user_identity_source_id: 2,
        user_identifier: 'username',
        identity_source: SYSTEM_IDENTITY_SOURCE.IDIR,
        user_guid: '',
        record_effective_date: '2020-10-10',
        record_end_date: '1900-01-01',
        create_user: 1,
        create_date: '',
        update_user: null,
        update_date: null,
        revision_count: 0,
        role_ids: [1],
        role_names: ['Collaborator'],
        display_name: null,
        given_name: null,
        family_name: null,
        email: null,
        agency: null,
        notes: null
      };

      const getUserByGuidStub = sinon.stub(UserService.prototype, 'getUserByGuid').resolves(existingSystemUser);

      const addSystemUserStub = sinon.stub(UserService.prototype, 'addSystemUser');

      const getUserByIdStub = sinon.stub(UserService.prototype, 'getUserById');

      const userIdentifier = 'username';
      const userGuid = 'aaaa';
      const identitySource = SYSTEM_IDENTITY_SOURCE.IDIR;

      const userService = new UserService(mockDBConnection);

      try {
        await userService.ensureSystemUser(userGuid, userIdentifier, identitySource);
        expect.fail('Expected HTTP401 to be thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP401);
        expect((error as HTTP401).message).to.equal('User account is inactive');
      }

      expect(getUserByGuidStub).to.have.been.calledOnce;
      expect(addSystemUserStub).not.to.have.been.called;
      expect(getUserByIdStub).not.to.have.been.called;
    });
  });

  describe('updateSystemUser', function () {
    afterEach(() => {
      sinon.restore();
    });

    it('returns nothing on success', async function () {
      const mockDBConnection = getMockDBConnection();
      const mockUserRepository = sinon.stub(UserRepository.prototype, 'updateSystemUser');
      mockUserRepository.resolves();

      const userService = new UserService(mockDBConnection);

      const updates = { record_end_date: null };
      const result = await userService.updateSystemUser(1, updates);

      expect(result).to.be.undefined;
      expect(mockUserRepository).to.have.been.calledOnceWith(1, updates);
    });
  });

  describe('deleteUserSystemRoles', function () {
    afterEach(() => {
      sinon.restore();
    });

    it('returns nothing on success', async function () {
      const mockDBConnection = getMockDBConnection();
      const mockUserRepository = sinon.stub(UserRepository.prototype, 'deleteUserSystemRoles');
      mockUserRepository.resolves();

      const userService = new UserService(mockDBConnection);

      const result = await userService.deleteUserSystemRoles(1);

      expect(result).to.be.undefined;
    });
  });

  describe('addUserSystemRoles', function () {
    afterEach(() => {
      sinon.restore();
    });

    it('returns nothing on success', async function () {
      const mockDBConnection = getMockDBConnection();
      const mockUserRepository = sinon.stub(UserRepository.prototype, 'addUserSystemRoles');
      mockUserRepository.resolves();

      const userService = new UserService(mockDBConnection);

      const result = await userService.addUserSystemRoles(1, [1]);

      expect(result).to.be.undefined;
    });
  });

  describe('addSystemUserWithRole', function () {
    afterEach(() => {
      sinon.restore();
    });

    it('creates a new user and assigns the specified role', async function () {
      const mockDBConnection = getMockDBConnection();

      const mockNewUser = { system_user_id: 123 } as SystemUser;
      const addSystemUserStub = sinon.stub(UserService.prototype, 'addSystemUser').resolves(mockNewUser);

      const mockRoles = [
        { system_role_id: 1, name: 'System Administrator' },
        { system_role_id: 2, name: 'Data Administrator' },
        { system_role_id: 3, name: 'Member' }
      ] as SystemRoles[];
      const getRolesStub = sinon.stub(UserService.prototype, 'getRoles').resolves(mockRoles);

      const addUserSystemRolesStub = sinon.stub(UserService.prototype, 'addUserSystemRoles').resolves();

      const mockUserWithRoles = {
        system_user_id: 123,
        role_ids: [3],
        role_names: ['Member'],
        display_name: null,
        given_name: null,
        family_name: null,
        email: null,
        agency: null,
        notes: null
      } as unknown as SystemUserExtended;
      const getUserByIdStub = sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserWithRoles);

      const userService = new UserService(mockDBConnection);

      const result = await userService.addSystemUserWithRole('guid-123', 'jsmith', 'IDIR', 'Member');

      expect(result).to.eql(mockUserWithRoles);
      expect(addSystemUserStub).to.have.been.calledOnceWith('guid-123', 'jsmith', 'IDIR');
      expect(getRolesStub).to.have.been.calledOnce;
      expect(addUserSystemRolesStub).to.have.been.calledOnceWith(123, [3]);
      expect(getUserByIdStub).to.have.been.calledOnceWith(123);
    });

    it('throws an error if the specified role is not found', async function () {
      const mockDBConnection = getMockDBConnection();

      const mockNewUser = { system_user_id: 123 } as SystemUser;
      sinon.stub(UserService.prototype, 'addSystemUser').resolves(mockNewUser);

      const mockRoles = [
        { system_role_id: 1, name: 'System Administrator' },
        { system_role_id: 2, name: 'Data Administrator' }
      ] as SystemRoles[];
      sinon.stub(UserService.prototype, 'getRoles').resolves(mockRoles);

      const userService = new UserService(mockDBConnection);

      try {
        await userService.addSystemUserWithRole('guid-123', 'jsmith', 'IDIR', 'NonExistentRole');
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('Failed to find role: NonExistentRole');
      }
    });
  });

  describe('updateSystemUserProfile', function () {
    afterEach(() => {
      sinon.restore();
    });

    it('calls repository updateSystemUserProfile with correct parameters', async function () {
      const mockDBConnection = getMockDBConnection();

      const updateProfileStub = sinon.stub(UserRepository.prototype, 'updateSystemUserProfile').resolves();

      const userService = new UserService(mockDBConnection);

      const profile: IUserProfile = {
        displayName: 'John Doe',
        email: 'john@example.com',
        givenName: 'John',
        familyName: 'Doe',
        agency: 'Ministry of Test'
      };

      await userService.updateSystemUserProfile(123, profile);

      expect(updateProfileStub).to.have.been.calledOnceWith(
        123,
        'John Doe',
        'john@example.com',
        'John',
        'Doe',
        'Ministry of Test'
      );
    });
  });

  describe('upsertSelf', function () {
    afterEach(() => {
      sinon.restore();
    });

    it('creates a new user with Member role when user does not exist', async function () {
      const mockDBConnection = getMockDBConnection();

      const getUserByGuidStub = sinon.stub(UserService.prototype, 'getUserByGuid').resolves(null);

      const mockNewUser: SystemUserExtended = {
        system_user_id: 123,
        user_identifier: 'jsmith',
        user_identity_source_id: 1,
        identity_source: SYSTEM_IDENTITY_SOURCE.IDIR,
        user_guid: 'guid-123',
        record_effective_date: '2024-01-01',
        record_end_date: null,
        role_ids: [3],
        role_names: [SYSTEM_ROLE.MEMBER],
        create_user: 1,
        create_date: '2024-01-01',
        update_user: null,
        update_date: null,
        revision_count: 0,
        display_name: 'John Doe',
        given_name: 'John',
        family_name: 'Doe',
        email: 'john@example.com',
        agency: null,
        notes: null
      };
      const addSystemUserWithRoleStub = sinon
        .stub(UserService.prototype, 'addSystemUserWithRole')
        .resolves(mockNewUser);

      const userService = new UserService(mockDBConnection);

      const profile: IUserProfile = {
        displayName: 'John Doe',
        email: 'john@example.com',
        givenName: 'John',
        familyName: 'Doe',
        agency: null
      };

      const result = await userService.upsertSelf('guid-123', 'jsmith', 'IDIR', profile);

      expect(result.created).to.be.true;
      expect(result.user.system_user_id).to.equal(123);
      expect(result.user.role_names).to.include(SYSTEM_ROLE.MEMBER);

      expect(getUserByGuidStub).to.have.been.calledOnceWith('guid-123');
      expect(addSystemUserWithRoleStub).to.have.been.calledOnceWith(
        'guid-123',
        'jsmith',
        'IDIR',
        SYSTEM_ROLE.MEMBER,
        profile
      );
    });

    it('updates profile and returns existing active user', async function () {
      const mockDBConnection = getMockDBConnection();

      const existingUser: SystemUserExtended = {
        system_user_id: 456,
        user_identifier: 'jdoe',
        user_identity_source_id: 1,
        identity_source: SYSTEM_IDENTITY_SOURCE.IDIR,
        user_guid: 'guid-456',
        record_effective_date: '2024-01-01',
        record_end_date: null,
        role_ids: [3],
        role_names: [SYSTEM_ROLE.MEMBER],
        create_user: 1,
        create_date: '2024-01-01',
        update_user: null,
        update_date: null,
        revision_count: 0,
        display_name: 'Old Name',
        given_name: 'Old',
        family_name: 'Name',
        email: 'old@example.com',
        agency: null,
        notes: null
      };
      const getUserByGuidStub = sinon.stub(UserService.prototype, 'getUserByGuid').resolves(existingUser);

      const updateProfileStub = sinon.stub(UserService.prototype, 'updateSystemUserProfile').resolves();

      const updatedUser: SystemUserExtended = {
        ...existingUser,
        display_name: 'Jane Doe',
        given_name: 'Jane',
        family_name: 'Doe',
        email: 'jane@example.com'
      };
      const getUserByIdStub = sinon.stub(UserService.prototype, 'getUserById').resolves(updatedUser);

      const userService = new UserService(mockDBConnection);

      const profile: IUserProfile = {
        displayName: 'Jane Doe',
        email: 'jane@example.com',
        givenName: 'Jane',
        familyName: 'Doe',
        agency: null
      };

      const result = await userService.upsertSelf('guid-456', 'jdoe', 'IDIR', profile);

      expect(result.created).to.be.false;
      expect(result.user.system_user_id).to.equal(456);
      expect(result.user.display_name).to.equal('Jane Doe');

      expect(getUserByGuidStub).to.have.been.calledOnceWith('guid-456');
      expect(updateProfileStub).to.have.been.calledOnceWith(456, profile);
      expect(getUserByIdStub).to.have.been.calledOnceWith(456);
    });

    it('throws HTTP401 for inactive user', async function () {
      const mockDBConnection = getMockDBConnection();

      const inactiveUser: SystemUserExtended = {
        system_user_id: 789,
        user_identifier: 'inactive',
        user_identity_source_id: 1,
        identity_source: SYSTEM_IDENTITY_SOURCE.IDIR,
        user_guid: 'guid-inactive',
        record_effective_date: '2024-01-01',
        record_end_date: '2024-06-01',
        role_ids: [],
        role_names: [],
        create_user: 1,
        create_date: '2024-01-01',
        update_user: null,
        update_date: null,
        revision_count: 0,
        display_name: 'Inactive User',
        given_name: 'Inactive',
        family_name: 'User',
        email: 'inactive@example.com',
        agency: null,
        notes: null
      };
      const getUserByGuidStub = sinon.stub(UserService.prototype, 'getUserByGuid').resolves(inactiveUser);

      const userService = new UserService(mockDBConnection);

      const profile: IUserProfile = {
        displayName: 'Inactive User',
        email: 'inactive@example.com',
        givenName: 'Inactive',
        familyName: 'User',
        agency: null
      };

      try {
        await userService.upsertSelf('guid-inactive', 'inactive', 'IDIR', profile);
        expect.fail('Expected HTTP401 to be thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP401);
        expect((error as HTTP401).message).to.equal('User account is inactive');
      }

      expect(getUserByGuidStub).to.have.been.calledOnceWith('guid-inactive');
    });
  });
});
