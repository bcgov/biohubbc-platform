import { z } from 'zod';

/**
 * Canonical structural access definition derived from a policy statement URN.
 * Deduplicated by scope_hash; same URN always maps to the same scope,
 * regardless of which policy defined it.
 */
export const SecurityScope = z.object({
  security_scope_id: z.string().uuid(),
  scope_hash: z.string(),
  urn_submission_id: z.string(),
  urn_feature_type: z.string(),
  urn_feature_id: z.string()
});

export type SecurityScope = z.infer<typeof SecurityScope>;

/**
 * Binds a security scope to an anchor feature — the root of a secured subtree.
 * Anchors are security roots, not expanded descendants. The walk-up search
 * strategy checks from candidates up to anchors, never expanding down.
 */
export const SecurityScopeAnchor = z.object({
  security_scope_anchor_id: z.string().uuid(),
  security_scope_id: z.string().uuid(),
  anchor_submission_feature_id: z.number()
});

export type SecurityScopeAnchor = z.infer<typeof SecurityScopeAnchor>;

/**
 * Grants a team access to a security scope. Derived from the
 * team_policy -> policy_statement.security_scope_id chain.
 * Rebuilt synchronously on policy/team-policy mutations (~30 rows per team at scale).
 */
export const TeamSecurityScope = z.object({
  team_security_scope_id: z.string().uuid(),
  team_id: z.string().uuid(),
  security_scope_id: z.string().uuid()
});

export type TeamSecurityScope = z.infer<typeof TeamSecurityScope>;

/**
 * Picked shape for queries that return only the scope ID.
 */
export const SecurityScopeId = SecurityScope.pick({ security_scope_id: true });
export type SecurityScopeId = z.infer<typeof SecurityScopeId>;
