import { mdiAlertOutline, mdiCheck, mdiEmailOutline, mdiProgressCheck } from '@mdi/js';
import { TicketPriority, TicketSystemUserStatus } from 'interfaces/useTicketsApi.interface';

export const TICKET_PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'critical'];

type TicketAssigneeStatusPresentation = {
  label: string;
  colour: 'default' | 'info' | 'warning' | 'success';
  icon: string;
};

export const TICKET_ASSIGNEE_STATUS_PRESENTATION: Record<TicketSystemUserStatus, TicketAssigneeStatusPresentation> = {
  requested: {
    label: 'Requested',
    colour: 'default',
    icon: mdiEmailOutline
  },
  started: {
    label: 'Started',
    colour: 'info',
    icon: mdiProgressCheck
  },
  blocked: {
    label: 'Blocked',
    colour: 'warning',
    icon: mdiAlertOutline
  },
  resolved: {
    label: 'Resolved',
    colour: 'success',
    icon: mdiCheck
  }
};
