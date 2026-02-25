import { z } from 'zod';

export const Team = z.object({
  team_id: z.string().uuid(),
  name: z.string().max(250),
  description: z.string().max(1000).nullable(),
  member_count: z.number().int()
});

export type Team = z.infer<typeof Team>;

export interface CreateTeam {
  name: string;
  description?: string;
  system_user_ids?: number[];
}

export interface UpdateTeam {
  name?: string;
  description?: string;
  record_end_date?: string;
}
