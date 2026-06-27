import SQL from 'sql-template-strings';
import { SECURITY_SCOPE_ANCHOR_BATCH_SIZE } from '../../constants/security';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { PolicyEffect } from '../../models/policy-statement';
import { SecurityScope, SecurityScopeId } from '../../models/security-scope';
import { AnchorBatchResult, SecurityScopeUrn } from '../../services/access-policy/security-scope-service.interface';
import { BaseRepository } from '../base-repository';
import { isEffectivelySecured, isSubmissionFeatureActive } from '../sql-fragments';

/**
 * Repository for security scope tables — the normalized access model that replaces
 * the materialized team_feature cache.
 *
 * The scope cache tables (`security_scope`, `security_scope_anchor`,
 * `team_security_scope`) are derived data.
 * They use hard-delete, not soft-delete, because they are recomputable
 * from the operational source of truth (policy_statement, team_policy).
 */
export class SecurityScopeRepository extends BaseRepository {
  /**
   * Insert a security scope if it doesn't already exist (deduplicated by scope_hash).
   *
   * Multiple policies can reference the same access scope (e.g., `urn:*:telemetry:*`).
   * Deduplication via SHA-256 hash prevents duplicate anchor computation and storage
   * explosion. The caller (SecurityScopeService) computes the hash from the URN.
   *
   * Uses ON CONFLICT DO NOTHING — returns the inserted row, or null if the scope
   * already exists. The service handles the existing-scope case with a separate lookup.
   *
   * @param scopeHash SHA-256 hex of the normalized URN string
   * @param urn URN components stored on the reusable scope row
   * @returns The inserted SecurityScope, or null if scope_hash already exists
   */
  async insertSecurityScope(scopeHash: string, urn?: SecurityScopeUrn): Promise<SecurityScope | null> {
    const scopeUrn = urn ?? {
      urn_submission_id: '*',
      urn_feature_type: '*',
      urn_feature_id: '*'
    };
    const sqlStatement = SQL`
      INSERT INTO security_scope (scope_hash, urn_submission_id, urn_feature_type, urn_feature_id)
      VALUES (${scopeHash}, ${scopeUrn.urn_submission_id}, ${scopeUrn.urn_feature_type}, ${scopeUrn.urn_feature_id})
      ON CONFLICT (scope_hash) DO NOTHING
      RETURNING security_scope_id, scope_hash, urn_submission_id, urn_feature_type, urn_feature_id;
    `;

    const response = await this.connection.sql(sqlStatement, SecurityScope);

    if (response.rowCount === 0) {
      return null;
    }

    return response.rows[0];
  }

  /**
   * Insert or return the existing security scope for a scope_hash in one roundtrip.
   *
   * Uses an INSERT CTE plus fallback SELECT instead of `ON CONFLICT DO UPDATE`
   * so reusing an existing scope does not fire update/audit triggers.
   *
   * @param scopeHash SHA-256 hex of the normalized URN string
   * @param urn URN components stored on the reusable scope row
   * @returns The inserted or existing SecurityScope
   */
  async ensureSecurityScope(scopeHash: string, urn: SecurityScopeUrn): Promise<SecurityScope> {
    const sqlStatement = SQL`
      WITH inserted AS (
        INSERT INTO security_scope (scope_hash, urn_submission_id, urn_feature_type, urn_feature_id)
        VALUES (${scopeHash}, ${urn.urn_submission_id}, ${urn.urn_feature_type}, ${urn.urn_feature_id})
        ON CONFLICT (scope_hash) DO NOTHING
        RETURNING security_scope_id, scope_hash, urn_submission_id, urn_feature_type, urn_feature_id
      )
      SELECT security_scope_id, scope_hash, urn_submission_id, urn_feature_type, urn_feature_id
      FROM inserted
      UNION ALL
      SELECT security_scope_id, scope_hash, urn_submission_id, urn_feature_type, urn_feature_id
      FROM security_scope
      WHERE scope_hash = ${scopeHash}
        AND NOT EXISTS (SELECT 1 FROM inserted)
      LIMIT 1;
    `;

    const response = await this.connection.sql(sqlStatement, SecurityScope);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to ensure security scope', [
        'SecurityScopeRepository->ensureSecurityScope',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Find an existing security scope by its scope_hash.
   *
   * Used when insertSecurityScope returns null (scope already exists)
   * and the caller needs the existing scope's ID.
   *
   * @param scopeHash SHA-256 hex of the normalized URN string
   * @returns The existing SecurityScope
   * @throws ApiExecuteSQLError if no scope found (should not happen after a conflict)
   */
  async getSecurityScopeByScopeHash(scopeHash: string): Promise<SecurityScope> {
    const sqlStatement = SQL`
      SELECT security_scope_id, scope_hash
           , urn_submission_id, urn_feature_type, urn_feature_id
      FROM security_scope
      WHERE scope_hash = ${scopeHash};
    `;

    const response = await this.connection.sql(sqlStatement, SecurityScope);

    if (response.rowCount === 0) {
      throw new ApiExecuteSQLError('Security scope not found', [
        'SecurityScopeRepository->getSecurityScopeByScopeHash',
        'Expected scope to exist after ON CONFLICT, but no row found'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Delete one keyset-paginated batch of stale anchors for a security scope.
   *
   * An anchor becomes stale when its feature is no longer effectively secured
   * (neither it nor any ancestor has active security rules), unapproved (upload
   * status changed), soft-deleted, or its URN no longer matches the scope's
   * policy statement. This is the inverse of the candidate criteria used by
   * `computeAnchorBatch` — any feature that wouldn't be selected as a new
   * candidate should not remain as an existing anchor.
   *
   * Called before the keyset insert loop so valid anchors are never deleted —
   * no transient search gap where the walk-up strategy can't find a matching anchor.
   *
   * Runs only for scopes currently referenced by an active approved ALLOW
   * statement. Anchors are reusable cache rows and do not grant access without
   * `team_security_scope`, so orphaned scopes keep their anchors for future reuse.
   *
   * **Why keyset pagination:** With ~10% of features secured per submission,
   * a scope can have 50k+ anchors. The monolithic DELETE runs
   * isEffectivelySecured() (a closure ancestry probe) per anchor row — 50k
   * probes + WAL + row locks in one transaction. Keyset pagination bounds memory and
   * WAL per batch.
   *
   * **All-valid-batch fallback:** When no anchors in a batch are stale, no rows
   * are deleted but the batch is not exhausted. A boundary query advances the
   * cursor past the fully-valid page.
   *
   * @param securityScopeId UUID of the security scope to clean stale anchors for
   * @param afterId Keyset cursor — process anchors with anchor_submission_feature_id > afterId (pass 0 to start)
   * @returns Next cursor position, or null when no more anchors exist
   */
  async deleteStaleAnchorBatch(securityScopeId: string, afterId: number): Promise<AnchorBatchResult | null> {
    const result = await this.connection.query<{
      anchor_submission_feature_id: number;
      page_last_id: number;
    }>(
      `WITH active_scope AS (
         SELECT 1
         FROM security_scope ss
         JOIN policy_statement ps ON ps.security_scope_id = ss.security_scope_id
         JOIN policy p ON p.policy_id = ps.policy_id
         WHERE ss.security_scope_id = $1
           AND ps.record_end_date IS NULL
           AND ps.effect = '${PolicyEffect.ALLOW}'
           AND p.record_end_date IS NULL
           AND p.status = 'approved'
         LIMIT 1
       ),
       batch AS (
         SELECT ssa.anchor_submission_feature_id
         FROM security_scope_anchor ssa
         WHERE ssa.security_scope_id = $1
           AND ssa.anchor_submission_feature_id > $2
           AND EXISTS (SELECT 1 FROM active_scope)
         ORDER BY ssa.anchor_submission_feature_id
         LIMIT $3
       )
       -- Return stale anchors: those NOT validated by any active policy statement
       SELECT b.anchor_submission_feature_id,
              (SELECT MAX(anchor_submission_feature_id) FROM batch) AS page_last_id
       FROM batch b
       WHERE NOT EXISTS (
         SELECT 1
         FROM security_scope ss
         JOIN policy_statement ps ON ps.security_scope_id = ss.security_scope_id
         JOIN policy p ON p.policy_id = ps.policy_id
         JOIN submission_feature anchor_sf ON anchor_sf.submission_feature_id = b.anchor_submission_feature_id
         JOIN feature_type ft ON ft.feature_type_id = anchor_sf.feature_type_id
         WHERE ss.security_scope_id = $1
           AND ps.record_end_date IS NULL
           AND ps.effect = '${PolicyEffect.ALLOW}'
           AND p.record_end_date IS NULL
           AND p.status = 'approved'
           AND ${isSubmissionFeatureActive('anchor_sf')}
           AND (ss.urn_submission_id = anchor_sf.submission_id::text OR ss.urn_submission_id = '*')
           AND (ss.urn_feature_type = ft.name                       OR ss.urn_feature_type = '*')
           AND (ss.urn_feature_id = anchor_sf.submission_feature_id::text OR ss.urn_feature_id = '*')
           AND ${isEffectivelySecured('anchor_sf.submission_feature_id')}
       )`,
      [securityScopeId, afterId, SECURITY_SCOPE_ANCHOR_BATCH_SIZE]
    );

    if (result.rows.length > 0) {
      const staleIds = result.rows.map((r) => r.anchor_submission_feature_id);

      await this.connection.query(
        `DELETE FROM security_scope_anchor
         WHERE security_scope_id = $1
           AND anchor_submission_feature_id = ANY($2::INTEGER[])`,
        [securityScopeId, staleIds]
      );

      return { pageLastId: result.rows[0].page_last_id };
    }

    // No stale anchors in this batch — check if the batch had any anchors at all
    // to advance the cursor past valid anchors.
    const boundaryResult = await this.connection.query<{ last_id: number }>(
      `WITH active_scope AS (
         SELECT 1
         FROM security_scope ss
         JOIN policy_statement ps ON ps.security_scope_id = ss.security_scope_id
         JOIN policy p ON p.policy_id = ps.policy_id
         WHERE ss.security_scope_id = $1
           AND ps.record_end_date IS NULL
           AND ps.effect = '${PolicyEffect.ALLOW}'
           AND p.record_end_date IS NULL
           AND p.status = 'approved'
         LIMIT 1
       )
       SELECT MAX(ssa.anchor_submission_feature_id) AS last_id
       FROM (
         SELECT ssa.anchor_submission_feature_id
         FROM security_scope_anchor ssa
         WHERE ssa.security_scope_id = $1
           AND ssa.anchor_submission_feature_id > $2
           AND EXISTS (SELECT 1 FROM active_scope)
         ORDER BY ssa.anchor_submission_feature_id
         LIMIT $3
       ) ssa`,
      [securityScopeId, afterId, SECURITY_SCOPE_ANCHOR_BATCH_SIZE]
    );

    if (!boundaryResult.rows[0]?.last_id) {
      return null;
    }

    return { pageLastId: boundaryResult.rows[0].last_id };
  }

  /**
   * Resolve the URN pattern for a security scope.
   *
   * Returns the reusable scope URN components when at least one active approved
   * ALLOW statement still references the scope.
   *
   * @param securityScopeId UUID of the security scope
   * @returns URN components, or null if the scope has no active policy statements
   */
  async resolveUrnForScope(securityScopeId: string): Promise<SecurityScopeUrn | null> {
    const result = await this.connection.query<SecurityScopeUrn>(
      `SELECT ss.urn_submission_id, ss.urn_feature_type, ss.urn_feature_id
       FROM security_scope ss
       JOIN policy_statement ps ON ps.security_scope_id = ss.security_scope_id
       JOIN policy p ON p.policy_id = ps.policy_id
       WHERE ss.security_scope_id = $1
         AND ps.record_end_date IS NULL
         AND ps.effect = '${PolicyEffect.ALLOW}'
         AND p.record_end_date IS NULL
         AND p.status = 'approved'
       LIMIT 1`,
      [securityScopeId]
    );

    return result.rows[0] ?? null;
  }

  /**
   * Insert one keyset-paginated batch of anchor rows into `security_scope_anchor`.
   *
   * Anchors mark the highest point in each feature hierarchy that satisfies the
   * scope's URN pattern with no qualifying ancestor above it.
   *
   * A feature is "effectively secured" if it or any ancestor has an active
   * security rule — security cascades down the hierarchy. For example,
   * `urn:*:telemetry:*` anchors telemetry features whose parent survey is
   * secured, even though the telemetry features themselves have no direct
   * security rule.
   *
   * Only features from approved uploads are eligible — features still under
   * review (status = 'submitted') must not affect security scope anchors.
   *
   * **Why keyset pagination:** Even though `*:*:*` scopes are not supported,
   * a single submission-scoped URN (`urn:{subId}:*:*`) can still match 1M+
   * features. A monolithic recursive CTE would materialize the entire candidate
   * set + ancestor walk in work_mem before results can be consumed. Keyset
   * pagination bounds memory per batch at the cost of repeated index probes —
   * trading time for OOM safety, acceptable for a background job.
   *
   * **Why re-evaluate candidate criteria per ancestor instead of referencing a
   * materialized candidate set:** Each batch's `has_candidate_ancestor` CTE checks
   * ancestor candidacy via index lookups against the base tables, rather than
   * joining to a materialized candidate set. This keeps memory bounded per batch.
   *
   * **All-pruned-batch fallback:** When every candidate in a batch is pruned (each
   * has a candidate ancestor), no rows are inserted but the batch is not exhausted.
   * A separate boundary query re-runs the same candidate criteria to find the page
   * maximum and advance the cursor past the fully-pruned page.
   *
   * Insert-only with ON CONFLICT DO NOTHING — called after `deleteStaleAnchorBatch`
   * removes invalid anchors, so existing valid anchors are simply skipped.
   *
   * The caller (service) manages transaction boundaries — each batch call runs
   * inside its own BEGIN/COMMIT to bound WAL retention and allow VACUUM between batches.
   * ON CONFLICT DO NOTHING makes each batch idempotent, so partial completion
   * followed by retry is safe.
   *
   * @param securityScopeId UUID of the security scope to compute anchors for
   * @param urn URN components resolved via `resolveUrnForScope`
   * @param afterId Keyset cursor — process candidates with submission_feature_id > afterId (pass 0 to start from the beginning)
   * @returns Next cursor position, or null when no more candidates exist
   */
  async computeAnchorBatch(
    securityScopeId: string,
    urn: SecurityScopeUrn,
    afterId: number
  ): Promise<AnchorBatchResult | null> {
    const result = await this.connection.query<{
      submission_feature_id: number;
      page_last_id: number;
    }>(
      `WITH RECURSIVE
       batch AS (
         SELECT candidate.submission_feature_id,
                candidate.parent_submission_feature_id
         FROM submission_feature candidate
         JOIN feature_type ft ON ft.feature_type_id = candidate.feature_type_id
         WHERE ${isSubmissionFeatureActive('candidate')}
           AND candidate.submission_feature_id > $1
           AND ($2 = candidate.submission_id::text OR $2 = '*')
           AND ($3 = ft.name                       OR $3 = '*')
           AND ($4 = candidate.submission_feature_id::text OR $4 = '*')
           AND ${isEffectivelySecured('candidate.submission_feature_id')}
         ORDER BY candidate.submission_feature_id
         LIMIT $5
       ),

       ancestor_walk AS (
         SELECT b.submission_feature_id AS candidate_id,
                b.parent_submission_feature_id AS ancestor_id
         FROM batch b
         WHERE b.parent_submission_feature_id IS NOT NULL

         UNION ALL

         SELECT aw.candidate_id,
                sf.parent_submission_feature_id
         FROM ancestor_walk aw
         JOIN submission_feature sf ON sf.submission_feature_id = aw.ancestor_id
         WHERE sf.parent_submission_feature_id IS NOT NULL
           AND ${isSubmissionFeatureActive('sf')}
       ),

       -- Re-evaluate candidate criteria per ancestor via index lookups.
       -- Trades repeated index probes for bounded memory — acceptable for a bg job.
       has_candidate_ancestor AS (
         SELECT DISTINCT aw.candidate_id
         FROM ancestor_walk aw
         JOIN submission_feature ancestor ON ancestor.submission_feature_id = aw.ancestor_id
         JOIN feature_type ft ON ft.feature_type_id = ancestor.feature_type_id
         WHERE ${isSubmissionFeatureActive('ancestor')}
           AND ($2 = ancestor.submission_id::text OR $2 = '*')
           AND ($3 = ft.name                      OR $3 = '*')
           AND ($4 = ancestor.submission_feature_id::text OR $4 = '*')
           AND ${isEffectivelySecured('ancestor.submission_feature_id')}
       )

       -- Prune to topmost candidates only (anchors). A candidate with a candidate
       -- ancestor is not a root — it's reachable via the walk-up search from the
       -- ancestor anchor, so storing it would be redundant. page_last_id is the MAX
       -- of the full pre-pruning batch so the keyset advances past the entire page.
       SELECT b.submission_feature_id,
              (SELECT MAX(submission_feature_id) FROM batch) AS page_last_id
       FROM batch b
       WHERE NOT EXISTS (
         SELECT 1 FROM has_candidate_ancestor hca
         WHERE hca.candidate_id = b.submission_feature_id
       )`,
      [afterId, urn.urn_submission_id, urn.urn_feature_type, urn.urn_feature_id, SECURITY_SCOPE_ANCHOR_BATCH_SIZE]
    );

    if (result.rows.length > 0) {
      const featureIds = result.rows.map((r) => r.submission_feature_id);

      await this.connection.query(
        `INSERT INTO security_scope_anchor (security_scope_id, anchor_submission_feature_id)
         SELECT $1, unnest($2::INTEGER[])
         ON CONFLICT (security_scope_id, anchor_submission_feature_id) DO NOTHING`,
        [securityScopeId, featureIds]
      );

      return { pageLastId: result.rows[0].page_last_id };
    }

    // All candidates in this batch were pruned (every candidate had a candidate
    // ancestor). Re-query for just the page boundary to advance the keyset.
    // This boundary query uses the same candidate criteria as the batch CTE above —
    // they MUST stay in sync or the keyset will skip/repeat candidates.
    const boundaryResult = await this.connection.query<{ last_id: number }>(
      `SELECT MAX(candidate.submission_feature_id) AS last_id
       FROM (
         SELECT candidate.submission_feature_id
         FROM submission_feature candidate
         JOIN feature_type ft ON ft.feature_type_id = candidate.feature_type_id
         WHERE ${isSubmissionFeatureActive('candidate')}
           AND candidate.submission_feature_id > $1
           AND ($2 = candidate.submission_id::text OR $2 = '*')
           AND ($3 = ft.name                       OR $3 = '*')
           AND ($4 = candidate.submission_feature_id::text OR $4 = '*')
           AND ${isEffectivelySecured('candidate.submission_feature_id')}
         ORDER BY candidate.submission_feature_id
         LIMIT $5
       ) candidate`,
      [afterId, urn.urn_submission_id, urn.urn_feature_type, urn.urn_feature_id, SECURITY_SCOPE_ANCHOR_BATCH_SIZE]
    );

    if (!boundaryResult.rows[0]?.last_id) {
      return null;
    }

    return { pageLastId: boundaryResult.rows[0].last_id };
  }

  /**
   * Filter a list of scope IDs to those with no remaining active approved ALLOW
   * statement references.
   *
   * @param scopeIds Candidate scope IDs to check
   * @returns Scope IDs that no longer grant standing access through any policy
   */
  async findScopeIdsWithoutActiveApprovedAllowStatements(scopeIds: string[]): Promise<SecurityScopeId[]> {
    if (scopeIds.length === 0) {
      return [];
    }

    const knex = getKnex();
    const query = knex
      .select('s.security_scope_id')
      .from(knex.raw('unnest(?::UUID[]) AS s(security_scope_id)', [scopeIds]))
      .whereNotExists(function () {
        this.select(knex.raw('1'))
          .from('policy_statement as ps')
          .join('policy as p', 'p.policy_id', 'ps.policy_id')
          .whereRaw('ps.security_scope_id = s.security_scope_id')
          .whereNull('ps.record_end_date')
          .where('ps.effect', PolicyEffect.ALLOW)
          .whereNull('p.record_end_date')
          .where('p.status', 'approved');
      });

    const response = await this.connection.knex(query, SecurityScopeId);

    return response.rows;
  }

  /**
   * Insert team_security_scope rows for a team's scopes derived from a specific policy.
   *
   * The team-link invariant — cache rows exist iff a live `team_policy` ties the
   * team to an approved policy with at least one ALLOW statement — is enforced
   * in this SQL via the `team_policy` join. A stale caller that holds onto a
   * `(teamId, policyId)` pair after the link has been soft-deleted cannot
   * recreate cache rows; the join filters them out.
   *
   * ON CONFLICT DO NOTHING makes this safe for idempotent calls — a team may
   * already have access to the same scope through a different policy.
   *
   * @param teamId UUID of the team
   * @param policyId UUID of the policy granting scope access
   */
  async insertTeamSecurityScopesForPolicy(teamId: string, policyId: string): Promise<void> {
    const sqlStatement = SQL`
      INSERT INTO team_security_scope (team_id, security_scope_id)
      SELECT tp.team_id, ps.security_scope_id
      FROM team_policy tp
      JOIN policy p
        ON p.policy_id = tp.policy_id
        AND p.status = 'approved'
        AND p.record_end_date IS NULL
      JOIN policy_statement ps
        ON ps.policy_id = p.policy_id
        AND ps.effect = ${PolicyEffect.ALLOW}
        AND ps.record_end_date IS NULL
      JOIN team t
        ON t.team_id = tp.team_id
        AND t.record_end_date IS NULL
      WHERE tp.team_id = ${teamId}
        AND tp.policy_id = ${policyId}
        AND tp.record_end_date IS NULL
      ON CONFLICT (team_id, security_scope_id) DO NOTHING;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Delete all team_security_scope rows for a team.
   *
   * @param teamId UUID of the team
   */
  async deleteTeamSecurityScopes(teamId: string): Promise<void> {
    const sqlStatement = SQL`
      DELETE FROM team_security_scope WHERE team_id = ${teamId};
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Re-derive team_security_scope rows for a team from the active policy chain.
   *
   * Walks team_policy → policy_statement.security_scope_id to find all
   * scopes the team should have access to. ON CONFLICT DO NOTHING handles
   * duplicate scopes reached through multiple policies.
   *
   * @param teamId UUID of the team
   */
  async insertTeamSecurityScopesFromPolicyChain(teamId: string): Promise<void> {
    const sqlStatement = SQL`
      INSERT INTO team_security_scope (team_id, security_scope_id)
      SELECT tp.team_id, ps.security_scope_id
      FROM team_policy tp
      JOIN team t
        ON t.team_id = tp.team_id
        AND t.record_end_date IS NULL
      JOIN policy p
        ON p.policy_id = tp.policy_id
        AND p.record_end_date IS NULL
        AND p.status = 'approved'
      JOIN policy_statement ps
        ON ps.policy_id = tp.policy_id
        AND ps.effect = ${PolicyEffect.ALLOW}
        AND ps.record_end_date IS NULL
      WHERE tp.team_id = ${teamId}
        AND tp.record_end_date IS NULL
      ON CONFLICT (team_id, security_scope_id) DO NOTHING;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Return the active ALLOW statements for an approved policy.
   *
   * The scope cache materializes lazily — when a team gains standing access through
   * a `team_policy` link or when a policy's status flips to `approved`. Only ALLOW
   * statements on an approved policy contribute access; DENY statements record
   * filters but do not produce visible cache rows. Both gates (`policy.status` and
   * `policy_statement.effect`) are enforced here so the service layer can stay thin.
   *
   * Returns an empty array when the policy is not approved, has no active ALLOW
   * statements, or does not exist — callers treat `[]` as a no-op signal.
   *
   * @param policyId UUID of the policy
   * @returns Array of `{ security_scope_id }` for active ALLOW statements
   */
  async findActiveAllowStatementsForApprovedPolicy(policyId: string): Promise<SecurityScopeId[]> {
    const sqlStatement = SQL`
      SELECT DISTINCT ps.security_scope_id
      FROM policy p
      JOIN policy_statement ps
        ON ps.policy_id = p.policy_id
        AND ps.effect = ${PolicyEffect.ALLOW}
        AND ps.record_end_date IS NULL
      WHERE p.policy_id = ${policyId}
        AND p.status = 'approved'
        AND p.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement, SecurityScopeId);

    return response.rows;
  }

  /**
   * Find security_scope IDs whose originating policy statement URN matches a submission.
   *
   * Used when new security rules are applied to features in a submission —
   * finds scopes that may need new anchors computed for the affected submission.
   *
   * A live `team_policy` link is required: a scope without one grants access to
   * no team, so anchor recomputation for it is wasted work. Gating here keeps
   * anchor-compute jobs scoped to the standing-access cache.
   *
   * @param submissionId The submission ID to match against scope URNs
   * @returns Array of SecurityScopeId rows for matching scopes
   */
  async findScopeIdsMatchingSubmission(submissionId: number): Promise<SecurityScopeId[]> {
    const sqlStatement = SQL`
      SELECT DISTINCT ps.security_scope_id
      FROM policy_statement ps
      JOIN security_scope ss ON ss.security_scope_id = ps.security_scope_id
      JOIN policy p ON p.policy_id = ps.policy_id
      JOIN team_policy tp ON tp.policy_id = p.policy_id AND tp.record_end_date IS NULL
      WHERE ps.record_end_date IS NULL
        AND ps.effect = ${PolicyEffect.ALLOW}
        AND p.record_end_date IS NULL
        AND p.status = 'approved'
        AND (ss.urn_submission_id = ${String(submissionId)} OR ss.urn_submission_id = '*');
    `;

    const response = await this.connection.sql(sqlStatement, SecurityScopeId);

    return response.rows;
  }
}
