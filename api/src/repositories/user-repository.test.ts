import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { SYSTEM_IDENTITY_SOURCE } from '../constants/database';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { UserRepository } from './user-repository';

chai.use(sinonChai);

describe('UserRepository', () => {
  describe('getRoles', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should get all roles', async () => {
      const mockResponse = [{ system_role_id: 1, name: 'admin' }];
      const mockQueryResponse = { rowCount: 1, rows: mockResponse } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      const response = await userRepository.getRoles();

      expect(response).to.equal(mockResponse);
    });
  });

  describe('getUserById', () => {
    afterEach(() => {
      sinon.restore();
    });
    it('should throw an error when no user is found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      try {
        await userRepository.getUserById(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiNotFoundError).message).to.equal('User not found');
      }
    });

    it('should get user by id', async () => {
      const mockResponse = [
        { system_user_id: 1, user_identifier: 1, record_end_date: 'data', role_ids: [1], role_names: ['admin'] }
      ];
      const mockQueryResponse = { rowCount: 1, rows: mockResponse } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      const response = await userRepository.getUserById(1);

      expect(response).to.equal(mockResponse[0]);
    });
  });

  describe('getUserByGuid', () => {
    afterEach(() => {
      sinon.restore();
    });
    it('should return empty array when no user found', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      const response = await userRepository.getUserByGuid('user');

      expect(response).to.eql([]);
    });

    it('should get user by guid', async () => {
      const mockResponse = [
        {
          system_user_id: 1,
          user_identifier: 1,
          user_guid: '123-456-789',
          identity_source: 'idir',
          record_end_date: 'data',
          role_ids: [1],
          role_names: ['admin']
        }
      ];
      const mockQueryResponse = { rowCount: 1, rows: mockResponse } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      const response = await userRepository.getUserByGuid('123-456-789');

      expect(response).to.equal(mockResponse);
    });

    it('should look up the user_guid case-insensitively', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;

      let capturedStatement: any;
      const mockDBConnection = getMockDBConnection({
        sql: async (statement: any) => {
          capturedStatement = statement;
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      await userRepository.getUserByGuid('ABC-123-DEF');

      expect(capturedStatement.text).to.contain('LOWER(su.user_guid)');
      expect(capturedStatement.values).to.contain('abc-123-def');
    });
  });

  describe('addSystemUser', () => {
    afterEach(() => {
      sinon.restore();
    });
    it('should throw an error when insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      try {
        await userRepository.addSystemUser({ userGuid: 'user-guid', userIdentifier: 'user', identitySource: 'idir' });
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiExecuteSQLError).message).to.equal('Failed to insert new user');
      }
    });

    it('should insert new user', async () => {
      const mockResponse = [
        {
          system_user_id: 1,
          user_identity_source_id: 1,
          user_identifier: 'user',
          user_guid: '123-456-789',
          record_end_date: 'data',
          record_effective_date: 'date'
        }
      ];
      const mockQueryResponse = { rowCount: 1, rows: mockResponse } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      const response = await userRepository.addSystemUser({
        userGuid: '123-456-789',
        userIdentifier: 'user',
        identitySource: 'idir'
      });

      expect(response).to.equal(mockResponse[0]);
    });

    it('should store the user_guid lowercased', async () => {
      const mockResponse = [{ system_user_id: 1 }];
      const mockQueryResponse = { rowCount: 1, rows: mockResponse } as any as Promise<QueryResult<any>>;

      let capturedStatement: any;
      const mockDBConnection = getMockDBConnection({
        sql: async (statement: any) => {
          capturedStatement = statement;
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      await userRepository.addSystemUser({
        userGuid: 'ABC-123-DEF',
        userIdentifier: 'user',
        identitySource: 'idir'
      });

      expect(capturedStatement.values).to.contain('abc-123-def');
      expect(capturedStatement.values).not.to.contain('ABC-123-DEF');
    });
  });

  describe('listSystemUsers', () => {
    afterEach(() => {
      sinon.restore();
    });
    it('should return empty array when no users found', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => {
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      const response = await userRepository.listSystemUsers();

      expect(response).to.eql([]);
    });

    it('should get user list', async () => {
      const mockResponse = [
        { system_user_id: 1, user_identifier: 1, record_end_date: 'data', role_ids: [1], role_names: ['admin'] }
      ];
      const mockQueryResponse = { rowCount: 1, rows: mockResponse } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => {
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      const response = await userRepository.listSystemUsers();

      expect(response).to.equal(mockResponse);
    });

    it('should include blocked users and exclude system and database users', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;

      let capturedQuery: any;
      const mockDBConnection = getMockDBConnection({
        knex: async (query: any) => {
          capturedQuery = query;
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      await userRepository.listSystemUsers();

      const sql = capturedQuery.toSQL();
      expect(sql.sql).not.to.contain('su.record_end_date is null');
      expect(sql.sql).to.contain('"uis"."name"');
      expect(sql.bindings).to.contain(SYSTEM_IDENTITY_SOURCE.SYSTEM);
      expect(sql.bindings).to.contain(SYSTEM_IDENTITY_SOURCE.DATABASE);
    });
  });

  describe('getAvailableUsers', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return available users including display_name', async () => {
      const mockResponse = [
        { system_user_id: 1, user_identifier: 'testuser', display_name: 'User, Test WLRS:EX' },
        { system_user_id: 2, user_identifier: 'anotheruser', display_name: null }
      ];
      const mockQueryResponse = { rowCount: 2, rows: mockResponse } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => {
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      const response = await userRepository.getAvailableUsers();

      expect(response).to.equal(mockResponse);
    });

    it('should filter by user_identifier or display_name and order by display label', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;

      const knexStub = sinon.stub().resolves(mockQueryResponse);

      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const userRepository = new UserRepository(mockDBConnection);

      await userRepository.getAvailableUsers('bryan');

      const generatedQuery = knexStub.getCall(0).args[0].toString().toLowerCase();

      expect(generatedQuery).to.contain(`"su"."user_identifier" ilike '%bryan%'`);
      expect(generatedQuery).to.contain(`"su"."display_name" ilike '%bryan%'`);
      expect(generatedQuery).to.contain('coalesce(su.display_name, su.user_identifier)');
    });

    it('should not apply a search filter when search is undefined', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;

      const knexStub = sinon.stub().resolves(mockQueryResponse);

      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const userRepository = new UserRepository(mockDBConnection);

      await userRepository.getAvailableUsers();

      const generatedQuery = knexStub.getCall(0).args[0].toString().toLowerCase();

      expect(generatedQuery).to.not.contain('ilike');
    });
  });

  describe('getSystemUsersCount', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return user count', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ count: 3 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => {
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      const response = await userRepository.getSystemUsersCount();

      expect(response).to.equal(3);
    });
  });

  describe('updateSystemUser', () => {
    afterEach(() => {
      sinon.restore();
    });
    it('should throw an error when update fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      try {
        await userRepository.updateSystemUser(1, { record_end_date: null });
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiExecuteSQLError).message).to.equal('Failed to update system user');
      }
    });

    it('should update system user fields', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [] } as any as Promise<QueryResult<any>>;

      let capturedStatement: any;
      const mockDBConnection = getMockDBConnection({
        sql: async (statement: any) => {
          capturedStatement = statement;
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      const response = await userRepository.updateSystemUser(1, { record_end_date: '2026-01-01T00:00:00.000Z' });

      expect(response).to.equal(undefined);
      expect(capturedStatement.text).to.contain('record_end_date =');
      expect(capturedStatement.values).to.contain('2026-01-01T00:00:00.000Z');
    });
  });

  describe('deleteUserSystemRoles', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should delete user roles', async () => {
      const mockResponse = [
        {
          system_user_id: 1,
          user_identity_source_id: 1,
          user_identifier: 1,
          record_end_date: 'data',
          record_effective_date: 'date'
        }
      ];
      const mockQueryResponse = { rowCount: 1, rows: mockResponse } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      const response = await userRepository.deleteUserSystemRoles(1);

      expect(response).to.equal(undefined);
    });
  });

  describe('addUserSystemRoles', () => {
    afterEach(() => {
      sinon.restore();
    });
    it('should throw an error when adding role fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      try {
        await userRepository.addUserSystemRoles(1, [1]);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiExecuteSQLError).message).to.equal('Failed to insert user system roles');
      }
    });

    it('should add user roles', async () => {
      const mockResponse = [
        {
          system_user_id: 1,
          user_identity_source_id: 1,
          user_identifier: 1,
          record_end_date: 'data',
          record_effective_date: 'date'
        }
      ];
      const mockQueryResponse = { rowCount: 1, rows: mockResponse } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      const response = await userRepository.addUserSystemRoles(1, [1, 2]);

      expect(response).to.equal(undefined);
    });
  });

  describe('updateSystemUserProfile', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when update fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      try {
        await userRepository.updateSystemUserProfile(1, 'Display Name', 'email@test.com', 'Given', 'Family', 'Agency');
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiExecuteSQLError).message).to.equal('Failed to update system user profile');
      }
    });

    it('should update user profile', async () => {
      const mockResponse = [
        {
          system_user_id: 1,
          user_identity_source_id: 1,
          user_identifier: 'user',
          user_guid: '123-456-789',
          record_end_date: null,
          record_effective_date: 'date',
          display_name: 'Display Name',
          email: 'email@test.com',
          given_name: 'Given',
          family_name: 'Family',
          agency: 'Agency'
        }
      ];
      const mockQueryResponse = { rowCount: 1, rows: mockResponse } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      const response = await userRepository.updateSystemUserProfile(
        1,
        'Display Name',
        'email@test.com',
        'Given',
        'Family',
        'Agency'
      );

      expect(response).to.equal(undefined);
    });

    it('should update user profile with null values', async () => {
      const mockResponse = [
        {
          system_user_id: 1,
          user_identity_source_id: 1,
          user_identifier: 'user',
          user_guid: '123-456-789',
          record_end_date: null,
          record_effective_date: 'date',
          display_name: null,
          email: null,
          given_name: null,
          family_name: null,
          agency: null
        }
      ];
      const mockQueryResponse = { rowCount: 1, rows: mockResponse } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const userRepository = new UserRepository(mockDBConnection);

      const response = await userRepository.updateSystemUserProfile(1, null, null, null, null, null);

      expect(response).to.equal(undefined);
    });
  });
});
