import { mdiChevronDoubleUp, mdiChevronTripleUp, mdiChevronUp, mdiChevronUpBox } from '@mdi/js';
import { orange } from '@mui/material/colors';
import { Theme } from '@mui/material/styles';
import { TicketPriority } from 'interfaces/useTicketsApi.interface';

type PriorityIcon = {
  path: string;
  color: string;
};

export const getPriorityIcon = (priority: TicketPriority, palette: Theme['palette']): PriorityIcon => {
  switch (priority) {
    case 'low':
      return {
        path: mdiChevronUp,
        color: palette.success.main
      };
    case 'medium':
      return {
        path: mdiChevronDoubleUp,
        color: palette.primary.main
      };
    case 'high':
      return {
        path: mdiChevronTripleUp,
        color: orange[700]
      };
    case 'critical':
      return {
        path: mdiChevronUpBox,
        color: palette.error.main
      };
    default:
      return {
        path: mdiChevronDoubleUp,
        color: palette.primary.main
      };
  }
};

