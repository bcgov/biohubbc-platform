import SQL from 'sql-template-strings';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { SecurityScope } from '../../models/security-scope';
import { BaseRepository } from '../base-repository';

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
   * Compute anchor features for a security scope using cursor-based batching.
   *
   * Anchors are the root-level secured features whose URN matches the scope's
   * originating policy statement. A `urn:*:telemetry:*` scope anchors at ~200
   * dataset roots that expand to 10M telemetry features. The expansion never
   * happens — the walk-up search strategy checks from the candidate up to the
   * anchor, not from the anchor down.
   *
   * Only features from approved uploads are eligible — features still under
   * review (status = 'submitted') must not affect security scope anchors.
   *
   * Only the topmost secured features (those with no secured ancestor at any
   * depth) are anchors. A secured feature whose parent or grandparent is also
   * secured is not an anchor — only the highest secured node in each chain
   * qualifies. This prevents duplicate walk-up hits when both an ancestor and
   * descendant are secured by the same scope. Uses a recursive CTE to walk the
   * full parent chain — submission_feature trees can be arbitrarily deep.
   *
   * Uses a server-side cursor to avoid materializing the full result set in
   * memory. Wildcard scopes (`urn:*:*:*`) can match millions of secured features;
   * batching prevents memory/WAL/lock pressure from a single massive INSERT.
   * Each batch inserts via `unnest` (two parameters regardless of batch size)
   * rather than a multi-row VALUES clause.
   *
   * @param securityScopeId UUID of the security scope to compute anchors for
   */
  async computeAnchorsForScope(securityScopeId: string): Promise<void> {
    const BATCH_SIZE = 5000;
    const cursorName = `scope_anchor_cursor_${securityScopeId.replace(/[^a-z0-9_]/gi, '_')}`;

    // Declare a server-side cursor over matching root-level secured features.
    // Follows the same pattern as DownloadFragmentRepository.streamFragmentFeaturesByType.
    await this.connection.query(
      `DECLARE ${cursorName} CURSOR FOR
      WITH RECURSIVE scope_urn AS (
        SELECT ps.urn_submission_id, ps.urn_feature_type, ps.urn_feature_id
        FROM policy_statement_scope pss
        JOIN policy_statement ps ON ps.policy_statement_id = pss.policy_statement_id
        WHERE pss.security_scope_id = $1
          AND ps.record_end_date IS NULL
        LIMIT 1
      ),
      -- Candidates: secured features whose URN matches this scope
      candidates AS (
        SELECT sf.submission_feature_id,
               sf.parent_submission_feature_id
        FROM submission_feature sf
        JOIN feature_type ft ON ft.feature_type_id = sf.feature_type_id
        JOIN submission_feature_security sfs
          ON sfs.submission_feature_id = sf.submission_feature_id
          AND sfs.record_end_date IS NULL
        JOIN submission_upload_status sus
          ON sus.submission_upload_id = sf.submission_upload_id
          AND sus.status = 'approved'
        CROSS JOIN scope_urn su
        WHERE sf.record_end_date IS NULL
          AND (su.urn_submission_id = sf.submission_id::text OR su.urn_submission_id = '*')
          AND (su.urn_feature_type = ft.name OR su.urn_feature_type = '*')
          AND (su.urn_feature_id = sf.submission_feature_id::text OR su.urn_feature_id = '*')
      ),
      -- Walk from each candidate up to the root, collecting ancestor IDs
      ancestor_walk AS (
        SELECT c.submission_feature_id AS candidate_id,
               c.parent_submission_feature_id AS ancestor_id
        FROM candidates c
        WHERE c.parent_submission_feature_id IS NOT NULL

        UNION ALL

        SELECT aw.candidate_id,
               sf.parent_submission_feature_id
        FROM ancestor_walk aw
        JOIN submission_feature sf ON sf.submission_feature_id = aw.ancestor_id
        WHERE sf.parent_submission_feature_id IS NOT NULL
          AND sf.record_end_date IS NULL
      ),
      -- Candidates where an ancestor is also a candidate for this same scope
      has_candidate_ancestor AS (
        SELECT DISTINCT aw.candidate_id
        FROM ancestor_walk aw
        WHERE aw.ancestor_id IN (SELECT submission_feature_id FROM candidates)
      )
      SELECT c.submission_feature_id
      FROM candidates c
      WHERE c.submission_feature_id NOT IN (
        SELECT candidate_id FROM has_candidate_ancestor
      )`,
      [securityScopeId]
    );

    try {
      // Fetch and insert in batches to bound memory and WAL usage
      while (true) {
        const fetchResult = await this.connection.query<{ submission_feature_id: number }>(
          `FETCH ${BATCH_SIZE} FROM ${cursorName}`
        );

        if (fetchResult.rows.length === 0) {
          break;
        }

        const featureIds = fetchResult.rows.map((row) => row.submission_feature_id);

        await this.connection.query(
          `INSERT INTO security_scope_anchor (security_scope_id, anchor_submission_feature_id)
           SELECT $1, unnest($2::INTEGER[])
           ON CONFLICT (security_scope_id, anchor_submission_feature_id) DO NOTHING`,
          [securityScopeId, featureIds]
        );

        if (fetchResult.rows.length < BATCH_SIZE) {
          break;
        }
      }
    } finally {
      await this.connection.query(`CLOSE ${cursorName}`);
    }
  }

  /**
   * Delete anchor rows for specific submission features.
   *
   * Called when security rules are removed from features — those features
   * are no longer secured roots and should not be anchors.
   *
   * @param submissionFeatureIds IDs of the features being unsecured
   */
  async deleteAnchorsForFeatures(submissionFeatureIds: number[]): Promise<void> {
    if (submissionFeatureIds.length === 0) {
      return;
    }

    const knex = getKnex();
    const query = knex
      .table('security_scope_anchor')
      .whereIn('anchor_submission_feature_id', submissionFeatureIds)
      .del();

    await this.connection.knex(query);
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
  async getScopeIdsForStatements(policyStatementIds: string[]): Promise<string[]> {
    if (policyStatementIds.length === 0) {
      return [];
    }

    const knex = getKnex();
    const query = knex
      .distinct('security_scope_id')
      .from('policy_statement_scope')
      .whereIn('policy_statement_id', policyStatementIds);

    const response = await this.connection.knex<{ security_scope_id: string }>(query);

    return response.rows.map((row) => row.security_scope_id);
  }

  /**
   * Delete security_scope_anchor rows for scopes that have no remaining
   * policy_statement_scope references (orphaned scopes).
   *
   * When a policy is deleted, its policy_statement_scope rows are removed.
   * If the scope was only referenced by that policy's statements, the scope
   * becomes orphaned — no team can reach it via the policy chain, so its
   * anchors are dead weight. This method cleans them up.
   *
   * Scopes shared by other policy statements are left intact — their anchors
   * are still needed.
   *
   * @param scopeIds Candidate scope IDs to check for orphan status
   */
  async deleteAnchorsForOrphanedScopes(scopeIds: string[]): Promise<void> {
    if (scopeIds.length === 0) {
      return;
    }

    const knex = getKnex();

    // Delete anchors only for scopes with zero remaining policy_statement_scope references.
    // The subquery finds scopes that still have at least one mapping — those are excluded.
    const query = knex
      .table('security_scope_anchor')
      .whereIn('security_scope_id', scopeIds)
      .whereNotIn('security_scope_id', knex.select('security_scope_id').from('policy_statement_scope'))
      .del();

    await this.connection.knex(query);
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
   * Wipe and re-derive team_security_scope for a team.
   *
   * Walks the full team_policy → policy_statement → policy_statement_scope chain
   * to rebuild the team's scope grants from scratch.
   *
   * Why wipe-and-re-derive instead of surgical removal: a team can reach the same
   * scope through multiple policies. Removing scopes from a deleted policy requires
   * a graph reachability check (is the scope still reachable through another policy?).
   * At ~30 rows per team, DELETE + INSERT completes in < 1ms — faster than the
   * reachability query and guaranteed correct.
   *
   * @param teamId UUID of the team to rebuild scopes for
   */
  async rebuildTeamSecurityScopes(teamId: string): Promise<void> {
    const deleteSql = SQL`
      DELETE FROM team_security_scope WHERE team_id = ${teamId};
    `;

    await this.connection.sql(deleteSql);

    const insertSql = SQL`
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

    await this.connection.sql(insertSql);
  }

  /**
   * Find security_scope IDs whose originating policy statement URN matches a submission.
   *
   * Used when new security rules are applied to features in a submission —
   * finds scopes that may need new anchors computed for the affected submission.
   *
   * @param submissionId The submission ID to match against scope URNs
   * @returns Array of security_scope_id strings for matching scopes
   */
  async findScopeIdsMatchingSubmission(submissionId: number): Promise<string[]> {
    const sqlStatement = SQL`
      SELECT DISTINCT pss.security_scope_id
      FROM policy_statement ps
      JOIN policy_statement_scope pss ON pss.policy_statement_id = ps.policy_statement_id
      WHERE ps.record_end_date IS NULL
        AND (ps.urn_submission_id = ${String(submissionId)} OR ps.urn_submission_id = '*');
    `;

    const response = await this.connection.sql(sqlStatement, SecurityScope);

    return response.rows.map((row) => row.security_scope_id);
  }
}
