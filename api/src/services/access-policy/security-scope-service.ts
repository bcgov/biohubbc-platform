import { IDBConnection } from '../../database/db';
import { publishComputeScopeAnchorsJob } from '../../queue/publisher';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import { getLogger } from '../../utils/logger';
import { computeScopeHash } from '../../utils/scope-hash';
import { DBService } from '../db-service';
import { AnchorBatchResult, SecurityScopeUrn } from './security-scope-service.interface';

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
  }

  /**
   * Create a security scope and policy_statement_scope mapping for a policy statement.
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
  async createScopeForPolicyStatement(policyStatementId: string, urn: string): Promise<string> {
    const scopeHash = SecurityScopeService.dependencies.computeScopeHash(urn);

    const inserted = await this.securityScopeRepository.insertSecurityScope(scopeHash);

    if (inserted) {
      // New scope — create mapping and schedule anchor computation
      await this.securityScopeRepository.insertPolicyStatementScope(policyStatementId, inserted.security_scope_id);

      await SecurityScopeService.dependencies.publishComputeScopeAnchorsJob(this.connection, {
        securityScopeId: inserted.security_scope_id
      });

      defaultLog.info({
        label: 'createScopeForPolicyStatement',
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
      label: 'createScopeForPolicyStatement',
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
