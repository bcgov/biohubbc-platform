import { z } from 'zod';

export const TeamMember = z.object({
  team_member_id: z.string().uuid(),
  system_user_id: z.number().int(),
  team_id: z.string().uuid()
});

export type TeamMember = z.infer<typeof TeamMember>;

export interface CreateTeamMember {
  system_user_id: number;
  team_id: string;
}

export interface UpdateTeamMember {
  record_end_date?: string;
}
