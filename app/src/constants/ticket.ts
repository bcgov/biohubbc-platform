import { TicketPriority, TicketSystemUserStatus } from 'interfaces/useTicketsApi.interface';

export const TICKET_PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'critical'];

export type TicketAssigneeStatusChipColor = 'default' | 'info' | 'warning' | 'success';

export const TICKET_ASSIGNEE_STATUS_COLORS: Record<TicketSystemUserStatus, TicketAssigneeStatusChipColor> = {
  requested: 'default',
  started: 'info',
  blocked: 'warning',
  resolved: 'success'
};
