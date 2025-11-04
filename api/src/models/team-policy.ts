import { z } from 'zod';

export const TeamPolicy = z.object({
  team_policy_id: z.string().uuid(),
  team_id: z.string().uuid(),
  policy_id: z.string().uuid()
});

export type TeamPolicy = z.infer<typeof TeamPolicy>;

export interface CreateTeamPolicy {
  team_id: string;
  policy_id: string;
}

export interface UpdateTeamPolicy {
  record_end_date?: string;
}
