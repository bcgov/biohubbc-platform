import axios, { AxiosInstance } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import useUserApi from './useUserApi';

describe('useUserApi', () => {
  let mock: MockAdapter;
  let axiosInstance: AxiosInstance;

  beforeEach(() => {
    axiosInstance = axios.create();
    mock = new MockAdapter(axiosInstance);
  });

  afterEach(() => {
    mock.restore();
  });

  const userId = 123;

  describe('upsertUser', () => {
    it('creates new user and returns data', async () => {
      mock.onPut('/api/user/self').reply(201, {
        system_user_id: 1,
        user_identifier: 'newuser',
        user_guid: '123-456-789',
        role_names: ['Member'],
        display_name: 'New User',
        email: 'new@example.com'
      });

      const result = await useUserApi(axiosInstance).upsertUser();

      expect(result.system_user_id).toEqual(1);
      expect(result.user_identifier).toEqual('newuser');
      expect(result.user_guid).toEqual('123-456-789');
      expect(result.role_names).toEqual(['Member']);
    });

    it('updates existing user and returns data', async () => {
      mock.onPut('/api/user/self').reply(200, {
        system_user_id: 1,
        user_identifier: 'existinguser',
        user_guid: '123-456-789',
        role_names: ['Member'],
        display_name: 'Updated Name',
        email: 'updated@example.com'
      });

      const result = await useUserApi(axiosInstance).upsertUser();

      expect(result.system_user_id).toEqual(1);
      expect(result.display_name).toEqual('Updated Name');
      expect(result.email).toEqual('updated@example.com');
    });
  });

  describe('getOrRegisterUser', () => {
    it('calls upsertUser and returns the user', async () => {
      mock.onPut('/api/user/self').reply(200, {
        system_user_id: 1,
        user_identifier: 'testuser',
        role_names: ['Member']
      });

      const result = await useUserApi(axiosInstance).getOrRegisterUser();

      expect(result.system_user_id).toEqual(1);
      expect(result.user_identifier).toEqual('testuser');
    });
  });

  it('getUserById works as expected', async () => {
    mock.onGet(`/api/user/${userId}/get`).reply(200, {
      system_user_id: 123,
      record_end_date: 'test',
      user_identifier: 'myidirboss',
      role_names: ['role 1', 'role 2']
    });

    const result = await useUserApi(axiosInstance).getUserById(123);

    expect(result.system_user_id).toEqual(123);
    expect(result.record_end_date).toEqual('test');
    expect(result.user_identifier).toEqual('myidirboss');
    expect(result.role_names).toEqual(['role 1', 'role 2']);
  });

  it('getUsersList works as expected', async () => {
    mock.onGet('/api/user/list').reply(200, {
      users: [
        {
          system_user_id: 1,
          user_identifier: 'myidirboss',
          role_names: ['role 1', 'role 2']
        },
        {
          system_user_id: 2,
          user_identifier: 'myidirbossagain',
          role_names: ['role 1', 'role 4']
        }
      ],
      pagination: {
        total: 2,
        current_page: 1,
        last_page: 1,
        per_page: 10
      }
    });

    const result = await useUserApi(axiosInstance).getUsersList();

    expect(result.users[0].system_user_id).toEqual(1);
    expect(result.users[0].user_identifier).toEqual('myidirboss');
    expect(result.users[0].role_names).toEqual(['role 1', 'role 2']);
    expect(result.users[1].system_user_id).toEqual(2);
    expect(result.users[1].user_identifier).toEqual('myidirbossagain');
    expect(result.users[1].role_names).toEqual(['role 1', 'role 4']);
    expect(result.pagination.total).toEqual(2);
  });

  it('addSystemUserRoles works as expected', async () => {
    const userId = 1;

    mock.onPost(`/api/user/${userId}/system-roles/create`).reply(200, 3);

    const result = await useUserApi(axiosInstance).addSystemUserRoles(1, [1, 2, 3]);

    expect(result).toEqual(3);
  });

  it('updateSystemUser works as expected', async () => {
    const userId = 1;

    mock.onPatch(`/api/user/${userId}`, { record_end_date: null }).reply(200);

    const result = await useUserApi(axiosInstance).updateSystemUser(1, { record_end_date: null });

    expect(result).toBeUndefined();
  });
});
