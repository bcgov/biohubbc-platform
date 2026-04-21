import { TicketPriority, TicketSystemUserStatus } from 'interfaces/useTicketsApi.interface';

export const TICKET_PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'critical'];

export const TICKET_ASSIGNEE_STATUS_COLORS: Record<TicketSystemUserStatus, 'default' | 'info' | 'warning' | 'success'> =
  {
    requested: 'default',
    started: 'info',
    blocked: 'warning',
    resolved: 'success'
  };
