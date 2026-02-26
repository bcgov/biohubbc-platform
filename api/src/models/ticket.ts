import { z } from 'zod';

export const TicketPriority = z.enum(['low', 'medium', 'high', 'critical']);
export type TicketPriority = z.infer<typeof TicketPriority>;

export const TicketStatus = z.enum(['open', 'closed']);
export type TicketStatus = z.infer<typeof TicketStatus>;

export interface TeamFilters {
  status?: TicketStatus;
}

export const Ticket = z.object({
  ticket_id: z.string().uuid(),
  ticket_slug: z.string().regex(/^\d{8}$/),
  title: z.string(),
  description: z.string().nullable(),
  team_id: z.string().uuid(),
  create_date: z.string(),
  priority: TicketPriority,
  status: TicketStatus
});

export type Ticket = z.infer<typeof Ticket>;
export const TicketSlug = Ticket.pick({ ticket_slug: true });
export type TicketSlug = z.infer<typeof TicketSlug>;

const TicketHistoryItem = z.object({
  ticket_status_history_id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  user_identifier: z.string(),
  create_date: z.string(),
  status: TicketStatus
});

export const TicketWithHistory = Ticket.extend({
  history: z.array(TicketHistoryItem)
});

export type TicketWithHistory = z.infer<typeof TicketWithHistory>;

export const CreateTicketRequest = z.object({
  title: z.string().max(100),
  description: z.string().max(2000).nullable().optional(),
  team_id: z.string().uuid().optional(),
  priority: TicketPriority.optional()
});

export type CreateTicketRequest = z.infer<typeof CreateTicketRequest>;

export const UpdateTicketRequest = z.object({
  title: z.string().max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
  priority: TicketPriority.optional(),
  status: TicketStatus.optional()
});

export type UpdateTicketRequest = z.infer<typeof UpdateTicketRequest>;

export const UpdateTicketStatusRequest = z.object({
  status: TicketStatus
});

export type UpdateTicketStatusRequest = z.infer<typeof UpdateTicketStatusRequest>;
