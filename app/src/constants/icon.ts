import { mdiCheck, mdiCommentTextOutline, mdiEmailOpen } from '@mdi/js';

export const TICKET_TIMELINE_ICONS = {
  open: mdiEmailOpen,
  closed: mdiCheck,
  comment: mdiCommentTextOutline
} as const;
