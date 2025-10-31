import { z } from 'zod';

// Zod schema for full DB TeamMember record
export const TeamMember = z.object({
  team_member_id: z.string().uuid(),
  system_user_id: z.number().int(),
  team_id: z.string().uuid()
});

// TypeScript type inferred from Zod schema
export type TeamMember = z.infer<typeof TeamMember>;

// Plain TypeScript interface for creating a team member
export interface CreateTeamMember {
  system_user_id: number;
  team_id: string;
}

// Plain TypeScript interface for updating a team member
export interface UpdateTeamMember {
  system_user_id?: number;
  team_id?: string;
  record_end_date?: string;
}
