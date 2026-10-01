import { mdiAxisArrowLock, mdiLock, mdiLockOpenVariant } from '@mdi/js';
import { ApiPaginationRequestOptions } from 'types/pagination';

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

/** The security categories a reason can be filed under, as the reason dialog lists them. */
export const SECURITY_CATEGORY_OPTIONS_PAGINATION: ApiPaginationRequestOptions = {
  page: 1,
  limit: 100,
  sort: 'name',
  order: 'asc'
};
