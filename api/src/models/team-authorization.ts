import { z } from 'zod';

export const TeamMemberRecord = z.object({
  team_member_id: z.string().uuid()
});

export type TeamMemberRecord = z.infer<typeof TeamMemberRecord>;

export const TeamPolicyRecord = z.object({
  team_policy_id: z.string().uuid()
});

export type TeamPolicyRecord = z.infer<typeof TeamPolicyRecord>;

export const DataRequestRecord = z.object({
  data_request_id: z.string().uuid()
});

export type DataRequestRecord = z.infer<typeof DataRequestRecord>;
