import { z } from 'zod';
import { DataRequest } from './data-request';
import { TicketComment } from './ticket-comment';
import { TicketReference } from './ticket-reference';
import { TicketStatus as TicketStatusRecord } from './ticket-status';
import { TicketSystemUserWithUser } from './ticket-system-user';

export interface TicketFilters {
  team_ids?: string[];
  status?: TicketStatus;
  search?: string;
}

export const TicketPriority = z.enum(['low', 'medium', 'high', 'critical']);
export type TicketPriority = z.infer<typeof TicketPriority>;

export const TicketStatus = z.enum(['open', 'closed']);
export type TicketStatus = z.infer<typeof TicketStatus>;

export const Ticket = z.object({
  ticket_id: z.string().uuid(),
  ticket_slug: z.string().regex(/^\d{8}$/),
  subject: z.string(),
  description: z.string().nullable(),
  team_id: z.string().uuid(),
  create_date: z.string(),
  priority: TicketPriority,
  status: TicketStatus
});
export type Ticket = z.infer<typeof Ticket>;

export const TicketSlug = Ticket.pick({ ticket_slug: true });
export type TicketSlug = z.infer<typeof TicketSlug>;

export const CreateTicketRequest = z.object({
  subject: z.string(),
  description: z.string().nullable(),
  priority: TicketPriority,
  systemUserIds: z.array(z.number()).optional()
});
export type CreateTicketRequest = z.infer<typeof CreateTicketRequest>;
export type CreateTicketPayload = CreateTicketRequest & {
  team_id: string;
  ticket_slug: string;
};

export const UpdateTicketRequest = z.object({
  subject: z.string().optional(),
  description: z.string().nullable().optional(),
  priority: TicketPriority.optional(),
  status: TicketStatus.optional()
});
export type UpdateTicketRequest = z.infer<typeof UpdateTicketRequest>;

export const UpdateTicketStatusRequest = z.object({
  status: TicketStatus
});
export type UpdateTicketStatusRequest = z.infer<typeof UpdateTicketStatusRequest>;

export const TicketWithHistory = Ticket.extend({
  statuses: z.array(TicketStatusRecord),
  comments: z.array(TicketComment),
  references: z.array(TicketReference),
  data_requests: z.array(DataRequest),
  ticket_system_users: z.array(TicketSystemUserWithUser)
});
export type TicketWithHistory = z.infer<typeof TicketWithHistory>;
