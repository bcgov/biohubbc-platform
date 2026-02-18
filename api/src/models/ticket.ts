import { z } from 'zod';

export const TicketPriority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type TicketPriority = z.infer<typeof TicketPriority>;

export const TicketStatus = z.enum(['OPEN', 'CLOSED']);
export type TicketStatus = z.infer<typeof TicketStatus>;

export const Ticket = z.object({
  ticket_id: z.string().uuid(),
  ticket_number: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  team_id: z.string().uuid(),
  priority: TicketPriority,
  status: TicketStatus
});

export type Ticket = z.infer<typeof Ticket>;

export const CreateTicketRequest = z.object({
  title: z.string().max(100),
  description: z.string().max(2000).optional(),
  team_id: z.string().uuid(),
  priority: TicketPriority.optional()
});

export type CreateTicketRequest = z.infer<typeof CreateTicketRequest>;

export const UpdateTicketRequest = z.object({
  title: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  priority: TicketPriority.optional(),
  status: TicketStatus.optional()
});

export type UpdateTicketRequest = z.infer<typeof UpdateTicketRequest>;

export const UpdateTicketStatusRequest = z.object({
  status: TicketStatus
});

export type UpdateTicketStatusRequest = z.infer<typeof UpdateTicketStatusRequest>;
