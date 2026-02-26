import { z } from 'zod';
import { TicketStatus } from './ticket';

export const TicketStatusHistory = z.object({
  ticket_status_history_id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  user_identifier: z.string(),
  create_date: z.string(),
  status: TicketStatus
});

export type TicketStatusHistory = z.infer<typeof TicketStatusHistory>;
