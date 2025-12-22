/**
 * Team member with user details.
 */
export interface ITeamMember {
  team_member_id: string;
  system_user_id: number;
  user_identifier: string;
}

/**
 * Team with its members.
 */
export interface ITeamWithMembers {
  team_id: string;
  name: string;
  description: string | null;
  members: ITeamMember[];
}

/**
 * Paginated teams response.
 */
export interface ITeamsResponse {
  teams: ITeamWithMembers[];
  pagination: {
    total: number;
    current_page: number;
    last_page: number;
    per_page: number;
    sort?: string;
    order?: 'asc' | 'desc';
  };
}

/**
 * Create team request payload.
 */
export interface ICreateTeamRequest {
  name: string;
  description?: string;
  member_user_ids?: number[];
}

/**
 * Update team request payload.
 */
export interface IUpdateTeamRequest {
  name?: string;
  description?: string;
  member_user_ids?: number[];
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
