import SQL from 'sql-template-strings';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { SecurityScope, SecurityScopeId } from '../../models/security-scope';
import { AnchorBatchResult, SecurityScopeUrn } from '../../services/access-policy/security-scope-service.interface';
import { BaseRepository } from '../base-repository';

/**
 * Recursive CTE fragment: computes all features that are "effectively secured" —
 * directly secured via submission_feature_security or inheriting security from an
 * ancestor. Security rules on a parent cascade to all descendants.
 *
 * Used as a WITH RECURSIVE preamble in anchor computation and stale-anchor cleanup.
 * UNION (not UNION ALL) deduplicates and prevents re-walking already-visited subtrees.
 */
const EFFECTIVELY_SECURED_CTE = `effectively_secured(submission_feature_id) AS (
         SELECT sfs.submission_feature_id
         FROM submission_feature_security sfs
         WHERE sfs.record_end_date IS NULL
         UNION
         SELECT child.submission_feature_id
         FROM submission_feature child
         JOIN effectively_secured es ON child.parent_submission_feature_id = es.submission_feature_id
         WHERE child.record_end_date IS NULL
       )`;

/**
 * Repository for security scope tables — the normalized access model that replaces
 * the materialized team_feature cache.
 *
 * All four scope tables (`security_scope`, `policy_statement_scope`,
 * `security_scope_anchor`, `team_security_scope`) are derived data.
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
   * @returns The inserted SecurityScope, or null if scope_hash already exists
   */
  async insertSecurityScope(scopeHash: string): Promise<SecurityScope | null> {
    const sqlStatement = SQL`
      INSERT INTO security_scope (scope_hash)
      VALUES (${scopeHash})
      ON CONFLICT (scope_hash) DO NOTHING
      RETURNING security_scope_id, scope_hash;
    `;

    const response = await this.connection.sql(sqlStatement, SecurityScope);

    if (response.rowCount === 0) {
      return null;
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
   * Create a mapping between a policy statement and a security scope.
   *
   * One policy statement maps to exactly one scope. Multiple statements
   * can share the same scope (via scope_hash deduplication).
   *
   * @param policyStatementId UUID of the policy statement
   * @param securityScopeId UUID of the security scope
   */
  async insertPolicyStatementScope(policyStatementId: string, securityScopeId: string): Promise<void> {
    const sqlStatement = SQL`
      INSERT INTO policy_statement_scope (policy_statement_id, security_scope_id)
      VALUES (${policyStatementId}, ${securityScopeId})
      ON CONFLICT (policy_statement_id) DO NOTHING;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Hard-delete policy_statement_scope rows for the given policy statement IDs.
   *
   * Called when policy statements are soft-deleted — the derived mapping must be
   * cleaned up even though the source policy_statement uses soft-delete.
   * Scope tables are derived data with no audit trail requirement.
   *
   * @param policyStatementIds UUIDs of the policy statements being removed
   */
  async deletePolicyStatementScopes(policyStatementIds: string[]): Promise<void> {
    if (policyStatementIds.length === 0) {
      return;
    }

    const knex = getKnex();
    const query = knex.table('policy_statement_scope').whereIn('policy_statement_id', policyStatementIds).del();

    await this.connection.knex(query);
  }

  /**
   * Delete stale anchors for a security scope — anchors whose features no longer
   * meet candidate criteria.
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
   * Handles both live and orphaned scopes: an anchor is stale if NO active policy
   * statement validates it. For orphaned scopes (zero policy_statement_scope rows),
   * the NOT EXISTS subquery finds nothing, so all anchors are deleted.
   *
   * @param securityScopeId UUID of the security scope to clean stale anchors for
   */
  async deleteStaleAnchorsForScope(securityScopeId: string): Promise<void> {
    await this.connection.query(
      `-- Delete anchors that no active policy statement validates.
       -- For orphaned scopes (no policy_statement_scope rows), every anchor
       -- fails the NOT EXISTS check and gets deleted.
       WITH RECURSIVE
       ${EFFECTIVELY_SECURED_CTE}
       DELETE FROM security_scope_anchor ssa
       WHERE ssa.security_scope_id = $1
         AND NOT EXISTS (
           SELECT 1
           -- Walk the scope → policy statement chain to find the URN pattern
           FROM policy_statement_scope pss
           JOIN policy_statement ps ON ps.policy_statement_id = pss.policy_statement_id
           -- Look up the anchored feature and its type
           JOIN submission_feature sf ON sf.submission_feature_id = ssa.anchor_submission_feature_id
           JOIN feature_type ft ON ft.feature_type_id = sf.feature_type_id
           WHERE pss.security_scope_id = $1
             -- Policy statement must be active (not soft-deleted)
             AND ps.record_end_date IS NULL
             -- Feature must be active (not soft-deleted)
             AND sf.record_end_date IS NULL
             -- Feature must match the scope's URN pattern
             AND (ps.urn_submission_id = sf.submission_id::text OR ps.urn_submission_id = '*')
             AND (ps.urn_feature_type = ft.name                OR ps.urn_feature_type = '*')
             AND (ps.urn_feature_id = sf.submission_feature_id::text OR ps.urn_feature_id = '*')
             -- Feature must be effectively secured (directly or via ancestor)
             AND EXISTS (
               SELECT 1 FROM effectively_secured es
               WHERE es.submission_feature_id = sf.submission_feature_id
             )
             -- Feature must be from an approved upload
             AND sf.record_effective_date <= now()
         )`,
      [securityScopeId]
    );
  }

  /**
   * Resolve the URN pattern for a security scope.
   *
   * Returns the URN components (submission_id, feature_type, feature_id) from the
   * scope's originating policy statement. LIMIT 1 without ORDER BY is safe: scope_hash
   * = SHA-256(urn), so all policy statements sharing a scope have identical URN components.
   *
   * @param securityScopeId UUID of the security scope
   * @returns URN components, or null if the scope has no active policy statements
   */
  async resolveUrnForScope(securityScopeId: string): Promise<SecurityScopeUrn | null> {
    const result = await this.connection.query<SecurityScopeUrn>(
      `SELECT ps.urn_submission_id, ps.urn_feature_type, ps.urn_feature_id
       FROM policy_statement_scope pss
       JOIN policy_statement ps ON ps.policy_statement_id = pss.policy_statement_id
       WHERE pss.security_scope_id = $1
         AND ps.record_end_date IS NULL
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
   * `urn:*:telemetry:*` anchors telemetry features whose parent dataset is
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
   * Insert-only with ON CONFLICT DO NOTHING — called after `deleteStaleAnchorsForScope`
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
    const BATCH_SIZE = 5000;

    const result = await this.connection.query<{
      submission_feature_id: number;
      page_last_id: number;
    }>(
      `WITH RECURSIVE
       ${EFFECTIVELY_SECURED_CTE},

       batch AS (
         SELECT sf.submission_feature_id,
                sf.parent_submission_feature_id
         FROM submission_feature sf
         JOIN feature_type ft ON ft.feature_type_id = sf.feature_type_id
         WHERE sf.record_end_date IS NULL
           AND sf.submission_feature_id > $1
           AND ($2 = sf.submission_id::text OR $2 = '*')
           AND ($3 = ft.name                OR $3 = '*')
           AND ($4 = sf.submission_feature_id::text OR $4 = '*')
           AND EXISTS (
             SELECT 1 FROM effectively_secured es
             WHERE es.submission_feature_id = sf.submission_feature_id
           )
           AND sf.record_effective_date <= now()
         ORDER BY sf.submission_feature_id
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
           AND sf.record_end_date IS NULL
       ),

       -- Re-evaluate candidate criteria per ancestor via index lookups.
       -- Trades repeated index probes for bounded memory — acceptable for a bg job.
       has_candidate_ancestor AS (
         SELECT DISTINCT aw.candidate_id
         FROM ancestor_walk aw
         JOIN submission_feature sf ON sf.submission_feature_id = aw.ancestor_id
         JOIN feature_type ft ON ft.feature_type_id = sf.feature_type_id
         WHERE sf.record_end_date IS NULL
           AND ($2 = sf.submission_id::text OR $2 = '*')
           AND ($3 = ft.name               OR $3 = '*')
           AND ($4 = sf.submission_feature_id::text OR $4 = '*')
           AND EXISTS (
             SELECT 1 FROM effectively_secured es
             WHERE es.submission_feature_id = sf.submission_feature_id
           )
           AND sf.record_effective_date <= now()
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
      [afterId, urn.urn_submission_id, urn.urn_feature_type, urn.urn_feature_id, BATCH_SIZE]
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
      `WITH RECURSIVE
       ${EFFECTIVELY_SECURED_CTE}
       SELECT MAX(sf.submission_feature_id) AS last_id
       FROM (
         SELECT sf.submission_feature_id
         FROM submission_feature sf
         JOIN feature_type ft ON ft.feature_type_id = sf.feature_type_id
         WHERE sf.record_end_date IS NULL
           AND sf.submission_feature_id > $1
           AND ($2 = sf.submission_id::text OR $2 = '*')
           AND ($3 = ft.name               OR $3 = '*')
           AND ($4 = sf.submission_feature_id::text OR $4 = '*')
           AND EXISTS (
             SELECT 1 FROM effectively_secured es
             WHERE es.submission_feature_id = sf.submission_feature_id
           )
           AND sf.record_effective_date <= now()
         ORDER BY sf.submission_feature_id
         LIMIT $5
       ) sf`,
      [afterId, urn.urn_submission_id, urn.urn_feature_type, urn.urn_feature_id, BATCH_SIZE]
    );

    if (!boundaryResult.rows[0]?.last_id) {
      return null;
    }

    return { pageLastId: boundaryResult.rows[0].last_id };
  }

  /**
   * Get the security_scope_id for each of the given policy statement IDs.
   *
   * Called before deleting policy_statement_scope rows so the service can
   * identify which scopes may become orphaned after deletion.
   *
   * @param policyStatementIds UUIDs of the policy statements
   * @returns Distinct security_scope_id values referenced by those statements
   */
  async findScopeIdsForStatements(policyStatementIds: string[]): Promise<SecurityScopeId[]> {
    if (policyStatementIds.length === 0) {
      return [];
    }

    const knex = getKnex();
    const query = knex
      .distinct('security_scope_id')
      .from('policy_statement_scope')
      .whereIn('policy_statement_id', policyStatementIds);

    const response = await this.connection.knex(query, SecurityScopeId);

    return response.rows;
  }

  /**
   * Filter a list of scope IDs to those with no remaining policy_statement_scope
   * references. Called after deleting policy_statement_scope rows to identify
   * which scopes became orphaned and need anchor cleanup via the background job.
   *
   * @param scopeIds Candidate scope IDs to check
   * @returns Scope IDs that have zero policy_statement_scope references
   */
  async findOrphanedScopeIds(scopeIds: string[]): Promise<SecurityScopeId[]> {
    if (scopeIds.length === 0) {
      return [];
    }

    const knex = getKnex();
    const query = knex
      .select('s.security_scope_id')
      .from(knex.raw('unnest(?::UUID[]) AS s(security_scope_id)', [scopeIds]))
      .whereNotIn('s.security_scope_id', knex.select('security_scope_id').from('policy_statement_scope'));

    const response = await this.connection.knex(query, SecurityScopeId);

    return response.rows;
  }

  /**
   * Insert team_security_scope rows for a team's scopes derived from a specific policy.
   *
   * Walks the policy → policy_statement → policy_statement_scope chain to find
   * all scopes granted by the policy, then inserts team_security_scope rows.
   * ON CONFLICT DO NOTHING makes this safe for idempotent calls — a team may
   * already have access to the same scope through a different policy.
   *
   * @param teamId UUID of the team
   * @param policyId UUID of the policy granting scope access
   */
  async insertTeamSecurityScopesForPolicy(teamId: string, policyId: string): Promise<void> {
    const sqlStatement = SQL`
      INSERT INTO team_security_scope (team_id, security_scope_id)
      SELECT ${teamId}, pss.security_scope_id
      FROM policy_statement ps
      JOIN policy_statement_scope pss ON pss.policy_statement_id = ps.policy_statement_id
      WHERE ps.policy_id = ${policyId}
        AND ps.record_end_date IS NULL
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
   * Walks team_policy → policy_statement → policy_statement_scope to find all
   * scopes the team should have access to. ON CONFLICT DO NOTHING handles
   * duplicate scopes reached through multiple policies.
   *
   * @param teamId UUID of the team
   */
  async insertTeamSecurityScopesFromPolicyChain(teamId: string): Promise<void> {
    const sqlStatement = SQL`
      INSERT INTO team_security_scope (team_id, security_scope_id)
      SELECT tp.team_id, pss.security_scope_id
      FROM team_policy tp
      JOIN policy_statement ps
        ON ps.policy_id = tp.policy_id
        AND ps.record_end_date IS NULL
      JOIN policy_statement_scope pss
        ON pss.policy_statement_id = ps.policy_statement_id
      WHERE tp.team_id = ${teamId}
        AND tp.record_end_date IS NULL
      ON CONFLICT (team_id, security_scope_id) DO NOTHING;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Find security_scope IDs whose originating policy statement URN matches a submission.
   *
   * Used when new security rules are applied to features in a submission —
   * finds scopes that may need new anchors computed for the affected submission.
   *
   * @param submissionId The submission ID to match against scope URNs
   * @returns Array of SecurityScopeId rows for matching scopes
   */
  async findScopeIdsMatchingSubmission(submissionId: number): Promise<SecurityScopeId[]> {
    const sqlStatement = SQL`
      SELECT DISTINCT pss.security_scope_id
      FROM policy_statement ps
      JOIN policy_statement_scope pss ON pss.policy_statement_id = ps.policy_statement_id
      WHERE ps.record_end_date IS NULL
        AND (ps.urn_submission_id = ${String(submissionId)} OR ps.urn_submission_id = '*');
    `;

    const response = await this.connection.sql(sqlStatement, SecurityScopeId);

    return response.rows;
  }
}
