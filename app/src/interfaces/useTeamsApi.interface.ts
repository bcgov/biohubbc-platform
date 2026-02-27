import { ApiPaginationResponseParams } from 'types/pagination';

/**
 * Team member with user details.
 */
export interface ITeamMember {
  team_member_id: string;
  system_user_id: number;
  user_identifier: string;
  email?: string | null;
}

/**
 * Team summary.
 */
export interface ITeam {
  team_id: string;
  name: string;
  description: string | null;
  member_count: number;
}

/**
 * Paginated teams response.
 */
export interface ITeamsResponse {
  teams: ITeam[];
  pagination: ApiPaginationResponseParams;
}

/**
 * Create team request payload.
 */
export interface ICreateTeamRequest {
  name: string;
  description?: string;
  system_user_ids?: number[];
}

/**
 * Update team request payload.
 */
export interface IUpdateTeamRequest {
  name?: string;
  description?: string;
  system_user_ids?: number[];
}

/**
 * Available user for team membership.
 */
export interface IAvailableUser {
  system_user_id: number;
  user_identifier: string;
}

/**
 * Available users response.
 */
export interface IAvailableUsersResponse {
  users: IAvailableUser[];
}

/**
 * Team members response.
 */
export interface ITeamMembersResponse {
  members: ITeamMember[];
}
