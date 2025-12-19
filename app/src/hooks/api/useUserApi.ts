import { AxiosInstance } from 'axios';
import { IGetRoles } from 'interfaces/useAdminApi.interface';
import { ISystemUser } from 'interfaces/useUserApi.interface';

/**
 * Returns a set of supported api methods for working with users.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const useUserApi = (axios: AxiosInstance) => {
  /**
   * Get all roles
   *
   * @return {*}  {Promise<IGetRoles[]>}
   */
  const getRoles = async (): Promise<IGetRoles[]> => {
    const { data } = await axios.get('/api/user/role/list');

    return data;
  };

  /**
   * Upsert the currently authenticated user.
   *
   * Creates user with Member role if not found (returns 201),
   * updates profile fields if user exists and is active (returns 200),
   * or throws 401 if user is expired/inactive.
   *
   * @return {*}  {Promise<ISystemUser>}
   */
  const upsertUser = async (): Promise<ISystemUser> => {
    const { data } = await axios.put('/api/user/self');

    return data;
  };

  /**
   * Get the current user, registering them if they don't exist.
   *
   * Uses PUT endpoint to upsert user - creates if not found, updates if exists.
   * Throws 401 if user is expired/inactive.
   *
   * @return {*}  {Promise<ISystemUser>}
   */
  const getOrRegisterUser = async (): Promise<ISystemUser> => {
    return upsertUser();
  };

  /**
   * Get user from userId
   *
   * @param {number} userId
   * @return {*}  {Promise<ISystemUser>}
   */
  const getUserById = async (userId: number): Promise<ISystemUser> => {
    const { data } = await axios.get(`/api/user/${userId}/get`);
    return data;
  };

  /**
   * Get user details for all users.
   *
   * @return {*}  {Promise<ISystemUser[]>}
   */
  const getUsersList = async (): Promise<ISystemUser[]> => {
    const { data } = await axios.get('/api/user/list');

    return data;
  };

  /**
   * Get user details for all users.
   *
   * @return {*}  {Promise<ISystemUser[]>}
   */
  const deleteSystemUser = async (userId: number): Promise<number> => {
    const { data } = await axios.delete(`/api/user/${userId}/delete`);

    return data;
  };

  /**
   * Grant one or more system roles to a user.
   *
   * @param {number} userId
   * @param {number[]} roleIds
   * @return {*}  {Promise<number>}
   */
  const addSystemUserRoles = async (userId: number, roleIds: number[]): Promise<number> => {
    const { data } = await axios.post(`/api/user/${userId}/system-roles/create`, { roles: roleIds });

    return data;
  };

  /**
   * Get user details for all users.
   *
   * @return {*}  {Promise<ISystemUser[]>}
   */
  const updateSystemUserRoles = async (userId: number, roleIds: number[]): Promise<ISystemUser> => {
    const { data } = await axios.patch(`/api/user/${userId}/system-roles/update`, { roles: roleIds });

    return data;
  };

  return {
    getRoles,
    upsertUser,
    getOrRegisterUser,
    getUserById,
    getUsersList,
    deleteSystemUser,
    updateSystemUserRoles,
    addSystemUserRoles
  };
};

export default useUserApi;
