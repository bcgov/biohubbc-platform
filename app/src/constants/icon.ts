import {
  mdiCheck,
  mdiCommentTextOutline,
  mdiDatabaseLockOutline,
  mdiEmailOpenOutline,
  mdiTagOutline,
  mdiUploadOutline
} from '@mdi/js';

export const TICKET_TIMELINE_ICONS = {
  open: mdiEmailOpenOutline,
  closed: mdiCheck,
  comment: mdiCommentTextOutline,
  data_request: mdiDatabaseLockOutline,
  upload: mdiUploadOutline,
  tag: mdiTagOutline
} as const;
