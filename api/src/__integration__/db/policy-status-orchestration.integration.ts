// Integration tests for the team-link invariant on the security-scope cache.
//
// Every `team_security_scope` and `policy_statement_scope` row must walk back
// to a live `team_policy` ⨝ `policy(status='approved')` ⨝ `policy_statement(effect='ALLOW')`.
// Statement creation alone never produces cache rows — the cache materializes
// lazily on `team_policy` create or on the status flip into `approved`, and is
// rebuilt on `team_policy` delete or on the flip away from `approved`.
//
// These tests exercise the real service stack so the production orchestration
// (PolicyService, TeamPolicyService, DataRequestService, DownloadPolicyService,
// SecurityScopeService) runs against a real database. The pg-boss publisher is
// stubbed because pg-boss is not running under `make test-db`; the stub also
// makes invocation count assertable so we can pin which paths publish anchor
// jobs and which intentionally do not.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { PolicyEffect } from '../../models/policy-statement';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import { PolicyService } from '../../services/access-policy/policy-service';
import { SecurityScopeService } from '../../services/access-policy/security-scope-service';
import { TeamPolicyService } from '../../services/access-policy/team-policy-service';
import { DataRequestService } from '../../services/data-request-service';
import { DownloadPolicyService } from '../../services/download/download-policy-service';
import { addTeamMember, createPolicy, createPolicyStatement, createTeam } from '../helpers/test-rbac-helpers';
import { getOrCreateIntegrationTicketId } from '../helpers/test-submission-helpers';

// ── Typed row schemas for raw SELECTs ────────────────────────────────────

const SecurityScopeIdRow = z.object({ security_scope_id: z.string().uuid() });

const CountRow = z.object({ count: z.number() });

// Used by the global invariant query (I11). Every cache row this returns is an
// orphan — a row whose policy chain is missing or whose policy/statement gates
// no longer satisfy the access invariant.
const OrphanRow = z.object({
  team_id: z.string().uuid().nullable(),
  security_scope_id: z.string().uuid(),
  policy_statement_id: z.string().uuid().nullable()
});

describe('Policy status orchestration (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let publisherStub: sinon.SinonStub;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    // `connection.open()` begins the implicit transaction; afterEach's
    // `connection.rollback()` discards every write made during the test.
    connection = getAPIUserDBConnection();
    await connection.open();

    // pg-boss is not running under `make test-db`. The stub lets the production
    // orchestration proceed and exposes invocation counts so we can pin which
    // code paths publish anchor jobs and which paths must stay silent.
    publisherStub = sinon
      .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
      .resolves({ status: 'published', jobId: 'stub-job-id' });
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
    sinon.restore();
  });

  // ── Cache-state inspection helpers ───────────────────────────────────

  /** Count `team_security_scope` rows for one (team, policy)'s scopes. */
  async function countTeamScopesForPolicy(teamId: string, policyId: string): Promise<number> {
    const result = await connection.sql(
      SQL`
        SELECT count(*)::integer AS count
        FROM team_security_scope tss
        JOIN policy_statement_scope pss USING (security_scope_id)
        JOIN policy_statement ps USING (policy_statement_id)
        WHERE tss.team_id = ${teamId}
          AND ps.policy_id = ${policyId};
      `,
      CountRow
    );
    return result.rows[0].count;
  }

  /** Count `policy_statement_scope` rows that belong to a policy's statements. */
  async function countPolicyStatementScopes(policyId: string): Promise<number> {
    const result = await connection.sql(
      SQL`
        SELECT count(*)::integer AS count
        FROM policy_statement_scope pss
        JOIN policy_statement ps USING (policy_statement_id)
        WHERE ps.policy_id = ${policyId};
      `,
      CountRow
    );
    return result.rows[0].count;
  }

  /** All `security_scope_id`s currently mapped to a policy's statements. */
  async function getScopeIdsForPolicy(policyId: string): Promise<string[]> {
    const result = await connection.sql(
      SQL`
        SELECT DISTINCT pss.security_scope_id
        FROM policy_statement_scope pss
        JOIN policy_statement ps USING (policy_statement_id)
        WHERE ps.policy_id = ${policyId}
        ORDER BY pss.security_scope_id;
      `,
      SecurityScopeIdRow
    );
    return result.rows.map((r) => r.security_scope_id);
  }

  /** All `security_scope_id`s a team can reach via its team_security_scope rows. */
  async function getTeamSecurityScopeIds(teamId: string): Promise<string[]> {
    const result = await connection.sql(
      SQL`
        SELECT security_scope_id FROM team_security_scope
        WHERE team_id = ${teamId}
        ORDER BY security_scope_id;
      `,
      SecurityScopeIdRow
    );
    return result.rows.map((r) => r.security_scope_id);
  }

  /** True if a security_scope row exists for this URN's hash. */
  async function hasSecurityScopeRowForStatement(policyStatementId: string): Promise<boolean> {
    const result = await connection.sql(
      SQL`
        SELECT count(*)::integer AS count FROM policy_statement_scope
        WHERE policy_statement_id = ${policyStatementId};
      `,
      CountRow
    );
    return result.rows[0].count > 0;
  }

  /** Pull a ticket ID for the data-request flow (creates one if missing). */
  async function ensureTicketId(): Promise<string> {
    // The data-request flow only needs a valid ticket FK target. Submission /
    // upload identifiers are placeholders — the helper hashes them into the
    // ticket description and reuses an existing match if one exists.
    return getOrCreateIntegrationTicketId(
      connection,
      0,
      '00000000-0000-0000-0000-000000000000',
      connection.systemUserId()
    );
  }

  // ── I1: TeamPolicyService.createTeamPolicy lazily materializes ───────

  it('I1: createTeamPolicy on approved policy + ALLOW statement materializes one scope, one mapping, one team grant; publisher called once', async () => {
    const policyId = await createPolicy(connection, 'I1-approved-allow');
    await createPolicyStatement(connection, policyId, 'urn:*:dataset:*');

    const teamId = await createTeam(connection, 'I1 Team');
    await addTeamMember(connection, teamId, connection.systemUserId());

    const teamPolicyService = new TeamPolicyService(connection);
    await teamPolicyService.createTeamPolicy({ team_id: teamId, policy_id: policyId });

    // One security_scope, one policy_statement_scope mapping, one team grant.
    expect(await countPolicyStatementScopes(policyId)).to.equal(1);
    expect(await countTeamScopesForPolicy(teamId, policyId)).to.equal(1);

    const scopeIds = await getScopeIdsForPolicy(policyId);
    expect(scopeIds).to.have.length(1);

    // The anchor-computation job for the materialized scope is published exactly once.
    expect(publisherStub.callCount).to.equal(1);
    expect(publisherStub.firstCall.args[1]).to.deep.equal({ securityScopeId: scopeIds[0] });

    // Sanity: cache row points at the same scope_id that the statement was mapped to.
    const teamScopeIds = await getTeamSecurityScopeIds(teamId);
    expect(teamScopeIds).to.deep.equal(scopeIds);
  });

  // ── I2: PolicyService.updatePolicy(→ approved) populates the cache ───

  it('I2: flipping a policy from reviewed → approved with linked team_policies materializes the cache for each linked team', async () => {
    const policyId = await createPolicy(connection, 'I2-reviewed', 'reviewed');
    await createPolicyStatement(connection, policyId, 'urn:*:dataset:*');

    const teamId = await createTeam(connection, 'I2 Team');
    await addTeamMember(connection, teamId, connection.systemUserId());

    // Link the team before approval — the cache must stay empty until the flip.
    const teamPolicyService = new TeamPolicyService(connection);
    await teamPolicyService.createTeamPolicy({ team_id: teamId, policy_id: policyId });

    expect(await countPolicyStatementScopes(policyId)).to.equal(0);
    expect(await countTeamScopesForPolicy(teamId, policyId)).to.equal(0);
    expect(publisherStub.callCount).to.equal(0);

    const policyService = new PolicyService(connection);
    await policyService.updatePolicy(policyId, { status: 'approved' });

    expect(await countPolicyStatementScopes(policyId)).to.equal(1);
    expect(await countTeamScopesForPolicy(teamId, policyId)).to.equal(1);

    const scopeIds = await getScopeIdsForPolicy(policyId);
    expect(scopeIds).to.have.length(1);

    expect(publisherStub.callCount).to.equal(1);
    expect(publisherStub.firstCall.args[1]).to.deep.equal({ securityScopeId: scopeIds[0] });
  });

  // ── I3: PolicyService.updatePolicy(approved → reviewed) ungrants all teams ─

  it('I3: flipping a policy out of approved removes every linked team’s team_security_scope rows; shared scope + mapping rows stay', async () => {
    const policyId = await createPolicy(connection, 'I3-approved');
    await createPolicyStatement(connection, policyId, 'urn:*:dataset:*');

    const teamA = await createTeam(connection, 'I3 Team A');
    const teamB = await createTeam(connection, 'I3 Team B');
    await addTeamMember(connection, teamA, connection.systemUserId());
    await addTeamMember(connection, teamB, connection.systemUserId());

    const teamPolicyService = new TeamPolicyService(connection);
    await teamPolicyService.createTeamPolicy({ team_id: teamA, policy_id: policyId });
    await teamPolicyService.createTeamPolicy({ team_id: teamB, policy_id: policyId });

    // Both teams should be in the cache before the flip.
    expect(await countTeamScopesForPolicy(teamA, policyId)).to.equal(1);
    expect(await countTeamScopesForPolicy(teamB, policyId)).to.equal(1);

    const publishCountBeforeFlip = publisherStub.callCount;

    const policyService = new PolicyService(connection);
    await policyService.updatePolicy(policyId, { status: 'reviewed' });

    // Both teams are ungranted for this policy's scopes.
    expect(await countTeamScopesForPolicy(teamA, policyId)).to.equal(0);
    expect(await countTeamScopesForPolicy(teamB, policyId)).to.equal(0);

    // Shared scope row and policy_statement_scope mapping survive the downgrade —
    // the rebuild only touches per-team grants, not the global cache rows.
    expect(await countPolicyStatementScopes(policyId)).to.equal(1);

    // The reverse path rebuilds teams from the policy chain; it does not publish
    // new anchor jobs because no new scopes are being materialized.
    expect(publisherStub.callCount).to.equal(publishCountBeforeFlip);
  });

  // ── I3b: downgrade preserves access still justified by another live policy ─

  it('I3b: downgrading one of two approved policies justifying the same scope leaves the team’s access intact via the other policy', async () => {
    // A team can reach the same scope through two different approved policies
    // (different statements, identical URN → identical scope_hash → shared
    // `security_scope` row, two `policy_statement_scope` rows pointing at it).
    // Downgrading one of the policies must NOT drop the team's `team_security_scope`
    // row, because the other policy still justifies it. This is the multi-policy
    // form of Edge Case #3 — the rebuild must walk the full live policy chain,
    // not just remove rows attributed to the downgraded policy.
    const sharedUrn = 'urn:*:dataset:*';

    const policyA = await createPolicy(connection, 'I3b-policy-A');
    const statementA = await createPolicyStatement(connection, policyA, sharedUrn);

    const policyB = await createPolicy(connection, 'I3b-policy-B');
    const statementB = await createPolicyStatement(connection, policyB, sharedUrn);

    const teamId = await createTeam(connection, 'I3b Team');
    await addTeamMember(connection, teamId, connection.systemUserId());

    const teamPolicyService = new TeamPolicyService(connection);
    await teamPolicyService.createTeamPolicy({ team_id: teamId, policy_id: policyA });
    await teamPolicyService.createTeamPolicy({ team_id: teamId, policy_id: policyB });

    // Pre-flip state: one shared scope, two mappings (one per statement), one team grant.
    const scopeIdsForA = await getScopeIdsForPolicy(policyA);
    const scopeIdsForB = await getScopeIdsForPolicy(policyB);
    expect(scopeIdsForA).to.have.lengthOf(1);
    expect(scopeIdsForB).to.deep.equal(scopeIdsForA);
    expect(await getTeamSecurityScopeIds(teamId)).to.deep.equal(scopeIdsForA);

    const publishCountBeforeFlip = publisherStub.callCount;

    const policyService = new PolicyService(connection);
    await policyService.updatePolicy(policyA, { status: 'reviewed' });

    // Team access to the shared scope must survive the downgrade — Policy B still
    // justifies it. The team_security_scope row that previously walked back to
    // Policy A's statement now walks back to Policy B's.
    expect(await getTeamSecurityScopeIds(teamId)).to.deep.equal(scopeIdsForA);

    // Both `policy_statement_scope` mapping rows persist — rebuild operates per
    // team and never deletes scope mappings.
    expect(await hasSecurityScopeRowForStatement(statementA)).to.equal(true);
    expect(await hasSecurityScopeRowForStatement(statementB)).to.equal(true);

    // Rebuild path publishes no new anchor jobs.
    expect(publisherStub.callCount).to.equal(publishCountBeforeFlip);
  });

  // ── I4: DataRequestService.createDataRequestForTicket stays scope-free ───

  it('I4: creating a data-request (status=requested, DENY policy) creates no scope, mapping, or team grant rows; publisher silent', async () => {
    const ticketId = await ensureTicketId();
    const dataRequestService = new DataRequestService(connection);

    const created = await dataRequestService.createDataRequestForTicket(ticketId, {
      requested_by: connection.systemUserId(),
      reason: 'I4 anti-regression',
      system_user_ids: [connection.systemUserId()]
    });

    // Pull the auto-created policy via its data_request row.
    const policyId = created.policy_id;

    // Nothing about a requested DENY policy should hit the cache.
    expect(await countPolicyStatementScopes(policyId)).to.equal(0);

    const teamGrants = await connection.sql(
      SQL`
        SELECT count(*)::integer AS count
        FROM team_security_scope tss
        JOIN team_policy tp USING (team_id)
        WHERE tp.policy_id = ${policyId};
      `,
      CountRow
    );
    expect(teamGrants.rows[0].count).to.equal(0);

    // A security_scope row keyed by this policy's statement URN must not exist.
    const stmtScope = await connection.sql(
      SQL`
        SELECT count(*)::integer AS count
        FROM security_scope ss
        JOIN policy_statement_scope pss USING (security_scope_id)
        JOIN policy_statement ps USING (policy_statement_id)
        WHERE ps.policy_id = ${policyId};
      `,
      CountRow
    );
    expect(stmtScope.rows[0].count).to.equal(0);

    expect(publisherStub.callCount).to.equal(0);
  });

  // ── I5: data-request approval lifecycle end-to-end ───────────────────

  it('I5: after a data-request is created, swapping in an ALLOW statement and flipping requested → reviewed → approved materializes the cache only on approval', async () => {
    const ticketId = await ensureTicketId();
    const dataRequestService = new DataRequestService(connection);
    const policyService = new PolicyService(connection);

    const created = await dataRequestService.createDataRequestForTicket(ticketId, {
      requested_by: connection.systemUserId(),
      reason: 'I5 approval lifecycle',
      system_user_ids: [connection.systemUserId()]
    });
    const policyId = created.policy_id;

    // Pre-state: data-request flow leaves the cache empty (re-asserts I4 invariant).
    expect(await countPolicyStatementScopes(policyId)).to.equal(0);
    expect(publisherStub.callCount).to.equal(0);

    // Reviewer swaps the deny-all statement for an ALLOW grant. The Knex
    // `update` call rejects empty payloads, so we pass `description` as a
    // no-op metadata change to satisfy the layer below.
    await policyService.updatePolicyWithStatements(policyId, { description: 'I5 review notes' }, [
      { effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:*:dataset:*' }
    ]);

    // Still requested → still no cache rows, still no publishes.
    expect(await countPolicyStatementScopes(policyId)).to.equal(0);
    expect(publisherStub.callCount).to.equal(0);

    // First lifecycle step: requested → reviewed.
    await policyService.updatePolicy(policyId, { status: 'reviewed' });
    expect(await countPolicyStatementScopes(policyId)).to.equal(0);
    expect(publisherStub.callCount).to.equal(0);

    // Second lifecycle step: reviewed → approved. Now the team_policy linked
    // by createDataRequestForTicket triggers fan-out materialization.
    await policyService.updatePolicy(policyId, { status: 'approved' });

    expect(await countPolicyStatementScopes(policyId)).to.equal(1);

    const teamGrantsAfterApproval = await connection.sql(
      SQL`
        SELECT count(*)::integer AS count
        FROM team_security_scope tss
        JOIN team_policy tp USING (team_id)
        WHERE tp.policy_id = ${policyId};
      `,
      CountRow
    );
    expect(teamGrantsAfterApproval.rows[0].count).to.equal(1);

    // One publish per materialized scope; the policy has exactly one ALLOW statement.
    expect(publisherStub.callCount).to.equal(1);
  });

  // ── I6: DownloadPolicyService stays compliant ────────────────────────

  it('I6: createDownloadPolicy creates the policy + statements but no scope, mapping, or team grant rows; publisher silent', async () => {
    const downloadPolicyService = new DownloadPolicyService(connection);

    const { policy_id } = await downloadPolicyService.createDownloadPolicy({
      name: 'I6 Download Policy',
      description: 'audit: download policies stay scope-free',
      featureTypes: ['dataset'],
      expressionId: null
    });

    expect(await countPolicyStatementScopes(policy_id)).to.equal(0);

    const teamGrants = await connection.sql(
      SQL`
        SELECT count(*)::integer AS count
        FROM team_security_scope tss
        JOIN team_policy tp USING (team_id)
        WHERE tp.policy_id = ${policy_id};
      `,
      CountRow
    );
    expect(teamGrants.rows[0].count).to.equal(0);

    expect(publisherStub.callCount).to.equal(0);
  });

  // ── I7: deleteTeamPolicy preserves shared scope rows ────────────────

  it('I7: deleting one team’s team_policy ungrants that team without disturbing other teams’ access or the shared scope rows', async () => {
    const policyId = await createPolicy(connection, 'I7-shared-approved');
    await createPolicyStatement(connection, policyId, 'urn:*:dataset:*');

    const teamA = await createTeam(connection, 'I7 Team A');
    const teamB = await createTeam(connection, 'I7 Team B');
    await addTeamMember(connection, teamA, connection.systemUserId());
    await addTeamMember(connection, teamB, connection.systemUserId());

    const teamPolicyService = new TeamPolicyService(connection);
    const teamPolicyA = await teamPolicyService.createTeamPolicy({ team_id: teamA, policy_id: policyId });
    await teamPolicyService.createTeamPolicy({ team_id: teamB, policy_id: policyId });

    const scopeIdsBefore = await getScopeIdsForPolicy(policyId);
    expect(scopeIdsBefore).to.have.length(1);
    expect(await countTeamScopesForPolicy(teamA, policyId)).to.equal(1);
    expect(await countTeamScopesForPolicy(teamB, policyId)).to.equal(1);

    await teamPolicyService.deleteTeamPolicy(teamPolicyA.team_policy_id);

    // A loses its grant; B is untouched.
    expect(await countTeamScopesForPolicy(teamA, policyId)).to.equal(0);
    expect(await countTeamScopesForPolicy(teamB, policyId)).to.equal(1);

    // Shared scope + mapping rows survive — B still references them.
    expect(await countPolicyStatementScopes(policyId)).to.equal(1);
    const scopeIdsAfter = await getScopeIdsForPolicy(policyId);
    expect(scopeIdsAfter).to.deep.equal(scopeIdsBefore);
  });

  // ── I8: updatePolicyWithStatements rederives scope for active consumers ───

  it('I8: replacing a policy’s statement on an approved policy with active team_policy links cleans up the old scope mapping, materializes the new scope, and switches the team grant', async () => {
    const policyId = await createPolicy(connection, 'I8-active-consumers');
    const oldStmtId = await createPolicyStatement(connection, policyId, 'urn:*:dataset:*');

    const teamId = await createTeam(connection, 'I8 Team');
    await addTeamMember(connection, teamId, connection.systemUserId());

    const teamPolicyService = new TeamPolicyService(connection);
    await teamPolicyService.createTeamPolicy({ team_id: teamId, policy_id: policyId });

    const oldScopeIds = await getScopeIdsForPolicy(policyId);
    expect(oldScopeIds).to.have.length(1);
    expect(await countTeamScopesForPolicy(teamId, policyId)).to.equal(1);

    const callsAfterSetup = publisherStub.callCount;

    const policyService = new PolicyService(connection);
    await policyService.updatePolicyWithStatements(policyId, { description: 'I8 swapped statements' }, [
      { effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:*:sample_site:*' }
    ]);

    // Old statement's mapping is gone; the urn1 security_scope row may stay
    // around (other policies could share it) but it has no active reference
    // from this policy any more.
    expect(await hasSecurityScopeRowForStatement(oldStmtId)).to.equal(false);

    // New statement now drives the policy's only active mapping.
    const newScopeIds = await getScopeIdsForPolicy(policyId);
    expect(newScopeIds).to.have.length(1);
    expect(newScopeIds[0]).to.not.equal(oldScopeIds[0]);

    // The team's grant switches to the new scope.
    expect(await countTeamScopesForPolicy(teamId, policyId)).to.equal(1);
    const teamScopeIds = await getTeamSecurityScopeIds(teamId);
    expect(teamScopeIds).to.include(newScopeIds[0]);
    expect(teamScopeIds).to.not.include(oldScopeIds[0]);

    // Publisher fires at least once for the new scope. Orphan-cleanup may also
    // republish the old scope_id; pin only the must-have so the test is stable
    // against future internal-publish ordering tweaks.
    const newPublishes = publisherStub.getCalls().slice(callsAfterSetup);
    const publishedScopeIds = newPublishes.map((call) => call.args[1].securityScopeId);
    expect(publishedScopeIds).to.include(newScopeIds[0]);
  });

  // ── I9: update-without-consumers stays lazy ─────────────────────────

  it('I9: updatePolicyWithStatements on a policy with no team_policy links produces zero scope rows before and after; publisher silent', async () => {
    const policyId = await createPolicy(connection, 'I9-no-consumers');
    await createPolicyStatement(connection, policyId, 'urn:*:dataset:*');

    // Pre-state: no team_policy linkage → no cache rows yet.
    expect(await countPolicyStatementScopes(policyId)).to.equal(0);

    const policyService = new PolicyService(connection);
    await policyService.updatePolicyWithStatements(policyId, { description: 'I9 swapped statements' }, [
      { effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:*:sample_site:*' }
    ]);

    expect(await countPolicyStatementScopes(policyId)).to.equal(0);
    expect(publisherStub.callCount).to.equal(0);
  });

  // ── I10: DENY-only approved policy still grants no scope rows ──────

  it('I10: createTeamPolicy on an approved policy with only DENY statements produces no scope, mapping, or team grant rows; publisher silent', async () => {
    const policyId = await createPolicy(connection, 'I10-deny-only');
    await createPolicyStatement(connection, policyId, 'urn:*:dataset:*', PolicyEffect.DENY);

    const teamId = await createTeam(connection, 'I10 Team');
    await addTeamMember(connection, teamId, connection.systemUserId());

    const teamPolicyService = new TeamPolicyService(connection);
    await teamPolicyService.createTeamPolicy({ team_id: teamId, policy_id: policyId });

    expect(await countPolicyStatementScopes(policyId)).to.equal(0);
    expect(await countTeamScopesForPolicy(teamId, policyId)).to.equal(0);
    expect(publisherStub.callCount).to.equal(0);
  });

  // ── I10b: requested-status policy still grants no scope rows ───────

  it('I10b: createTeamPolicy on a requested-status policy (even with ALLOW statements) produces no team grant rows; publisher silent', async () => {
    // Closes the API-contract gap: a not-yet-approved policy must not leak
    // access through the team_policy create path even if its statements
    // would otherwise qualify.
    const policyId = await createPolicy(connection, 'I10b-requested-allow', 'requested');
    await createPolicyStatement(connection, policyId, 'urn:*:dataset:*');

    const teamId = await createTeam(connection, 'I10b Team');
    await addTeamMember(connection, teamId, connection.systemUserId());

    const teamPolicyService = new TeamPolicyService(connection);
    await teamPolicyService.createTeamPolicy({ team_id: teamId, policy_id: policyId });

    expect(await countPolicyStatementScopes(policyId)).to.equal(0);
    expect(await countTeamScopesForPolicy(teamId, policyId)).to.equal(0);
    expect(publisherStub.callCount).to.equal(0);
  });

  // ── I11: global invariant — no orphan cache rows after multi-scenario run ─

  it('I11: after running I1 + I2 + I7 + I8 sequentially, every team_security_scope and policy_statement_scope row walks back to an approved policy with an ALLOW statement', async () => {
    // -- I1: createTeamPolicy on an approved+ALLOW policy ---------------
    const i1PolicyId = await createPolicy(connection, 'I11-I1');
    await createPolicyStatement(connection, i1PolicyId, 'urn:*:dataset:*');
    const i1TeamId = await createTeam(connection, 'I11 Team I1');
    await addTeamMember(connection, i1TeamId, connection.systemUserId());
    const teamPolicyService = new TeamPolicyService(connection);
    await teamPolicyService.createTeamPolicy({ team_id: i1TeamId, policy_id: i1PolicyId });

    // -- I2: reviewed → approved flip with linked team_policy -----------
    const i2PolicyId = await createPolicy(connection, 'I11-I2', 'reviewed');
    await createPolicyStatement(connection, i2PolicyId, 'urn:*:sample_site:*');
    const i2TeamId = await createTeam(connection, 'I11 Team I2');
    await addTeamMember(connection, i2TeamId, connection.systemUserId());
    await teamPolicyService.createTeamPolicy({ team_id: i2TeamId, policy_id: i2PolicyId });
    const policyService = new PolicyService(connection);
    await policyService.updatePolicy(i2PolicyId, { status: 'approved' });

    // -- I7: deleteTeamPolicy ungrants A, keeps B + shared scope rows --
    const i7PolicyId = await createPolicy(connection, 'I11-I7');
    await createPolicyStatement(connection, i7PolicyId, 'urn:*:animal:*');
    const i7TeamA = await createTeam(connection, 'I11 Team I7 A');
    const i7TeamB = await createTeam(connection, 'I11 Team I7 B');
    await addTeamMember(connection, i7TeamA, connection.systemUserId());
    await addTeamMember(connection, i7TeamB, connection.systemUserId());
    const teamPolicyA = await teamPolicyService.createTeamPolicy({ team_id: i7TeamA, policy_id: i7PolicyId });
    await teamPolicyService.createTeamPolicy({ team_id: i7TeamB, policy_id: i7PolicyId });
    await teamPolicyService.deleteTeamPolicy(teamPolicyA.team_policy_id);

    // -- I8: replace ALLOW statement on a live approved policy ---------
    const i8PolicyId = await createPolicy(connection, 'I11-I8');
    await createPolicyStatement(connection, i8PolicyId, 'urn:*:capture:*');
    const i8TeamId = await createTeam(connection, 'I11 Team I8');
    await addTeamMember(connection, i8TeamId, connection.systemUserId());
    await teamPolicyService.createTeamPolicy({ team_id: i8TeamId, policy_id: i8PolicyId });
    await policyService.updatePolicyWithStatements(i8PolicyId, { description: 'I11 I8 step' }, [
      { effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:*:mortality:*' }
    ]);

    // Walk every team_security_scope row this test produced back through the
    // policy chain. Any row that cannot reach `team_policy ⨝
    // policy(status='approved') ⨝ policy_statement(effect='ALLOW')` (all live,
    // all record_end_date IS NULL) is an orphan — the team-link invariant has
    // been violated. The query scopes to the four (team, policy) pairs created
    // here so pre-existing seed-level orphans cannot mask a real regression.
    const testTeamIds = [i1TeamId, i2TeamId, i7TeamA, i7TeamB, i8TeamId];
    const testPolicyIds = [i1PolicyId, i2PolicyId, i7PolicyId, i8PolicyId];

    const teamOrphans = await connection.sql(
      SQL`
        SELECT tss.team_id, tss.security_scope_id, NULL::uuid AS policy_statement_id
        FROM team_security_scope tss
        WHERE tss.team_id = ANY(${testTeamIds}::uuid[])
          AND NOT EXISTS (
            SELECT 1
            FROM policy_statement_scope pss
            JOIN policy_statement ps
              ON ps.policy_statement_id = pss.policy_statement_id
              AND ps.effect = 'allow'
              AND ps.record_end_date IS NULL
            JOIN policy p
              ON p.policy_id = ps.policy_id
              AND p.status = 'approved'
              AND p.record_end_date IS NULL
            JOIN team_policy tp
              ON tp.policy_id = p.policy_id
              AND tp.team_id = tss.team_id
              AND tp.record_end_date IS NULL
            WHERE pss.security_scope_id = tss.security_scope_id
          );
      `,
      OrphanRow
    );
    expect(
      teamOrphans.rowCount,
      `unexpected team_security_scope orphans: ${JSON.stringify(teamOrphans.rows)}`
    ).to.equal(0);

    // Same walk for policy_statement_scope — only rows whose statement is ALLOW
    // and whose policy is approved (both live) are allowed to exist. Scoped to
    // the policies created in this test.
    const statementOrphans = await connection.sql(
      SQL`
        SELECT NULL::uuid AS team_id, pss.security_scope_id, pss.policy_statement_id
        FROM policy_statement_scope pss
        JOIN policy_statement filter_ps ON filter_ps.policy_statement_id = pss.policy_statement_id
        WHERE filter_ps.policy_id = ANY(${testPolicyIds}::uuid[])
          AND NOT EXISTS (
            SELECT 1
            FROM policy_statement ps
            JOIN policy p
              ON p.policy_id = ps.policy_id
              AND p.status = 'approved'
              AND p.record_end_date IS NULL
            WHERE ps.policy_statement_id = pss.policy_statement_id
              AND ps.effect = 'allow'
              AND ps.record_end_date IS NULL
          );
      `,
      OrphanRow
    );
    expect(
      statementOrphans.rowCount,
      `unexpected policy_statement_scope orphans: ${JSON.stringify(statementOrphans.rows)}`
    ).to.equal(0);

    // Spot-check the scenarios actually produced live cache rows where
    // expected — guards against a future change that silently leaves the
    // cache empty (which would also produce zero orphans).
    expect(await countTeamScopesForPolicy(i1TeamId, i1PolicyId)).to.equal(1);
    expect(await countTeamScopesForPolicy(i2TeamId, i2PolicyId)).to.equal(1);
    expect(await countTeamScopesForPolicy(i7TeamA, i7PolicyId)).to.equal(0);
    expect(await countTeamScopesForPolicy(i7TeamB, i7PolicyId)).to.equal(1);
    expect(await countTeamScopesForPolicy(i8TeamId, i8PolicyId)).to.equal(1);
  });

  // ── I12: publisher fires only for access-impacting changes ──────────

  it('I12: (a) a second team_policy on an approved policy publishes once; (b) metadata-only updatePolicy does not publish', async () => {
    const policyId = await createPolicy(connection, 'I12-approved');
    await createPolicyStatement(connection, policyId, 'urn:*:dataset:*');

    const teamA = await createTeam(connection, 'I12 Team A');
    const teamB = await createTeam(connection, 'I12 Team B');
    await addTeamMember(connection, teamA, connection.systemUserId());
    await addTeamMember(connection, teamB, connection.systemUserId());

    const teamPolicyService = new TeamPolicyService(connection);
    await teamPolicyService.createTeamPolicy({ team_id: teamA, policy_id: policyId });

    const setupCalls = publisherStub.callCount;
    expect(setupCalls).to.equal(1);

    const scopeIds = await getScopeIdsForPolicy(policyId);
    expect(scopeIds).to.have.length(1);

    // (a) Granting a second team materializes one anchor-publish for the
    // shared scope. Even though the scope_id already exists, the materialize
    // path re-publishes so anchor recompute covers any cleaned-up rows.
    await teamPolicyService.createTeamPolicy({ team_id: teamB, policy_id: policyId });

    expect(publisherStub.callCount - setupCalls).to.equal(1);
    expect(publisherStub.lastCall.args[1]).to.deep.equal({ securityScopeId: scopeIds[0] });

    // (b) A metadata-only updatePolicy (no status, no statement set change)
    // must not publish. The orchestration short-circuits at the
    // `status === undefined` branch.
    const callsBeforeRename = publisherStub.callCount;
    const policyService = new PolicyService(connection);
    await policyService.updatePolicy(policyId, { name: 'I12-renamed' });
    expect(publisherStub.callCount).to.equal(callsBeforeRename);
  });

  // ── I12c: status-flip to approved with zero linked teams is a clean no-op ─

  it('I12c: flipping an unlinked policy to approved succeeds and produces zero cache rows, zero publishes', async () => {
    // API Contract #3: an admin can approve a policy that is not (yet) linked
    // to any team. The status write must succeed, but the cache orchestration
    // has nothing to fan out — no `team_security_scope` rows appear and the
    // publisher stays silent.
    const policyId = await createPolicy(connection, 'I12c-no-teams', 'reviewed');
    await createPolicyStatement(connection, policyId, 'urn:*:dataset:*');

    const publishCountBeforeFlip = publisherStub.callCount;

    const policyService = new PolicyService(connection);
    const updated = await policyService.updatePolicy(policyId, { status: 'approved' });

    expect(updated.status).to.equal('approved');
    expect(await getScopeIdsForPolicy(policyId)).to.have.lengthOf(0);
    expect(publisherStub.callCount).to.equal(publishCountBeforeFlip);
  });

  // ── I13: SQL-layer defense against a stale caller after soft-delete ──

  it('I13: calling insertTeamSecurityScopesForPolicy after the team_policy link is soft-deleted inserts zero rows (SQL filter is the safety net)', async () => {
    // Defense-in-depth check. The orchestrator decides when to call
    // `insertTeamSecurityScopesForPolicy`; a misbehaving or stale caller
    // holding a `(teamId, policyId)` pair past a `team_policy` soft-delete
    // must not be able to re-create cache rows. The `JOIN team_policy tp
    // … WHERE tp.record_end_date IS NULL` clause is the only thing
    // catching that case at the SQL layer.
    const policyId = await createPolicy(connection, 'I13-stale-caller');
    await createPolicyStatement(connection, policyId, 'urn:*:dataset:*');

    const teamId = await createTeam(connection, 'I13 Team');
    await addTeamMember(connection, teamId, connection.systemUserId());

    const teamPolicyService = new TeamPolicyService(connection);
    const teamPolicy = await teamPolicyService.createTeamPolicy({ team_id: teamId, policy_id: policyId });

    // Sanity: link is live, cache row exists.
    expect(await countTeamScopesForPolicy(teamId, policyId)).to.equal(1);

    // Soft-delete the link. `deleteTeamPolicy` also runs the rebuild path,
    // so the cache row is gone after this call.
    await teamPolicyService.deleteTeamPolicy(teamPolicy.team_policy_id);
    expect(await countTeamScopesForPolicy(teamId, policyId)).to.equal(0);

    // Simulate a stale orchestrator: same `(teamId, policyId)` pair, but the
    // link beneath it has been soft-deleted. The repository call must be a
    // no-op — the SQL filter drops the row before the INSERT sees it.
    const securityScopeRepository = new SecurityScopeRepository(connection);
    await securityScopeRepository.insertTeamSecurityScopesForPolicy(teamId, policyId);

    expect(await countTeamScopesForPolicy(teamId, policyId)).to.equal(0);
  });
});
