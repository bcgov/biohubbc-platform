// Security logic is handled in build-materialized-view.ts for now
// This file can be expanded for more complex security rules

import { MaterializedViewSecurityConfig } from '../types';

export function buildSecurityFilter(securityMode: string, securityConfig?: MaterializedViewSecurityConfig): string {
  switch (securityMode) {
    case 'public':
      return 'AND sf.submission_feature_id NOT IN (SELECT submission_feature_id FROM biohub.submission_feature_security)';
    case 'all':
      return '';
    case 'secured':
      if (!securityConfig || securityConfig.securedWhitelist.length === 0) {
        return 'AND 1=0'; // Exclude all if no whitelist
      }
      const whitelist = securityConfig.securedWhitelist.map((name) => `'${name.replace(/'/g, "''")}'`).join(', ');
      return `AND sf.submission_feature_id IN (
        SELECT sfs.submission_feature_id
        FROM biohub.submission_feature_security sfs
        JOIN biohub.security_category sc ON sfs.security_category_id = sc.security_category_id
        WHERE sc.name IN (${whitelist})
      )`;
    default:
      return '';
  }
}
