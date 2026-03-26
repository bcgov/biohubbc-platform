import { IDBConnection } from '../../database/db';
import { publishComputeScopeAnchorsJob } from '../../queue/publisher';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import { getLogger } from '../../utils/logger';
import { computeScopeHash } from '../../utils/scope-hash';
import { DBService } from '../db-service';

const defaultLog = getLogger('security-scope-service');

/**
 * Service for managing normalized security scopes — the access model that replaces
 * the materialized team_feature cache.
 *
 * Orchestrates scope creation, policy-statement-to-scope mapping, team scope
 * derivation, and anchor computation triggers. Repository handles all SQL;
 * this service handles the sequencing and decision logic.
 */
export class SecurityScopeService extends DBService {
  securityScopeRepository: SecurityScopeRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.securityScopeRepository = new SecurityScopeRepository(connection);
  }

  /**
   * Create a security scope and policy_statement_scope mapping for a policy statement.
   *
   * If the scope is new (not previously seen for this URN), publishes a background
   * job to compute anchors — the secured subtree roots that the walk-up search
   * strategy checks against. If the scope already exists, anchors are already
   * computed and no job is needed.
   *
   * @param policyStatementId UUID of the policy statement
   * @param urn The submission_feature_urn (e.g., 'urn:10:telemetry:*')
   * @returns The security_scope_id (new or existing)
   */
  async createScopeForPolicyStatement(policyStatementId: string, urn: string): Promise<string> {
    const scopeHash = computeScopeHash(urn);

    const inserted = await this.securityScopeRepository.insertSecurityScope(scopeHash);

    if (inserted) {
      // New scope — create mapping and schedule anchor computation
      await this.securityScopeRepository.insertPolicyStatementScope(policyStatementId, inserted.security_scope_id);

      await publishComputeScopeAnchorsJob(this.connection, { securityScopeId: inserted.security_scope_id });

      defaultLog.info({
        label: 'createScopeForPolicyStatement',
        message: 'New security scope created, anchor computation job published',
        securityScopeId: inserted.security_scope_id,
        scopeHash
      });

      return inserted.security_scope_id;
    }

    // Existing scope — look up the ID and create the mapping only
    const existing = await this.securityScopeRepository.getSecurityScopeByScopeHash(scopeHash);
    await this.securityScopeRepository.insertPolicyStatementScope(policyStatementId, existing.security_scope_id);

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
        await publishComputeScopeAnchorsJob(this.connection, { securityScopeId: scope.security_scope_id });
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
   * Grant a team access to all scopes derived from a specific policy.
   *
   * Called when a team-policy association is created. Walks the policy's statements
   * to find their mapped scopes and inserts team_security_scope rows.
   *
   * @param teamId UUID of the team
   * @param policyId UUID of the policy being assigned to the team
   */
  async grantTeamScopesForPolicy(teamId: string, policyId: string): Promise<void> {
    await this.securityScopeRepository.insertTeamSecurityScopesForPolicy(teamId, policyId);
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
      await publishComputeScopeAnchorsJob(this.connection, { securityScopeId: scope.security_scope_id });
    }
  }

  /**
   * Compute anchor features for a security scope via delete-stale + batched insert.
   *
   * Three phases:
   * 1. Remove stale anchors — features that no longer meet candidate criteria
   *    (unsecured, unapproved, soft-deleted, or URN mismatch)
   * 2. Resolve URN pattern for this scope
   * 3. Insert new anchors in keyset-paginated batches — ON CONFLICT DO NOTHING
   *    skips features that are already anchored
   *
   * Valid anchors are never deleted, so there is no transient gap where the walk-up
   * search strategy can't find a matching anchor.
   *
   * **Why `onPhaseComplete`:** For broad scopes (`*:*:*`) the batch loop can run
   * thousands of iterations. A single wrapping transaction pins WAL segments and
   * blocks VACUUM for the entire duration — minutes at production scale. The job
   * handler passes a callback that commits and re-begins between phases, bounding
   * WAL retention to one batch's worth of writes. ON CONFLICT DO NOTHING makes
   * each batch idempotent, so partial completion + retry is safe.
   *
   * Without the callback (e.g., integration tests), all phases run in a single
   * transaction — safe for rollback-based test isolation.
   *
   * Called by the compute-scope-anchors background job after scope creation or
   * when security rules change on a submission's features.
   *
   * @param securityScopeId UUID of the security scope to compute anchors for
   * @param onPhaseComplete Optional callback invoked between phases — the job handler
   *   uses this to commit + BEGIN, bounding WAL retention per batch
   */
  async computeAnchorsForScope(securityScopeId: string, onPhaseComplete?: () => Promise<void>): Promise<void> {
    // Phase 1: Remove stale anchors — features that no longer meet candidate criteria.
    // Also handles orphaned scopes (no policy_statement_scope rows) — all anchors are
    // stale when no policy statement validates them.
    await this.securityScopeRepository.deleteStaleAnchorsForScope(securityScopeId);
    await onPhaseComplete?.();

    // Phase 2: Resolve URN pattern for the insert loop
    const urn = await this.securityScopeRepository.resolveUrnForScope(securityScopeId);

    if (!urn) {
      // No active policy statements — stale check already deleted all anchors.
      // If new statements are created later, their scope mapping triggers a fresh job.
      return;
    }

    // Phase 3: Insert new anchors in keyset-paginated batches
    let lastId = 0;

    while (true) {
      const batch = await this.securityScopeRepository.computeAnchorBatch(securityScopeId, urn, lastId);

      if (!batch) {
        break;
      }

      await onPhaseComplete?.();
      lastId = batch.pageLastId;
    }
  }
}
