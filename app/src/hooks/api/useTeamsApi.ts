import { AxiosInstance } from 'axios';
import {
  ITeamWithMembers,
  ITeamsResponse,
  ICreateTeamRequest,
  IUpdateTeamRequest,
  IAvailableUsersResponse
} from 'interfaces/useTeamsApi.interface';

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
   * @param {object} [params]
   * @return {*} {Promise<ITeamsResponse>}
   */
  const getTeams = async (params?: { page?: number; limit?: number; search?: string }): Promise<ITeamsResponse> => {
    const { data } = await axios.get('/api/administrative/teams', { params });

    return data;
  };

  /**
   * Get a single team by ID.
   *
   * @param {string} teamId
   * @return {*} {Promise<ITeamWithMembers>}
   */
  const getTeam = async (teamId: string): Promise<ITeamWithMembers> => {
    const { data } = await axios.get(`/api/administrative/teams/${teamId}`);

    return data;
  };

  /**
   * Create a new team.
   *
   * @param {ICreateTeamRequest} team
   * @return {*} {Promise<ITeamWithMembers>}
   */
  const createTeam = async (team: ICreateTeamRequest): Promise<ITeamWithMembers> => {
    const { data } = await axios.post('/api/administrative/teams', team);

    return data;
  };

  /**
   * Update an existing team.
   *
   * @param {string} teamId
   * @param {IUpdateTeamRequest} team
   * @return {*} {Promise<ITeamWithMembers>}
   */
  const updateTeam = async (teamId: string, team: IUpdateTeamRequest): Promise<ITeamWithMembers> => {
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
   * @return {*} {Promise<IAvailableUsersResponse>}
   */
  const getAvailableUsers = async (): Promise<IAvailableUsersResponse> => {
    const { data } = await axios.get('/api/administrative/users');

    return data;
  };

  return {
    getTeams,
    getTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    getAvailableUsers
  };
};
