import { z } from 'zod';

export const TeamPolicy = z.object({
  team_policy_id: z.guid(),
  team_id: z.guid(),
  policy_id: z.guid(),
  record_end_date: z.string().nullable()
});

export type TeamPolicy = z.infer<typeof TeamPolicy>;

/**
 * Team policy with joined team and policy names for display.
 * Follows SIMS pattern of returning display-ready data.
 */
export const TeamPolicyDetails = TeamPolicy.extend({
  team_name: z.string(),
  policy_name: z.string()
});

export type TeamPolicyDetails = z.infer<typeof TeamPolicyDetails>;

export interface CreateTeamPolicy {
  team_id: string;
  policy_id: string;
}

export interface CreateTeamPoliciesRequest {
  policies: string[];
}

export interface UpdateTeamPolicy {
  record_end_date?: string | null;
}
