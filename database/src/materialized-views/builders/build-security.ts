// Security logic is handled in build-materialized-view.ts for now
// This file can be expanded for more complex security rules

import { MaterializedViewSecurityConfig } from '../types';

export function buildEffectivelySecuredExpression(featureIdExpr: string): string {
  return `(
    EXISTS (
      SELECT 1
      FROM biohub.submission_feature_closure c
      JOIN biohub.submission_feature_security sfs
        ON sfs.submission_feature_id = c.target_submission_feature_id
      JOIN biohub.submission_feature sf_sec
        ON sf_sec.submission_feature_id = c.target_submission_feature_id
      WHERE c.source_submission_feature_id = ${featureIdExpr}
        AND c.is_ancestor = true
        AND sfs.record_end_date IS NULL
        AND sf_sec.record_effective_date <= NOW()
    )
    OR NOT EXISTS (
      SELECT 1
      FROM biohub.submission_feature_closure c
      WHERE c.source_submission_feature_id = ${featureIdExpr}
        AND c.target_submission_feature_id = ${featureIdExpr}
    )
  )`;
}

export function buildEffectivelySecuredWhitelistFilter(featureIdExpr: string, whitelist: string[]): string {
  if (whitelist.length === 0) {
    return 'AND 1=0';
  }

  const quoted = whitelist.map((name) => `'${name.replace(/'/g, "''")}'`).join(', ');

  return `AND ${featureIdExpr} IN (
      SELECT c.source_submission_feature_id
      FROM biohub.submission_feature_closure c
      JOIN biohub.submission_feature_security sfs
        ON sfs.submission_feature_id = c.target_submission_feature_id
      JOIN biohub.security_category sc
        ON sfs.security_category_id = sc.security_category_id
      WHERE c.is_ancestor = true
        AND sfs.record_end_date IS NULL
        AND sc.name IN (${quoted})
  )`;
}

export function buildSecurityFilter(securityMode: string, securityConfig?: MaterializedViewSecurityConfig): string {
  switch (securityMode) {
    case 'public':
      return `AND NOT ${buildEffectivelySecuredExpression('sf.submission_feature_id')}`;
    case 'all':
      return '';
    case 'secured':
      if (!securityConfig || securityConfig.securedWhitelist.length === 0) {
        return 'AND 1=0'; // Exclude all if no whitelist
      }
      return buildEffectivelySecuredWhitelistFilter('sf.submission_feature_id', securityConfig.securedWhitelist);
    default:
      return '';
  }
}
