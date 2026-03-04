import { z } from 'zod';

export const TicketStatus = z.object({
  ticket_status_id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  user_identifier: z.string(),
  create_date: z.string(),
  status: z.enum(['open', 'closed'])
});

export type TicketStatus = z.infer<typeof TicketStatus>;
