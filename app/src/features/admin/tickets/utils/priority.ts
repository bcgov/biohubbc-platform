import { mdiChevronDoubleUp, mdiChevronTripleUp, mdiChevronUp, mdiChevronUpBox } from '@mdi/js';
import { orange } from '@mui/material/colors';
import { Theme } from '@mui/material/styles';
import { TicketPriority } from 'interfaces/useTicketsApi.interface';

type PriorityIcon = {
  path: string;
  color: string;
};

type PriorityDisplay = PriorityIcon & {
  bgColor: string;
  label: string;
};

export const getPriorityDisplay = (priority: TicketPriority, theme: Theme): PriorityDisplay => {
  switch (priority) {
    case 'low':
      return {
        path: mdiChevronUp,
        color: theme.palette.success.main,
        bgColor: theme.palette.success.light,
        label: 'Low'
      };
    case 'medium':
      return {
        path: mdiChevronDoubleUp,
        color: theme.palette.primary.main,
        bgColor: theme.palette.primary.light,
        label: 'Medium'
      };
    case 'high':
      return {
        path: mdiChevronTripleUp,
        color: orange[700],
        bgColor: '#fff3e0',
        label: 'High'
      };
    case 'critical':
      return {
        path: mdiChevronUpBox,
        color: theme.palette.error.main,
        bgColor: theme.palette.error.light,
        label: 'Critical'
      };
    default:
      return {
        path: mdiChevronDoubleUp,
        color: theme.palette.primary.main,
        bgColor: theme.palette.primary.light,
        label: 'Medium'
      };
  }
};

export const getPriorityIcon = (priority: TicketPriority, theme: Theme): PriorityIcon => {
  const { path, color } = getPriorityDisplay(priority, theme);

  return { path, color };
};
