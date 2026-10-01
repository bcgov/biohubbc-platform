/**
 * First segment of every query key, one per kind of server resource.
 *
 * Invalidation matches keys by prefix, so resources that shared a root would invalidate each
 * other's queries. Each resource starts its keys with its own root from here.
 */
export const QUERY_KEY_ROOT = {
  API_KEY: 'api-key',
  CODE: 'code',
  DOWNLOAD: 'download',
  GALLERY: 'gallery',
  POLICY: 'policy',
  SECURITY: 'security',
  SEARCH: 'search',
  SUBMISSION: 'submission',
  SUBMISSION_UPLOAD: 'submission-upload',
  SUBMISSION_UPLOAD_REVIEW: 'submission-upload-review',
  TEAM: 'team',
  TEAM_POLICY: 'team-policy',
  TICKET: 'ticket',
  USER: 'user'
} as const;
