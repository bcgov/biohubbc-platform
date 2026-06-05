import {
  mdiCheck,
  mdiCommentTextOutline,
  mdiDatabaseLockOutline,
  mdiEmailOpenOutline,
  mdiUploadOutline
} from '@mdi/js';

export const TICKET_TIMELINE_ICONS = {
  open: mdiEmailOpenOutline,
  closed: mdiCheck,
  comment: mdiCommentTextOutline,
  data_request: mdiDatabaseLockOutline,
  upload: mdiUploadOutline
} as const;
