import { ApiPaginationResponseParams, ApiSearchParams } from 'types/pagination';

/**
 * Team-policy association with team and policy names for display.
 */
export interface ITeamPolicyDetails {
  team_policy_id: string;
  team_id: string;
  policy_id: string;
  record_end_date: string | null;
  team_name: string;
  policy_name: string;
}

/**
 * Response from GET /api/administrative/policies/team.
 */
export interface ITeamPoliciesResponse {
  team_policies: ITeamPolicyDetails[];
  pagination: ApiPaginationResponseParams;
}

/**
 * Search and filter params for GET /api/administrative/policies/team.
 */
export interface ITeamPolicySearchParams extends ApiSearchParams {
  policyIds?: string[];
}

/**
 * Request payload for associating a team to a policy.
 */
export interface ICreateTeamPolicyRequest {
  team_id: string;
}

/**
 * Response from POST /api/administrative/policies/{policyId}/team.
 */
export interface ITeamPolicy {
  team_policy_id: string;
  team_id: string;
  policy_id: string;
  record_end_date: string | null;
}

/**
 * Request payload for bulk policy assignment to a team.
 */
export interface ICreateTeamPoliciesRequest {
  policies: string[];
}

/**
 * Team-policy record returned by bulk assignment endpoint.
 */
export interface ITeamPolicyAssignment {
  team_policy_id: string;
  team_id: string;
  policy_id: string;
  record_end_date: string | null;
}

/**
 * Response payload for bulk team-policy assignment.
 */
export interface ICreateTeamPoliciesResponse {
  team_policies: ITeamPolicyAssignment[];
}
