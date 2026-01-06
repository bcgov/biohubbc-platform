/**
 * Team-policy association with team and policy names for display.
 */
export interface ITeamPolicyDetails {
  team_policy_id: string;
  team_id: string;
  policy_id: string;
  team_name: string;
  policy_name: string;
}

/**
 * Response from GET /api/administrative/team-policies.
 */
export interface ITeamPoliciesResponse {
  team_policies: ITeamPolicyDetails[];
}

/**
 * Request payload for creating a team-policy association.
 */
export interface ICreateTeamPolicyRequest {
  team_id: string;
  policy_id: string;
}

/**
 * Response from POST /api/administrative/team-policies.
 */
export interface ITeamPolicy {
  team_policy_id: string;
  team_id: string;
  policy_id: string;
}
