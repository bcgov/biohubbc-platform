import { mdiAlertOutline, mdiCheck, mdiEmailOutline, mdiProgressCheck } from '@mdi/js';
import { TicketPriority, TicketSystemUserStatus } from 'interfaces/useTicketsApi.interface';

export const TICKET_PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'critical'];

export const TICKET_ARTIFACT_ID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
export const TICKET_ARTIFACT_PATH_PATTERN = new RegExp(`^/artifact/(${TICKET_ARTIFACT_ID_PATTERN})$`, 'i');
export const TICKET_ARTIFACT_REFERENCE_PATTERN = /^\/artifact/i;
export const TICKET_ARTIFACT_ID_ONLY_PATTERN = new RegExp(`^${TICKET_ARTIFACT_ID_PATTERN}$`, 'i');
export const TICKET_MARKDOWN_HTTP_HREF_PATTERN = /^https?:\/\//i;

type TicketSystemUserStatusPresentation = {
  label: string;
  colour: 'default' | 'info' | 'warning' | 'success';
  icon: string;
};

export const TICKET_SYSTEM_USER_STATUS_PRESENTATION: Record<
  TicketSystemUserStatus,
  TicketSystemUserStatusPresentation
> = {
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
