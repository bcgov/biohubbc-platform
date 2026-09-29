/**
 * First segment of every query key, one per kind of server resource.
 *
 * Invalidation matches keys by prefix, so two builder modules that shared a root would invalidate each
 * other's queries. Each builder module starts its keys with its own root from here.
 */
export const QUERY_KEY_ROOT = {
  CODE: 'code',
  DOWNLOAD: 'download',
  POLICY: 'policy',
  SECURITY: 'security',
  SEARCH: 'search',
  SUBMISSION: 'submission',
  SUBMISSION_UPLOAD: 'submission-upload',
  TEAM: 'team',
  TEAM_POLICY: 'team-policy',
  TICKET: 'ticket',
  USER: 'user'
} as const;
