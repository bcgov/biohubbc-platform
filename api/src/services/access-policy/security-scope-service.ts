import { IDBConnection } from '../../database/db';
import { publishComputeScopeAnchorsJob } from '../../queue/publisher';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import { TeamPolicyRepository } from '../../repositories/authorization/team-policy-repository';
import { getLogger } from '../../utils/logger';
import { computeScopeHash } from '../../utils/scope-hash';
import { DBService } from '../db-service';
import { AnchorBatchResult, SecurityScopeUrn } from './security-scope-service.interface';

const defaultLog = getLogger('security-scope-service');

/**
 * Service for managing the team-access scope cache — the normalized model that
 * replaces the materialized team_feature cache.
 *
 * The cache only describes standing access grants. It materializes lazily when a
 * team gains access through a `team_policy` link or when a policy's status flips
 * to `approved`. Statement creation alone never produces cache rows — a policy
 * without a `team_policy` link is a stored filter expression, not an access grant.
 * Non-access policies (download, data_request, security_reason) consequently
 * leave the cache untouched until they are linked to a team and approved.
 *
 * Materialization order: ALLOW statements on an approved policy are materialized
 * into `security_scope` + `policy_statement_scope` rows before the team-grant
 * insert runs — the team-grant SQL joins through `policy_statement_scope` and
 * requires those rows to already exist in the same connection/transaction.
 *
 * Repository handles all SQL; this service handles sequencing and decision logic.
 */
export class SecurityScopeService extends DBService {
  securityScopeRepository: SecurityScopeRepository;
  teamPolicyRepository: TeamPolicyRepository;

  /**
   * Mutable dependency bag used by tests to avoid stubbing module namespace exports under ESM.
   */
  static readonly dependencies = {
    publishComputeScopeAnchorsJob,
    computeScopeHash
  };

  constructor(connection: IDBConnection) {
    super(connection);
    this.securityScopeRepository = new SecurityScopeRepository(connection);
    this.teamPolicyRepository = new TeamPolicyRepository(connection);
  }

  /**
   * Materialize the `security_scope` + `policy_statement_scope` rows for one
   * policy statement and publish its anchor-computation job.
   *
   * Encapsulates the hash → insert-or-reuse → mapping → publish-anchor-job flow.
   * The caller is `materializePolicyStatementScopes`, which invokes this
   * helper once per active ALLOW statement on an approved policy.
   *
   * Always publishes a background job to compute anchors — the secured subtree
   * roots that the walk-up search strategy checks against. For new scopes this
   * populates anchors from scratch; for existing scopes this covers the case
   * where a URN was changed away and reverted back (orphan cleanup deletes
   * anchors but leaves the scope row). Anchor computation is idempotent
   * (ON CONFLICT DO NOTHING), so re-queuing an already-populated scope is safe.
   *
   * @param policyStatementId UUID of the policy statement
   * @param urn The submission_feature_urn (e.g., 'urn:10:telemetry:*')
   * @returns The security_scope_id (new or existing)
   */
  async materializeScopeForPolicyStatement(policyStatementId: string, urn: string): Promise<string> {
    const scopeHash = SecurityScopeService.dependencies.computeScopeHash(urn);

    const inserted = await this.securityScopeRepository.insertSecurityScope(scopeHash);

    if (inserted) {
      // New scope — create mapping and schedule anchor computation
      await this.securityScopeRepository.insertPolicyStatementScope(policyStatementId, inserted.security_scope_id);

      await SecurityScopeService.dependencies.publishComputeScopeAnchorsJob(this.connection, {
        securityScopeId: inserted.security_scope_id
      });

      defaultLog.info({
        label: 'materializeScopeForPolicyStatement',
        message: 'New security scope created, anchor computation job published',
        securityScopeId: inserted.security_scope_id,
        scopeHash
      });

      return inserted.security_scope_id;
    }

    // Existing scope — look up the ID, create the mapping, and re-queue anchor
    // computation. The scope may have been orphaned and had its anchors cleaned
    // up (e.g., URN changed away then reverted back). Anchor computation is
    // idempotent (ON CONFLICT DO NOTHING), so re-queuing is always safe.
    const existing = await this.securityScopeRepository.getSecurityScopeByScopeHash(scopeHash);
    await this.securityScopeRepository.insertPolicyStatementScope(policyStatementId, existing.security_scope_id);

    await SecurityScopeService.dependencies.publishComputeScopeAnchorsJob(this.connection, {
      securityScopeId: existing.security_scope_id
    });

    defaultLog.info({
      label: 'materializeScopeForPolicyStatement',
      message: 'Existing security scope reused, anchor computation job published',
      securityScopeId: existing.security_scope_id,
      scopeHash
    });

    return existing.security_scope_id;
  }

  /**
   * Clean up policy_statement_scope rows and rebuild team scopes for affected teams.
   *
   * Called when policy statements are soft-deleted. The derived scope mappings must
   * be removed, and every affected team's scope grants must be re-derived from the
   * remaining active policy chain.
   *
   * @param policyStatementIds UUIDs of the soft-deleted policy statements
   * @param affectedTeamIds UUIDs of teams that had access through those statements
   */
  async cleanupScopesForDeletedStatements(policyStatementIds: string[], affectedTeamIds: string[]): Promise<void> {
    // Gather scope IDs BEFORE deleting mappings — need to know which scopes may become orphaned
    const affectedScopes = await this.securityScopeRepository.findScopeIdsForStatements(policyStatementIds);

    await this.securityScopeRepository.deletePolicyStatementScopes(policyStatementIds);

    for (const teamId of affectedTeamIds) {
      await this.rebuildTeamSecurityScopes(teamId);
    }

    // Trigger anchor cleanup for scopes that lost all policy_statement_scope
    // references. The job owns the security_scope_anchor table — it will resolve
    // URN to null for orphaned scopes and delete their anchors.
    // Shared scopes (still referenced by other statements) are skipped — their
    // anchors are unchanged because the scope's URN hasn't changed.
    if (affectedScopes.length > 0) {
      const scopeIds = affectedScopes.map((s) => s.security_scope_id);
      const orphaned = await this.securityScopeRepository.findOrphanedScopeIds(scopeIds);

      for (const scope of orphaned) {
        await SecurityScopeService.dependencies.publishComputeScopeAnchorsJob(this.connection, {
          securityScopeId: scope.security_scope_id
        });
      }
    }
  }

  /**
   * Wipe and re-derive team_security_scope for a team from the full policy chain.
   *
   * A team can reach the same scope through multiple policies. Surgically removing
   * one policy's scopes requires checking whether each scope is still reachable
   * through another policy — a graph reachability problem. At ~30 rows per team,
   * DELETE + INSERT is faster than the reachability query and guaranteed correct.
   *
   * @param teamId UUID of the team to rebuild
   */
  async rebuildTeamSecurityScopes(teamId: string): Promise<void> {
    await this.securityScopeRepository.deleteTeamSecurityScopes(teamId);
    await this.securityScopeRepository.insertTeamSecurityScopesFromPolicyChain(teamId);
  }

  /**
   * Materialize the policy-wide access-cache rows for a policy's ALLOW statements.
   *
   * Inserts (or de-duplicates by hash) `security_scope` and
   * `policy_statement_scope` rows for every active ALLOW statement on the
   * policy, and publishes one anchor-computation job per scope. These rows are
   * shared across every team that links to the same policy.
   *
   * Both access gates (`policy.status='approved'`, `policy_statement.effect='ALLOW'`)
   * live in the SQL that returns the statement list. When the repository
   * returns `[]` — either gate filtered everything out — the method
   * short-circuits and returns `false` so callers can skip the team-grant step.
   * Statements are processed sequentially (not via `Promise.all`) so a
   * publish-anchor-job failure aborts before more work is queued.
   *
   * This is the policy-wide half of the lazy-materialization entry point.
   * Callers that also need to grant team access for this policy should invoke
   * `grantTeamAccessForPolicy(teamId, policyId)` after this method returns
   * `true`. Splitting the calls lets the fan-out path (one policy → N teams)
   * materialize statement scopes once and only loop per team for the team-grant
   * insert.
   *
   * @param policyId UUID of the policy whose ALLOW statements should be materialized
   * @returns `true` if statement scopes were materialized, `false` if the policy
   *   had no active ALLOW statements (gate-filtered or not approved)
   */
  async materializePolicyStatementScopes(policyId: string): Promise<boolean> {
    const statements = await this.securityScopeRepository.findActiveAllowStatementsForApprovedPolicy(policyId);

    if (statements.length === 0) {
      return false;
    }

    for (const statement of statements) {
      await this.materializeScopeForPolicyStatement(statement.policy_statement_id, statement.submission_feature_urn);
    }

    return true;
  }

  /**
   * Insert the team-specific `team_security_scope` rows for a (team, policy)
   * pair.
   *
   * Joins `team_policy → policy_statement → policy_statement_scope` to produce
   * the team's grant rows. The SQL re-asserts both access gates
   * (`p.status='approved'`, `effect='ALLOW'`) and uses `ON CONFLICT DO NOTHING`
   * for idempotency. Callers should invoke `materializePolicyStatementScopes`
   * first when the policy may not yet have its scope mappings — otherwise the
   * join returns zero rows and no access is granted.
   *
   * @param teamId UUID of the team gaining access
   * @param policyId UUID of the policy whose ALLOW statements grant the access
   */
  async grantTeamAccessForPolicy(teamId: string, policyId: string): Promise<void> {
    await this.securityScopeRepository.insertTeamSecurityScopesForPolicy(teamId, policyId);
  }

  /**
   * Convenience wrapper for the common single-(team, policy) materialization
   * sequence: materialize the policy's statement scopes, then grant the team's
   * access. Equivalent to:
   *
   *   const materialized = await materializePolicyStatementScopes(policyId);
   *   if (materialized) await grantTeamAccessForPolicy(teamId, policyId);
   *
   * Fan-out callers (one policy → N teams) should call the two methods
   * directly so the statement-scope materialization runs once, not per team.
   *
   * @param teamId UUID of the team gaining access
   * @param policyId UUID of the policy whose ALLOW statements grant the access
   */
  async materializeStatementScopesAndTeamAccess(teamId: string, policyId: string): Promise<void> {
    const materialized = await this.materializePolicyStatementScopes(policyId);
    if (materialized) {
      await this.grantTeamAccessForPolicy(teamId, policyId);
    }
  }

  /**
   * Reconcile all derived access-cache rows for a policy after an access-defining
   * policy source changes.
   *
   * The source write has already happened before this method is called. This
   * method materializes the current approved ALLOW statement scopes, then
   * rebuilds each linked team's access grants from the current policy chain.
   * Rebuilding instead of only inserting is important for mutations that can
   * remove access, such as DENY changes, status gates, deleted statements, or
   * changed statement URNs. Statement expression links are export filters, not
   * standing access grants, so changing only `policy_expression_id` does not need
   * this rebuild.
   *
   * @param policyId UUID of the policy whose derived access rows should be reconciled
   */
  async refreshAccessForPolicy(policyId: string): Promise<void> {
    const teamPolicies = await this.teamPolicyRepository.getTeamPolicies({ policyIds: [policyId] });

    if (teamPolicies.length === 0) {
      return;
    }

    await this.materializePolicyStatementScopes(policyId);

    for (const teamPolicy of teamPolicies) {
      await this.rebuildTeamSecurityScopes(teamPolicy.team_id);
    }
  }

  /**
   * Find scopes matching a submission and trigger anchor recomputation.
   *
   * Called when security rules are applied to features in a submission.
   * New secured features may become anchors for existing scopes that cover
   * the affected submission's URN pattern.
   *
   * @param submissionId The submission whose features gained security rules
   */
  async triggerAnchorComputationForSubmission(submissionId: number): Promise<void> {
    const scopes = await this.securityScopeRepository.findScopeIdsMatchingSubmission(submissionId);

    if (scopes.length === 0) {
      return;
    }

    for (const scope of scopes) {
      await SecurityScopeService.dependencies.publishComputeScopeAnchorsJob(this.connection, {
        securityScopeId: scope.security_scope_id
      });
    }
  }

  /**
   * Delete one keyset-paginated batch of stale anchors for a security scope.
   *
   * Removes anchors for features that no longer meet candidate criteria
   * (unsecured, unapproved, soft-deleted, or URN mismatch). Also handles
   * orphaned scopes (no policy_statement_scope rows) — all anchors are stale
   * when no policy statement validates them.
   *
   * @param securityScopeId UUID of the security scope
   * @param afterId Keyset cursor — pass 0 to start from the beginning
   * @returns Next cursor position, or null when no more anchors exist
   */
  async deleteStaleAnchorBatch(securityScopeId: string, afterId: number): Promise<AnchorBatchResult | null> {
    return this.securityScopeRepository.deleteStaleAnchorBatch(securityScopeId, afterId);
  }

  /**
   * Clean up all derived data for an orphaned scope — anchors and team grants.
   *
   * Used for orphaned scopes (no active policy statements) — avoids running the
   * expensive effectively-secured CTE when the outcome is always "delete everything."
   *
   * @param securityScopeId UUID of the orphaned security scope
   */
  async deleteOrphanedScopeData(securityScopeId: string): Promise<void> {
    await this.securityScopeRepository.deleteOrphanedScopeData(securityScopeId);
  }

  /**
   * Resolve the URN pattern for a security scope.
   *
   * @param securityScopeId UUID of the security scope
   * @returns URN components, or null if no active policy statements reference this scope
   */
  async resolveUrnForScope(securityScopeId: string): Promise<SecurityScopeUrn | null> {
    return this.securityScopeRepository.resolveUrnForScope(securityScopeId);
  }

  /**
   * Insert one keyset-paginated batch of anchor rows.
   *
   * ON CONFLICT DO NOTHING skips features that are already anchored, making each
   * batch idempotent and safe for partial completion + retry.
   *
   * @param securityScopeId UUID of the security scope
   * @param urn URN components resolved via `resolveUrnForScope`
   * @param afterId Keyset cursor — pass 0 to start from the beginning
   * @returns Next cursor position, or null when no more candidates exist
   */
  async computeAnchorBatch(
    securityScopeId: string,
    urn: SecurityScopeUrn,
    afterId: number
  ): Promise<AnchorBatchResult | null> {
    return this.securityScopeRepository.computeAnchorBatch(securityScopeId, urn, afterId);
  }
}
