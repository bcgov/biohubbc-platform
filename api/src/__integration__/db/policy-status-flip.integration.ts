// Integration test for SIMSBIOHUB-985 — verifies that team_security_scope rows
// are materialized only when (a) a team_policy links a team to an (b) approved
// policy with (c) ≥1 ALLOW statement, and that downgrades / DENY-only / ended
// statements all correctly produce zero rows or remove existing rows.
//
// Status-flip orchestration runs through PolicyService.updatePolicy; team_policy
// delete runs through TeamPolicyService.deleteTeamPolicy. The DB is the source
// of truth for assertions — we read row counts directly, not via stubs.
//
// pg-boss is not running in `make test-db`; the anchor-publish dependency is
// stubbed so the materialize path can proceed without enqueueing jobs.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { PolicyService } from '../../services/access-policy/policy-service';
import { SecurityScopeService } from '../../services/access-policy/security-scope-service';
import { computeScopeHash } from '../../utils/scope-hash';
import { createTeam } from '../helpers/test-rbac-helpers';

describe('Policy status flip + lazy scope materialization (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let policyService: PolicyService;
  let scopeService: SecurityScopeService;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    policyService = new PolicyService(connection);
    scopeService = new SecurityScopeService(connection);

    sinon
      .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
      .resolves({ status: 'published', jobId: 'stub-job-id' });
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
    sinon.restore();
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  async function insertPolicy(name: string, status: 'requested' | 'reviewed' | 'approved' | 'denied'): Promise<string> {
    const systemUserId = connection.systemUserId();
    const result = await connection.sql(SQL`
      INSERT INTO policy (name, status, create_user)
      VALUES (${name}, ${status}::policy_status, ${systemUserId})
      RETURNING policy_id;
    `);
    return result.rows[0].policy_id;
  }

  async function insertStatement(policyId: string, urn: string, effect: 'allow' | 'deny'): Promise<string> {
    const systemUserId = connection.systemUserId();
    const scopeHash = computeScopeHash(urn);
    const [, urnSubmissionId, urnFeatureType, urnFeatureId] = urn.split(':');
    const scopeResult = await connection.sql(SQL`
      INSERT INTO security_scope (scope_hash, urn_submission_id, urn_feature_type, urn_feature_id)
      VALUES (${scopeHash}, ${urnSubmissionId}, ${urnFeatureType}, ${urnFeatureId})
      ON CONFLICT (scope_hash) DO UPDATE SET scope_hash = EXCLUDED.scope_hash
      RETURNING security_scope_id;
    `);
    const securityScopeId = scopeResult.rows[0].security_scope_id;

    const result = await connection.sql(SQL`
      INSERT INTO policy_statement (policy_id, effect, security_scope_id, create_user)
      VALUES (${policyId}, ${effect}::policy_effect, ${securityScopeId}, ${systemUserId})
      RETURNING policy_statement_id;
    `);
    return result.rows[0].policy_statement_id;
  }

  async function insertTeamPolicy(teamId: string, policyId: string): Promise<string> {
    const systemUserId = connection.systemUserId();
    const result = await connection.sql(SQL`
      INSERT INTO team_policy (team_id, policy_id, create_user)
      VALUES (${teamId}, ${policyId}, ${systemUserId})
      RETURNING team_policy_id;
    `);
    return result.rows[0].team_policy_id;
  }

  async function softEndStatement(statementId: string): Promise<void> {
    await connection.sql(SQL`
      UPDATE policy_statement SET record_end_date = now()
      WHERE policy_statement_id = ${statementId};
    `);
  }

  async function countTeamScopes(teamId: string): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT count(*)::integer AS count FROM team_security_scope WHERE team_id = ${teamId};
    `);
    return result.rows[0].count;
  }

  async function countPolicyStatementScopes(policyId: string): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT count(*)::integer AS count
      FROM policy_statement ps
      WHERE ps.policy_id = ${policyId}
        AND ps.security_scope_id IS NOT NULL
        AND ps.effect = 'allow'
        AND ps.record_end_date IS NULL;
    `);
    return result.rows[0].count;
  }

  // Run the full lazy-materialization sequence for one (team, policy) pair:
  // materialize the policy-wide statement scopes, then grant team access if
  // there were any ALLOW statements to materialize.
  async function materializeAndGrant(teamId: string, policyId: string): Promise<void> {
    const materialized = await scopeService.materializePolicyStatementScopes(policyId);
    if (materialized) {
      await scopeService.grantTeamAccessForPolicy(teamId, policyId);
    }
  }

  // URNs use real feature_type names — `tr_policy_statement_urn_validation` rejects
  // unknown types. Tests use type-wildcard URNs (urn:*:<type>:*) so no real submission
  // is needed; transaction rollback handles isolation between tests.
  const URN_A = 'urn:*:dataset:*';
  const URN_B = 'urn:*:marking:*';

  // ── Tests ───────────────────────────────────────────────────────────

  it('materializes team_security_scope when status transitions requested → reviewed → approved', async () => {
    const policyId = await insertPolicy('flip-up', 'requested');
    await insertStatement(policyId, URN_A, 'allow');
    const teamId = await createTeam(connection, 'flip-up-team');
    await insertTeamPolicy(teamId, policyId);

    expect(await countTeamScopes(teamId)).to.equal(0);

    await policyService.updatePolicy(policyId, { status: 'reviewed' });
    expect(await countTeamScopes(teamId)).to.equal(0);

    await policyService.updatePolicy(policyId, { status: 'approved' });
    expect(await countTeamScopes(teamId)).to.equal(1);
    expect(await countPolicyStatementScopes(policyId)).to.equal(1);
  });

  it("removes only the downgraded policy's team_security_scope rows on approved → reviewed, preserving shared-scope grants from other live policies", async () => {
    const policyA = await insertPolicy('shared-A', 'approved');
    await insertStatement(policyA, URN_A, 'allow');
    const policyB = await insertPolicy('shared-B', 'approved');
    await insertStatement(policyB, URN_A, 'allow');
    const policyC = await insertPolicy('exclusive-C', 'approved');
    await insertStatement(policyC, URN_B, 'allow');

    const teamId = await createTeam(connection, 'shared-team');
    await insertTeamPolicy(teamId, policyA);
    await insertTeamPolicy(teamId, policyB);
    await insertTeamPolicy(teamId, policyC);

    // Materialize the starting state (all three policies grant their scopes).
    await materializeAndGrant(teamId, policyA);
    await materializeAndGrant(teamId, policyB);
    await materializeAndGrant(teamId, policyC);
    // URN_A dedupes to one security_scope row → team has 2 distinct scopes.
    expect(await countTeamScopes(teamId)).to.equal(2);

    // Downgrade A — B still justifies the shared scope; C still justifies its exclusive scope.
    await policyService.updatePolicy(policyA, { status: 'reviewed' });
    expect(await countTeamScopes(teamId)).to.equal(2);

    // Downgrade B — the shared scope is no longer justified anywhere on this team;
    // C's exclusive scope remains.
    await policyService.updatePolicy(policyB, { status: 'reviewed' });
    expect(await countTeamScopes(teamId)).to.equal(1);
  });

  it('produces zero team_security_scope rows for an approved policy with DENY-only statements', async () => {
    const policyId = await insertPolicy('deny-only', 'approved');
    await insertStatement(policyId, URN_A, 'deny');
    const teamId = await createTeam(connection, 'deny-only-team');
    await insertTeamPolicy(teamId, policyId);

    await materializeAndGrant(teamId, policyId);

    expect(await countTeamScopes(teamId)).to.equal(0);
    expect(await countPolicyStatementScopes(policyId)).to.equal(0);
  });

  it('excludes statements with record_end_date IS NOT NULL from materialization', async () => {
    const policyId = await insertPolicy('mixed-ended', 'approved');
    const liveStmt = await insertStatement(policyId, URN_A, 'allow');
    const endedStmt = await insertStatement(policyId, URN_B, 'allow');
    await softEndStatement(endedStmt);
    const teamId = await createTeam(connection, 'mixed-ended-team');
    await insertTeamPolicy(teamId, policyId);

    await materializeAndGrant(teamId, policyId);

    expect(await countPolicyStatementScopes(policyId)).to.equal(1);
    expect(await countTeamScopes(teamId)).to.equal(1);

    const linked = await connection.sql(SQL`
      SELECT policy_statement_id FROM policy_statement
      WHERE policy_statement_id IN (${liveStmt}, ${endedStmt})
        AND security_scope_id IS NOT NULL
        AND record_end_date IS NULL;
    `);
    expect(linked.rows.map((r: { policy_statement_id: string }) => r.policy_statement_id)).to.deep.equal([liveStmt]);
  });
});
