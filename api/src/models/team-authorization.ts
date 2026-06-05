import { z } from 'zod';

export const TeamPolicyRecord = z.object({
  team_policy_id: z.string().uuid(),
  record_end_date: z.string().nullable()
});

export type TeamPolicyRecord = z.infer<typeof TeamPolicyRecord>;

export const DataRequestRecord = z.object({
  data_request_id: z.string().uuid(),
  record_end_date: z.string().nullable()
});

export type DataRequestRecord = z.infer<typeof DataRequestRecord>;

export const TicketRecord = z.object({
  ticket_id: z.string().uuid(),
  record_end_date: z.string().nullable()
});

export type TicketRecord = z.infer<typeof TicketRecord>;
