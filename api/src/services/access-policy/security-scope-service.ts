import { IDBConnection } from '../../database/db';
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

      // TODO: Phase 3 — publishComputeScopeAnchorsJob(this.connection, { securityScopeId: inserted.security_scope_id })
      defaultLog.info({
        label: 'createScopeForPolicyStatement',
        message: 'New security scope created, anchor computation pending Phase 3',
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
    await this.securityScopeRepository.deletePolicyStatementScopes(policyStatementIds);

    for (const teamId of affectedTeamIds) {
      await this.securityScopeRepository.rebuildTeamSecurityScopes(teamId);
    }
  }

  /**
   * Rebuild team_security_scope for a team by re-deriving from the full policy chain.
   *
   * Synchronous because team_security_scope holds ~30 rows per team at scale.
   * DELETE + INSERT of 30 rows completes in < 1ms. The old team_feature rebuild
   * moved millions of rows and required an async pg-boss job.
   *
   * @param teamId UUID of the team to rebuild
   */
  async rebuildTeamSecurityScopes(teamId: string): Promise<void> {
    await this.securityScopeRepository.rebuildTeamSecurityScopes(teamId);
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
    const scopeIds = await this.securityScopeRepository.findScopeIdsMatchingSubmission(submissionId);

    if (scopeIds.length === 0) {
      return;
    }

    // TODO: Phase 3 — publish anchor computation jobs for each scope
    for (const securityScopeId of scopeIds) {
      defaultLog.info({
        label: 'triggerAnchorComputationForSubmission',
        message: 'Anchor computation pending Phase 3',
        securityScopeId,
        submissionId
      });
    }
  }

  /**
   * Delete anchors for specific features.
   *
   * Called when security rules are removed from features — those features
   * are no longer secured roots and should not be referenced as anchors.
   *
   * @param submissionFeatureIds IDs of the features being unsecured
   */
  async deleteAnchorsForFeatures(submissionFeatureIds: number[]): Promise<void> {
    await this.securityScopeRepository.deleteAnchorsForFeatures(submissionFeatureIds);
  }
}
