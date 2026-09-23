import { mdiAxisArrowLock, mdiLock, mdiLockOpenVariant } from '@mdi/js';

export const SECURITY_LABEL: Record<string, string> = {
  PENDING: 'Pending Review',
  SECURED: 'Secured',
  'PARTIALLY SECURED': 'Partially Secured',
  UNSECURED: 'Published'
};

export const SUBMISSION_UPLOAD_REVIEW_SECURITY_ICON_CONFIG = {
  direct: { path: mdiLock, color: 'error' },
  inherited: { path: mdiAxisArrowLock, color: 'error' }
} as const;

export const SUBMISSION_UPLOAD_REVIEW_UNSECURED_ICON_CONFIG = {
  path: mdiLockOpenVariant,
  color: 'muted'
} as const;
