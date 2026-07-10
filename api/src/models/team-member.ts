import { z } from 'zod';

export const TeamMember = z.object({
  team_member_id: z.string().uuid(),
  system_user_id: z.number().int(),
  team_id: z.string().uuid()
});

export type TeamMember = z.infer<typeof TeamMember>;

export const TeamMemberWithUser = z.object({
  team_member_id: z.string().uuid(),
  system_user_id: z.number().int(),
  user_identifier: z.string(),
  display_name: z.string().nullable(),
  email: z.string().nullable()
});

export type TeamMemberWithUser = z.infer<typeof TeamMemberWithUser>;

export interface CreateTeamMember {
  system_user_id: number;
  team_id: string;
}

export interface TeamMemberByUserRequest {
  system_user_id: number;
}

export interface TeamMemberByUserFilter {
  team_id: string;
  system_user_id: number;
}

export interface UpdateTeamMember {
  record_end_date?: string;
}
