import { z } from 'zod';

export const TicketSystemUserStatus = z.enum(['requested', 'started', 'blocked', 'resolved']);
export type TicketSystemUserStatus = z.infer<typeof TicketSystemUserStatus>;

export const TicketSystemUser = z.object({
  ticket_system_user_id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  system_user_id: z.number().int(),
  status: TicketSystemUserStatus
});
export type TicketSystemUser = z.infer<typeof TicketSystemUser>;

export const TicketSystemUserWithUser = TicketSystemUser.extend({
  system_user: z.object({
    system_user_id: z.number().int(),
    display_name: z.string().nullable(),
    user_identifier: z.string(),
    email: z.string().nullable()
  })
});
export type TicketSystemUserWithUser = z.infer<typeof TicketSystemUserWithUser>;

export interface CreateTicketSystemUserRequest {
  system_user_id: number;
  status: TicketSystemUserStatus;
}

export interface UpdateTicketSystemUserStatusRequest {
  status: TicketSystemUserStatus;
}

export interface CreateTicketSystemUser extends CreateTicketSystemUserRequest {
  ticket_id: string;
}

export interface UpdateTicketSystemUserStatus extends UpdateTicketSystemUserStatusRequest {}
