import { z } from 'zod';

// Zod schema for full DB TeamPolicy record
export const TeamPolicy = z.object({
  team_policy_id: z.string().uuid(),
  team_id: z.string().uuid(),
  policy_id: z.string().uuid()
});

// TypeScript type inferred from Zod schema
export type TeamPolicy = z.infer<typeof TeamPolicy>;

// Plain TypeScript interface for creating a team policy
export interface CreateTeamPolicy {
  team_id: string;
  policy_id: string;
}

// Plain TypeScript interface for updating a team policy
export interface UpdateTeamPolicy {
  team_id?: string;
  policy_id?: string;
  record_end_date?: string;
}
