import { IDBConnection } from '../../database/db';
import { parseFeatureUrn } from '../../database/urn-utils';
import { SecurityScope } from '../../models/security-scope';
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
 * `security_scope` is intentionally based only on the statement's URN envelope.
 * `policy_expression_id` narrows
 * downstream result/export selection, but it is not part of the standing access
 * envelope used for secured-anchor traversal.
 *
 * Materialization order: policy statements reference reusable `security_scope`
 * rows when they are written. Approval/team-policy changes only rebuild the
 * derived team grants and enqueue anchor recomputation.
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
   * Insert or reuse the canonical security scope for a statement URN.
   *
   * @param urn The submission_feature_urn (e.g., 'urn:10:telemetry:*')
   * @returns The security scope row (new or existing)
   */
  async ensureSecurityScope(urn: string): Promise<SecurityScope> {
    const scopeHash = SecurityScopeService.dependencies.computeScopeHash(urn);
    const urnParts = parseFeatureUrn(urn);
    const scopeUrn: SecurityScopeUrn = {
      urn_submission_id: urnParts.submissionId,
      urn_feature_type: urnParts.featureTypeName,
      urn_feature_id: urnParts.submissionFeatureId
    };

    const securityScope = await this.securityScopeRepository.ensureSecurityScope(scopeHash, scopeUrn);

    defaultLog.info({
      label: 'ensureSecurityScope',
      message: 'Security scope ensured',
      securityScopeId: securityScope.security_scope_id,
      scopeHash
    });

    return securityScope;
  }

  /**
   * Rebuild affected team grants after access-defining policy rows are removed.
   *
   * `security_scope_anchor` is a reusable scope cache and does not grant access
   * on its own. Policy/statement mutations revoke access by rebuilding
   * `team_security_scope`; anchor recomputation is reserved for feature-security
   * and feature-lifecycle changes.
   *
   * @param affectedTeamIds UUIDs of teams that had access through those statements
   */
  async rebuildTeamSecurityScopesForTeams(affectedTeamIds: string[]): Promise<void> {
    for (const teamId of affectedTeamIds) {
      await this.rebuildTeamSecurityScopes(teamId);
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
   * Publishes one anchor-computation job per active ALLOW statement scope on the
   * policy. Scope rows are created when statements are written and are shared
   * across every team that links to the same policy.
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
      await SecurityScopeService.dependencies.publishComputeScopeAnchorsJob(this.connection, {
        securityScopeId: statement.security_scope_id
      });
    }

    return true;
  }

  /**
   * Insert the team-specific `team_security_scope` rows for a (team, policy)
   * pair.
   *
   * Joins `team_policy → policy_statement.security_scope_id` to produce
   * the team's grant rows. The SQL re-asserts both access gates
   * (`p.status='approved'`, `effect='ALLOW'`) and uses `ON CONFLICT DO NOTHING`
   * for idempotency. Callers should invoke `materializePolicyStatementScopes`
   * first so anchor recomputation is queued before team access is visible.
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
    await this.refreshAccessForPolicyTeams(
      policyId,
      teamPolicies.map((teamPolicy) => teamPolicy.team_id)
    );
  }

  /**
   * Reconcile derived access-cache rows for a policy and known linked teams.
   *
   * Use this when the caller has already fetched the team-policy links as part
   * of a larger policy mutation. It avoids re-reading `team_policy` while
   * preserving the same materialize-then-rebuild ordering as
   * `refreshAccessForPolicy`.
   *
   * @param policyId UUID of the policy whose derived access rows should be reconciled
   * @param teamIds UUIDs of linked teams to rebuild
   */
  async refreshAccessForPolicyTeams(policyId: string, teamIds: string[]): Promise<void> {
    if (teamIds.length === 0) {
      return;
    }

    await this.materializePolicyStatementScopes(policyId);

    for (const teamId of teamIds) {
      await this.rebuildTeamSecurityScopes(teamId);
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
   * orphaned scopes — all anchors are stale when no policy statement validates them.
   *
   * @param securityScopeId UUID of the security scope
   * @param afterId Keyset cursor — pass 0 to start from the beginning
   * @returns Next cursor position, or null when no more anchors exist
   */
  async deleteStaleAnchorBatch(securityScopeId: string, afterId: number): Promise<AnchorBatchResult | null> {
    return this.securityScopeRepository.deleteStaleAnchorBatch(securityScopeId, afterId);
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
