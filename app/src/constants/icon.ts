import { mdiCheck, mdiCommentTextOutline, mdiEmailOpenOutline } from '@mdi/js';

export const TICKET_TIMELINE_ICONS = {
  open: mdiEmailOpenOutline,
  closed: mdiCheck,
  comment: mdiCommentTextOutline
} as const;
