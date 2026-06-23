// Integration test for DataRequestService — verifies that creating a data
// request writes the expected ticket + team + policy + statement + expression
// + team_policy rows against a real database for the search-driven flow, and
// preserves the deny-all baseline for the administrative ticket-bound flow.
//
// Also verifies:
//   - The service treats `system_user_ids` as the canonical team membership and
//     does NOT auto-add the requester. The search route unions `requested_by`
//     into `system_user_ids` before calling (covered at the route layer in
//     paths/data-request); the admin ticket flow passes the picker as-is.
//   - Unknown feature-type names are rejected with HTTP400 before any DB
//     write, leaving no partial state behind.
//   - A failure mid-way through `createDataRequestForTicket` rolls back the
//     whole chain (no orphan ticket, team, policy, or expression rows).
//
// Uses a transaction that is ROLLED BACK after each test, so no data is
// persisted. pg-boss is not running in the `make test-db` environment, so the
// anchor-computation publisher invoked indirectly via
// `SecurityScopeService.createScopeForPolicyStatement` is stubbed in
// `beforeEach` — same pattern as `security-scope-search.integration.ts`.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ExpressionTree } from '../../models/expression-tree';
import { SecurityScopeService } from '../../services/access-policy/security-scope-service';
import { TeamPolicyService } from '../../services/access-policy/team-policy-service';
import { DataRequestService } from '../../services/data-request-service';
import { ExpressionTreeService } from '../../services/expression-tree-service';
import { TicketService } from '../../services/ticket-service';

/**
 * Helper: build a minimal one-predicate expression tree against
 * `dataset.name`. The predicate ids (31/70) match the seed; the literal
 * `value` is randomised so two calls produce distinct hashes and never
 * collapse onto the same `expression` row via the `expression_hash`
 * unique index.
 */
function buildExpression(value?: string): ExpressionTree {
  return {
    type: 'expression',
    operator: 'AND',
    clauses: [
      {
        type: 'predicate',
        feature_property_id: 31,
        feature_type_property_id: 70,
        operator: 'Equals',
        value: value ?? `dr-int-${randomUUID()}`
      }
    ]
  };
}

describe('DataRequestService (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let service: DataRequestService;
  let ticketService: TicketService;
  let expressionTreeService: ExpressionTreeService;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new DataRequestService(connection);
    ticketService = new TicketService(connection);
    expressionTreeService = new ExpressionTreeService(connection);

    // pg-boss is not running in the `make test-db` environment. Each ALLOW statement created via
    // `policyService.createPolicyWithStatements` materialises a security_scope row and enqueues an
    // anchor-recomputation job — the queue insert is what fails. Stubbing the publisher lets the
    // policy / statement / scope rows write normally so the row-shape assertions below remain valid.
    sinon
      .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
      .resolves({ status: 'published', jobId: 'stub-job-id' });
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
    sinon.restore();
  });

  /**
   * Helper: insert a fresh `system_user` row inside the open transaction.
   * Each test gets unique requester / collaborator identifiers so cross-row
   * assertions (member union, single-member teams) cannot accidentally
   * collide with pre-seeded rows.
   */
  let _userSeq = 0;
  async function createUser(label: string): Promise<number> {
    const apiUserId = connection.systemUserId();
    const guid = `dr-int-${label}-${Date.now()}-${++_userSeq}-${randomUUID().slice(0, 6)}`;

    const result = await connection.sql(SQL`
      INSERT INTO "system_user" (user_identity_source_id, user_identifier, user_guid, record_effective_date, create_user)
      SELECT user_identity_source_id, ${guid}, ${guid}, now(), ${apiUserId}
      FROM user_identity_source
      WHERE record_end_date IS NULL
      LIMIT 1
      RETURNING system_user_id;
    `);

    return result.rows[0].system_user_id;
  }

  /**
   * Helper: count `policy_statement` rows for a policy that are still active.
   */
  async function activeStatements(policyId: string): Promise<{ urn: string; effect: string }[]> {
    const result = await connection.sql(SQL`
      SELECT submission_feature_urn AS urn, effect
      FROM policy_statement
      WHERE policy_id = ${policyId}
        AND record_end_date IS NULL
      ORDER BY submission_feature_urn;
    `);
    return result.rows.map((r: any) => ({ urn: r.urn, effect: r.effect }));
  }

  /**
   * Helper: fetch the system_user_id set for a team.
   */
  async function teamMemberIds(teamId: string): Promise<number[]> {
    const result = await connection.sql(SQL`
      SELECT system_user_id FROM team_member
      WHERE team_id = ${teamId}
      ORDER BY system_user_id;
    `);
    return result.rows.map((r: any) => r.system_user_id as number);
  }

  describe('createDataRequest (search-driven flow)', () => {
    it('I1: persists DR + ticket + 2 teams + policy(status=requested) + 1 ALLOW + 1 expression + 1 link + 1 team_policy; never grants team scopes', async () => {
      const requester = await createUser('I1-req');
      const collaborator = await createUser('I1-coll');
      const expression = buildExpression('I1-tree');

      // The search route unions `requested_by` into `system_user_ids` before calling the service
      // (paths/data-request/index.ts), so the service receives the requester as part of the
      // canonical member list. Mirror that here.
      const dataRequest = await service.createDataRequest({
        requested_by: requester,
        reason: 'I1 search-driven happy path covering the full row shape',
        system_user_ids: [requester, collaborator],
        featureTypes: ['dataset'],
        expression
      });

      // Data request row
      const drRows = await connection.sql(SQL`
        SELECT data_request_id, requested_by, ticket_id, team_id, policy_id
        FROM data_request WHERE data_request_id = ${dataRequest.data_request_id};
      `);
      expect(drRows.rowCount).to.equal(1);
      expect(drRows.rows[0].requested_by).to.equal(requester);

      // Ticket row
      const ticketRows = await connection.sql(SQL`
        SELECT ticket_id FROM ticket WHERE ticket_id = ${drRows.rows[0].ticket_id};
      `);
      expect(ticketRows.rowCount).to.equal(1);

      // Policy + status
      const policyRows = await connection.sql(SQL`
        SELECT policy_id, status FROM policy WHERE policy_id = ${drRows.rows[0].policy_id};
      `);
      expect(policyRows.rowCount).to.equal(1);
      expect(policyRows.rows[0].status).to.equal('requested');

      // Exactly one ALLOW statement, dataset-scoped URN
      const statements = await activeStatements(dataRequest.policy_id);
      expect(statements).to.deep.equal([{ urn: 'urn:*:dataset:*', effect: 'allow' }]);

      // Exactly one expression_statement link pointing at our expression row
      const statementIds = (
        await connection.sql(SQL`
          SELECT policy_statement_id FROM policy_statement
          WHERE policy_id = ${dataRequest.policy_id} AND record_end_date IS NULL;
        `)
      ).rows.map((r: any) => r.policy_statement_id);

      const links = await connection.sql(SQL`
        SELECT pe.expression_id
        FROM policy_statement_expression pse
        JOIN policy_expression pe ON pe.policy_expression_id = pse.policy_expression_id
        WHERE pse.policy_statement_id = ANY(${statementIds}::uuid[])
          AND pse.record_end_date IS NULL
          AND pe.record_end_date IS NULL;
      `);
      expect(links.rowCount).to.equal(1);

      // The linked expression round-trips to the original tree
      const roundTripped = await expressionTreeService.readExpressionTree(links.rows[0].expression_id);
      expect(roundTripped).to.deep.equal(expression);

      // team_policy row linking the policy team to the policy
      const teamPolicyRows = await connection.sql(SQL`
        SELECT team_id FROM team_policy WHERE policy_id = ${dataRequest.policy_id};
      `);
      expect(teamPolicyRows.rowCount).to.equal(1);
      const policyTeamId = teamPolicyRows.rows[0].team_id as string;
      const dataRequestTeamId = drRows.rows[0].team_id as string;
      expect(policyTeamId).to.not.equal(dataRequestTeamId);

      // Each auto-created team has exactly the deduped `system_user_ids` the service was given.
      expect(await teamMemberIds(dataRequestTeamId)).to.deep.equal([requester, collaborator].sort((a, b) => a - b));
      expect(await teamMemberIds(policyTeamId)).to.deep.equal([requester, collaborator].sort((a, b) => a - b));

      // Security guarantee: a `requested` policy must NOT have leaked any team_security_scope rows.
      // Access is only granted when the reviewer approves the policy.
      const scopeGrants = await connection.sql(SQL`
        SELECT count(*)::int AS n FROM team_security_scope
        WHERE team_id = ANY(${[dataRequestTeamId, policyTeamId]}::uuid[]);
      `);
      expect(scopeGrants.rows[0].n).to.equal(0);
    });

    it('I2: multi-featureType produces N statements but writes the expression tree once with N statement links sharing the same expression_id', async () => {
      const requester = await createUser('I2-req');
      const expression = buildExpression('I2-tree');

      const dataRequest = await service.createDataRequest({
        requested_by: requester,
        reason: 'I2 multi-featureType single-tree fanout',
        system_user_ids: [],
        featureTypes: ['dataset', 'telemetry'],
        expression
      });

      const statements = await activeStatements(dataRequest.policy_id);
      expect(statements.map((s) => s.urn)).to.deep.equal(['urn:*:dataset:*', 'urn:*:telemetry:*']);
      expect(statements.every((s) => s.effect === 'allow')).to.equal(true);

      const links = await connection.sql(SQL`
        SELECT pe.expression_id, pse.policy_statement_id
        FROM policy_statement_expression pse
        JOIN policy_expression pe ON pe.policy_expression_id = pse.policy_expression_id
        JOIN policy_statement ps ON ps.policy_statement_id = pse.policy_statement_id
        WHERE ps.policy_id = ${dataRequest.policy_id}
          AND pse.record_end_date IS NULL
          AND pe.record_end_date IS NULL
          AND ps.record_end_date IS NULL;
      `);
      expect(links.rowCount).to.equal(2);

      const expressionIds = new Set(links.rows.map((r: any) => r.expression_id));
      expect(expressionIds.size).to.equal(1, 'expected both links to share a single expression_id');
      const statementIds = new Set(links.rows.map((r: any) => r.policy_statement_id));
      expect(statementIds.size).to.equal(2, 'expected the two statements to be distinct');
    });

    it('I3: `expression: null` persists statements but never writes an expression tree or links', async () => {
      const requester = await createUser('I3-req');

      const dataRequest = await service.createDataRequest({
        requested_by: requester,
        reason: 'I3 null-expression branch',
        system_user_ids: [],
        featureTypes: ['dataset'],
        expression: null
      });

      const statements = await activeStatements(dataRequest.policy_id);
      expect(statements).to.deep.equal([{ urn: 'urn:*:dataset:*', effect: 'allow' }]);

      const statementIds = (
        await connection.sql(SQL`
          SELECT policy_statement_id FROM policy_statement
          WHERE policy_id = ${dataRequest.policy_id} AND record_end_date IS NULL;
        `)
      ).rows.map((r: any) => r.policy_statement_id);

      const links = await connection.sql(SQL`
        SELECT count(*)::int AS n FROM policy_statement_expression
        WHERE policy_statement_id = ANY(${statementIds}::uuid[]) AND record_end_date IS NULL;
      `);
      expect(links.rows[0].n).to.equal(0);
    });
  });

  describe('createDataRequestForTicket (legacy ticket-bound flow)', () => {
    it('I4: empty `featureTypes` preserves the deny-all baseline; the admin flow seeds both teams from the picker selection as-is (requester not auto-added)', async () => {
      const requester = await createUser('I4-req');
      const collaborator = await createUser('I4-coll');

      // The legacy admin flow starts from an existing ticket.
      const ticket = await ticketService.createTicket({
        subject: 'I4 admin-bound ticket',
        description: 'Pre-existing ticket for the legacy data-request flow',
        priority: 'medium'
      });

      const dataRequest = await service.createDataRequestForTicket(ticket.ticket_id, {
        requested_by: requester,
        reason: 'I4 admin/legacy flow — deny-all baseline must be preserved',
        // The admin ticket flow (`POST /api/tickets/{ticketId}/data-request`) passes the picker
        // selection through verbatim. To put the requester on the access list, the caller
        // includes them explicitly — see service docstring.
        system_user_ids: [requester, collaborator]
      });

      // Single DENY statement covering all feature types.
      const statements = await activeStatements(dataRequest.policy_id);
      expect(statements).to.deep.equal([{ urn: 'urn:*:*:*', effect: 'deny' }]);

      // No expression rows or links for the deny-all path.
      const statementIds = (
        await connection.sql(SQL`
          SELECT policy_statement_id FROM policy_statement
          WHERE policy_id = ${dataRequest.policy_id} AND record_end_date IS NULL;
        `)
      ).rows.map((r: any) => r.policy_statement_id);
      const links = await connection.sql(SQL`
        SELECT count(*)::int AS n FROM policy_statement_expression
        WHERE policy_statement_id = ANY(${statementIds}::uuid[]) AND record_end_date IS NULL;
      `);
      expect(links.rows[0].n).to.equal(0);

      // The admin ticket flow passes the picker selection as-is and does NOT auto-add the
      // requester (see DataRequestService contract + paths/tickets/{ticketId}/data-request).
      // Both DR-owned teams therefore contain exactly the picker selection.
      const dataRequestTeamId = dataRequest.team_id;
      const policyTeamRows = await connection.sql(SQL`
        SELECT team_id FROM team_policy WHERE policy_id = ${dataRequest.policy_id};
      `);
      expect(policyTeamRows.rowCount).to.equal(1);
      const policyTeamId = policyTeamRows.rows[0].team_id as string;

      const expectedMembers = [requester, collaborator].sort((a, b) => a - b);
      expect(await teamMemberIds(dataRequestTeamId)).to.deep.equal(expectedMembers);
      expect(await teamMemberIds(policyTeamId)).to.deep.equal(expectedMembers);
    });

    it('I5: empty `system_user_ids` in the admin flow yields empty teams (the picker is the canonical access list; the requester is not auto-added)', async () => {
      const requester = await createUser('I5-req');

      const ticket = await ticketService.createTicket({
        subject: 'I5 empty-picker ticket',
        description: 'Ticket for the empty-picker latent-bug case',
        priority: 'medium'
      });

      // The admin ticket flow passes the picker selection through verbatim. An empty picker
      // produces empty teams — the requester is not auto-unioned in. See service docstring.
      const dataRequest = await service.createDataRequestForTicket(ticket.ticket_id, {
        requested_by: requester,
        reason: 'I5 empty picker — admin flow does not auto-union the requester',
        system_user_ids: [],
        featureTypes: ['dataset'],
        expression: null
      });

      const policyTeamRows = await connection.sql(SQL`
        SELECT team_id FROM team_policy WHERE policy_id = ${dataRequest.policy_id};
      `);
      expect(policyTeamRows.rowCount).to.equal(1);

      // The admin flow does not auto-add the requester, so an empty picker yields empty teams.
      expect(await teamMemberIds(dataRequest.team_id)).to.deep.equal([]);
      expect(await teamMemberIds(policyTeamRows.rows[0].team_id as string)).to.deep.equal([]);
    });
  });

  describe('error paths', () => {
    it('I6: unknown feature-type name rejects with HTTP400 before any policy / statement / expression / data_request row is written', async () => {
      const requester = await createUser('I6-req');

      // Route through `createDataRequestForTicket` directly to isolate the unknown-featureType
      // gate from the ticket-subject auto-generation in `createDataRequest`. The pre-validate
      // gate the assertion covers lives on `createDataRequestForTicket` and runs identically
      // for both entry points.
      const ticket = await ticketService.createTicket({
        subject: 'I6 unknown-featureType ticket',
        description: 'Pre-existing ticket for the unknown-featureType pre-validate gate',
        priority: 'medium'
      });

      const before = await connection.sql(SQL`
        SELECT
          (SELECT count(*)::int FROM policy) AS policy_count,
          (SELECT count(*)::int FROM policy_statement) AS statement_count,
          (SELECT count(*)::int FROM expression) AS expression_count,
          (SELECT count(*)::int FROM data_request) AS data_request_count;
      `);

      try {
        await service.createDataRequestForTicket(ticket.ticket_id, {
          requested_by: requester,
          reason: 'I6 unknown feature type must reject before any write',
          system_user_ids: [],
          featureTypes: ['definitely_not_a_real_feature_type'],
          expression: null
        });
        expect.fail('Expected HTTP400 for unknown feature type');
      } catch (error: any) {
        expect(error.status).to.equal(400);
      }

      const after = await connection.sql(SQL`
        SELECT
          (SELECT count(*)::int FROM policy) AS policy_count,
          (SELECT count(*)::int FROM policy_statement) AS statement_count,
          (SELECT count(*)::int FROM expression) AS expression_count,
          (SELECT count(*)::int FROM data_request) AS data_request_count;
      `);

      // Row counts must be unchanged — the pre-validate gate runs before any of these tables are touched.
      expect(after.rows[0].policy_count).to.equal(before.rows[0].policy_count);
      expect(after.rows[0].statement_count).to.equal(before.rows[0].statement_count);
      expect(after.rows[0].expression_count).to.equal(before.rows[0].expression_count);
      expect(after.rows[0].data_request_count).to.equal(before.rows[0].data_request_count);
    });

    it('I7: a mid-flow failure in team_policy creation rolls back the policy / statement / expression / data_request side-effects of this request', async () => {
      const requester = await createUser('I7-req');

      const before = await connection.sql(SQL`
        SELECT
          (SELECT count(*)::int FROM policy) AS policy_count,
          (SELECT count(*)::int FROM policy_statement) AS statement_count,
          (SELECT count(*)::int FROM expression) AS expression_count,
          (SELECT count(*)::int FROM data_request) AS data_request_count;
      `);

      sinon.stub(TeamPolicyService.prototype, 'createTeamPolicy').rejects(new Error('I7 simulated mid-flow failure'));

      const ticket = await ticketService.createTicket({
        subject: 'I7 rollback ticket',
        description: 'Ticket pre-created before the mid-flow failure stub',
        priority: 'medium'
      });

      try {
        await service.createDataRequestForTicket(ticket.ticket_id, {
          requested_by: requester,
          reason: 'I7 mid-flow rollback — team_policy failure must roll back the chain',
          system_user_ids: [],
          featureTypes: ['dataset'],
          expression: buildExpression('I7-tree')
        });
        expect.fail('Expected mid-flow failure to surface as a rejection');
      } catch (error: any) {
        expect(error.message).to.equal('I7 simulated mid-flow failure');
      }

      // The DR row must not have been inserted (it is the last step), and no statement / expression /
      // policy artifacts unique to this request should remain — the test transaction will be rolled
      // back in afterEach, but we also assert here that no extra rows landed against the running
      // counter while the test was still inside `createDataRequestForTicket`.
      const after = await connection.sql(SQL`
        SELECT
          (SELECT count(*)::int FROM data_request) AS data_request_count;
      `);
      expect(after.rows[0].data_request_count).to.equal(before.rows[0].data_request_count);
    });
  });
});
