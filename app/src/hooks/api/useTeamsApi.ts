import { AxiosInstance } from 'axios';
import {
  ITeam,
  ITeamsResponse,
  ICreateTeamRequest,
  IUpdateTeamRequest,
  IAvailableUsersResponse,
  ITeamMembersResponse,
  ITeamMember
} from 'interfaces/useTeamsApi.interface';
import { ApiPaginationRequestOptions, ApiSearchParams } from 'types/pagination';

/**
 * Returns a set of supported api methods for working with teams.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useTeamsApi = (axios: AxiosInstance) => {
  /**
   * Get all teams with pagination.
   *
   * @param {ApiSearchParams} [searchParams] - Optional search parameters.
   * @param {ApiPaginationRequestOptions} [pagination] - Optional pagination parameters.
   * @return {*} {Promise<ITeamsResponse>}
   */
  const getTeams = async (
    searchParams?: ApiSearchParams,
    pagination?: ApiPaginationRequestOptions
  ): Promise<ITeamsResponse> => {
    const params = { ...searchParams, ...pagination };
    const { data } = await axios.get('/api/administrative/teams', { params });

    return data;
  };

  /**
   * Get a single team by ID.
   *
   * @param {string} teamId
   * @return {*} {Promise<ITeam>}
   */
  const getTeam = async (teamId: string): Promise<ITeam> => {
    const { data } = await axios.get(`/api/administrative/teams/${teamId}`);

    return data;
  };

  /**
   * Create a new team.
   *
   * @param {ICreateTeamRequest} team
   * @return {*} {Promise<ITeam>}
   */
  const createTeam = async (team: ICreateTeamRequest): Promise<ITeam> => {
    const { data } = await axios.post('/api/administrative/teams', team);

    return data;
  };

  /**
   * Update an existing team.
   *
   * @param {string} teamId
   * @param {IUpdateTeamRequest} team
   * @return {*} {Promise<ITeam>}
   */
  const updateTeam = async (teamId: string, team: IUpdateTeamRequest): Promise<ITeam> => {
    const { data } = await axios.put(`/api/administrative/teams/${teamId}`, team);

    return data;
  };

  /**
   * Delete a team.
   *
   * @param {string} teamId
   * @return {*} {Promise<void>}
   */
  const deleteTeam = async (teamId: string): Promise<void> => {
    await axios.delete(`/api/administrative/teams/${teamId}`);
  };

  /**
   * Get available users for team membership.
   *
   * @param {string} [search] - Optional search term to filter users by user_identifier
   * @return {*} {Promise<IAvailableUsersResponse>}
   */
  const getAvailableUsers = async (search?: string): Promise<IAvailableUsersResponse> => {
    const { data } = await axios.get('/api/administrative/users', {
      params: search ? { search } : undefined
    });

    return data;
  };

  /**
   * Get members for a team.
   *
   * @param {string} teamId
   * @return {*} {Promise<ITeamMembersResponse>}
   */
  const getTeamMembers = async (teamId: string): Promise<ITeamMembersResponse> => {
    const { data } = await axios.get(`/api/administrative/teams/${teamId}/member`, {
      params: { page: 1, limit: 100 }
    });

    return data;
  };

  /**
   * Add a user to a team.
   *
   * @param {string} teamId
   * @param {number} systemUserId
   * @return {*} {Promise<ITeamMember>}
   */
  const createTeamMember = async (teamId: string, systemUserId: number): Promise<ITeamMember> => {
    const { data } = await axios.post(`/api/administrative/teams/${teamId}/member`, {
      system_user_id: systemUserId
    });

    return data;
  };

  /**
   * Remove a team member association by team_member_id.
   *
   * @param {string} teamId
   * @param {string} teamMemberId
   * @return {*} {Promise<void>}
   */
  const deleteTeamMember = async (teamId: string, teamMemberId: string): Promise<void> => {
    await axios.delete(`/api/administrative/teams/${teamId}/member/${teamMemberId}`);
  };

  return {
    getTeams,
    getTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    getAvailableUsers,
    getTeamMembers,
    createTeamMember,
    deleteTeamMember
  };
};
