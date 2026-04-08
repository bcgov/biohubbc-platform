/**
 * Shared RBAC test helpers for integration tests that need security scopes,
 * teams, policies, and anchor computation.
 *
 * All functions accept an IDBConnection (transaction-scoped) so they participate
 * in the test's rollback isolation.
 */
import SQL from 'sql-template-strings';
import { IDBConnection } from '../../database/db';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import { computeScopeHash } from '../../utils/scope-hash';

/**
 * Mark a submission feature as secured.
 * Uses security_rule_id 1 from seed data.
 */
export async function secureFeature(connection: IDBConnection, submissionFeatureId: number): Promise<void> {
  const systemUserId = connection.systemUserId();
  await connection.sql(SQL`
    INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, create_user)
    VALUES (${submissionFeatureId}, 1, ${systemUserId});
  `);
}

export async function createTeam(connection: IDBConnection, name: string): Promise<string> {
  const systemUserId = connection.systemUserId();
  const result = await connection.sql(SQL`
    INSERT INTO team (name, create_user)
    VALUES (${name}, ${systemUserId})
    RETURNING team_id;
  `);
  return result.rows[0].team_id;
}

export async function addTeamMember(connection: IDBConnection, teamId: string, systemUserId: number): Promise<void> {
  const apiUserId = connection.systemUserId();
  await connection.sql(SQL`
    INSERT INTO team_member (team_id, system_user_id, create_user)
    VALUES (${teamId}, ${systemUserId}, ${apiUserId});
  `);
}

export async function createPolicy(connection: IDBConnection, name: string): Promise<string> {
  const systemUserId = connection.systemUserId();
  const result = await connection.sql(SQL`
    INSERT INTO policy (name, create_user)
    VALUES (${name}, ${systemUserId})
    RETURNING policy_id;
  `);
  return result.rows[0].policy_id;
}

/**
 * Create a policy statement with the given URN.
 * The DB trigger auto-decomposes the URN into indexed columns.
 */
export async function createPolicyStatement(connection: IDBConnection, policyId: string, urn: string): Promise<string> {
  const systemUserId = connection.systemUserId();
  const result = await connection.sql(SQL`
    INSERT INTO policy_statement (policy_id, effect, submission_feature_urn, create_user)
    VALUES (${policyId}, 'allow', ${urn}, ${systemUserId})
    RETURNING policy_statement_id;
  `);
  return result.rows[0].policy_statement_id;
}

export async function createTeamPolicy(connection: IDBConnection, teamId: string, policyId: string): Promise<string> {
  const systemUserId = connection.systemUserId();
  const result = await connection.sql(SQL`
    INSERT INTO team_policy (team_id, policy_id, create_user)
    VALUES (${teamId}, ${policyId}, ${systemUserId})
    RETURNING team_policy_id;
  `);
  return result.rows[0].team_policy_id;
}

/**
 * Compute anchors for a scope using the split repo API (resolveUrn + batch loop).
 * No commits between batches — stays in the test's wrapping transaction for rollback isolation.
 */
export async function computeAnchors(scopeRepo: SecurityScopeRepository, scopeId: string): Promise<void> {
  const urn = await scopeRepo.resolveUrnForScope(scopeId);

  if (!urn) {
    return;
  }

  let lastId = 0;

  while (true) {
    const batch = await scopeRepo.computeAnchorBatch(scopeId, urn, lastId);

    if (!batch) {
      break;
    }

    lastId = batch.pageLastId;
  }
}

/**
 * Set up the full scope chain for a policy statement, bypassing pg-boss:
 * 1. Create or get security_scope (deduped by scope_hash)
 * 2. Map policy_statement → security_scope
 * 3. Compute anchors synchronously
 * Returns the security_scope_id.
 */
export async function setupScopeChain(
  scopeRepo: SecurityScopeRepository,
  policyStatementId: string,
  urn: string
): Promise<string> {
  const scopeHash = computeScopeHash(urn);
  const inserted = await scopeRepo.insertSecurityScope(scopeHash);

  const scopeId = inserted
    ? inserted.security_scope_id
    : (await scopeRepo.getSecurityScopeByScopeHash(scopeHash)).security_scope_id;

  await scopeRepo.insertPolicyStatementScope(policyStatementId, scopeId);
  await computeAnchors(scopeRepo, scopeId);

  return scopeId;
}

/**
 * Full RBAC setup: policy → statement → scope chain → team → member → team-policy → team scopes.
 * Returns all created IDs for assertions.
 */
export async function setupFullAccess(
  connection: IDBConnection,
  scopeRepo: SecurityScopeRepository,
  urn: string,
  userId: number,
  teamName: string
): Promise<{ policyId: string; stmtId: string; scopeId: string; teamId: string }> {
  const policyId = await createPolicy(connection, `${teamName}-policy`);
  const stmtId = await createPolicyStatement(connection, policyId, urn);
  const scopeId = await setupScopeChain(scopeRepo, stmtId, urn);

  const teamId = await createTeam(connection, teamName);
  await addTeamMember(connection, teamId, userId);
  await createTeamPolicy(connection, teamId, policyId);
  await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyId);

  return { policyId, stmtId, scopeId, teamId };
}
