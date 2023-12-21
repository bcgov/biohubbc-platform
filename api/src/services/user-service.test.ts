import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SYSTEM_IDENTITY_SOURCE } from '../constants/database';
import { SYSTEM_ROLE } from '../constants/roles';
import { ApiError } from '../errors/api-error';
import { SystemRoles, SystemUser, SystemUserExtended, UserRepository } from '../repositories/user-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { UserService } from './user-service';

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
      const mockUserObject = { role_names: [] } as unknown as SystemUserExtended;
      sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

      const isAdmin = await userService.isSystemUserAdmin();
      expect(isAdmin).to.be.false;
    });

    it('should be an admin as data admin', async () => {
      const mockDBConnection = getMockDBConnection();
      const userService = new UserService(mockDBConnection);
      const mockUserObject = { role_names: [SYSTEM_ROLE.DATA_ADMINISTRATOR] } as unknown as SystemUserExtended;
      sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

      const isAdmin = await userService.isSystemUserAdmin();
      expect(isAdmin).to.be.true;
    });

    it('should be an admin as system admin', async () => {
      const mockDBConnection = getMockDBConnection();
      const userService = new UserService(mockDBConnection);
      const mockUserObject = { role_names: [SYSTEM_ROLE.SYSTEM_ADMIN] } as unknown as SystemUserExtended;
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

  describe('ensureSystemUser', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws an error if it fails to get the current system user id', async () => {
      const mockDBConnection = getMockDBConnection({ systemUserId: () => null as unknown as number });

      const existingSystemUser = null;
      const getUserByGuidStub = sinon.stub(UserService.prototype, 'getUserByGuid').resolves(existingSystemUser);

      const addSystemUserStub = sinon.stub(UserService.prototype, 'addSystemUser');
      const activateSystemUserStub = sinon.stub(UserService.prototype, 'activateSystemUser');

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
      expect(activateSystemUserStub).not.to.have.been.called;
    });

    it('adds a new system user if one does not already exist', async () => {
      const mockDBConnection = getMockDBConnection({ systemUserId: () => 1 });

      const existingSystemUser = null;
      const getUserByGuidStub = sinon.stub(UserService.prototype, 'getUserByGuid').resolves(existingSystemUser);

      const addedSystemUser = { system_user_id: 2, record_end_date: null };
      const addSystemUserStub = sinon
        .stub(UserService.prototype, 'addSystemUser')
        .resolves(addedSystemUser as unknown as SystemUser);

      const activateSystemUserStub = sinon.stub(UserService.prototype, 'activateSystemUser');

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
      expect(activateSystemUserStub).not.to.have.been.called;
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
        role_names: ['Collaborator']
      };

      const getUserByGuidStub = sinon.stub(UserService.prototype, 'getUserByGuid').resolves(existingInactiveSystemUser);

      const addSystemUserStub = sinon.stub(UserService.prototype, 'addSystemUser');

      const activateSystemUserStub = sinon.stub(UserService.prototype, 'activateSystemUser');

      const userIdentifier = 'username';
      const userGuid = 'aaaa';
      const identitySource = SYSTEM_IDENTITY_SOURCE.IDIR;

      const userService = new UserService(mockDBConnection);

      const result = await userService.ensureSystemUser(userGuid, userIdentifier, identitySource);

      expect(result.system_user_id).to.equal(2);
      expect(result.record_end_date).to.equal(null);

      expect(getUserByGuidStub).to.have.been.calledOnce;
      expect(addSystemUserStub).not.to.have.been.called;
      expect(activateSystemUserStub).not.to.have.been.called;
    });

    it('gets an existing system user that is not already active and re-activates it', async () => {
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
        role_names: ['Collaborator']
      };

      const getUserByGuidStub = sinon.stub(UserService.prototype, 'getUserByGuid').resolves(existingSystemUser);

      const addSystemUserStub = sinon.stub(UserService.prototype, 'addSystemUser');

      const activateSystemUserStub = sinon.stub(UserService.prototype, 'activateSystemUser');

      const activatedSystemUser: SystemUserExtended = {
        system_user_id: 2,
        user_identity_source_id: 2,
        user_identifier: 'username',
        identity_source: SYSTEM_IDENTITY_SOURCE.IDIR,
        user_guid: '',
        record_effective_date: '2020-10-10',
        record_end_date: null,
        create_user: 1,
        create_date: '',
        update_user: null,
        update_date: null,
        revision_count: 0,
        role_ids: [1],
        role_names: ['Collaborator']
      };

      const getUserByIdStub = sinon.stub(UserService.prototype, 'getUserById').resolves(activatedSystemUser);

      const userIdentifier = 'username';
      const userGuid = 'aaaa';
      const identitySource = SYSTEM_IDENTITY_SOURCE.IDIR;

      const userService = new UserService(mockDBConnection);

      const result = await userService.ensureSystemUser(userGuid, userIdentifier, identitySource);

      expect(result.system_user_id).to.equal(2);
      expect(result.record_end_date).to.equal(null);

      expect(getUserByGuidStub).to.have.been.calledOnce;
      expect(addSystemUserStub).not.to.have.been.called;
      expect(activateSystemUserStub).to.have.been.calledOnce;
      expect(getUserByIdStub).to.have.been.calledOnce;
    });
  });

  describe('activateSystemUser', function () {
    afterEach(() => {
      sinon.restore();
    });

    it('returns nothing on success', async function () {
      const mockDBConnection = getMockDBConnection();
      const mockUserRepository = sinon.stub(UserRepository.prototype, 'activateSystemUser');
      mockUserRepository.resolves();

      const userService = new UserService(mockDBConnection);

      const result = await userService.activateSystemUser(1);

      expect(result).to.be.undefined;
    });
  });

  describe('deactivateSystemUser', function () {
    afterEach(() => {
      sinon.restore();
    });

    it('returns nothing on success', async function () {
      const mockDBConnection = getMockDBConnection();
      const mockUserRepository = sinon.stub(UserRepository.prototype, 'deactivateSystemUser');
      mockUserRepository.resolves();

      const userService = new UserService(mockDBConnection);

      const result = await userService.deactivateSystemUser(1);

      expect(result).to.be.undefined;
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
});
