// Integration test for DownloadPolicyService — verifies that creating a download
// policy writes the expected policy + policy_statement links
// rows against a real database, and that download policies are intentionally
// grant-free (no team_policy / team_security_scope rows) so they can never act
// as a backdoor for granting access.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ExpressionTree } from '../../models/expression-tree';
import { DownloadPolicyService } from '../../services/download/download-policy-service';
import { DownloadService } from '../../services/download/download-service';
import { ExpressionTreeService } from '../../services/expression-tree-service';

describe('DownloadPolicyService (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let policyService: DownloadPolicyService;
  let downloadService: DownloadService;
  let expressionTreeService: ExpressionTreeService;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    policyService = new DownloadPolicyService(connection);
    downloadService = new DownloadService(connection);
    expressionTreeService = new ExpressionTreeService(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  /**
   * Helper: write an expression tree with one string predicate against
   * survey.name and return the persisted root id. Mirrors the route's call
   * sequence (`writeExpressionTree`) so the test exercises the same write
   * path as production.
   */
  async function writeNamePredicate(value: string): Promise<string> {
    // survey.name → feature_property_id=31, feature_type_property_id=70 (seed).
    const tree: ExpressionTree = {
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 31,
          feature_type_property_id: 70,
          operator: 'Equals',
          value
        }
      ]
    };
    const { expression_id } = await expressionTreeService.writeExpressionTree(tree);
    return expression_id;
  }

  describe('createDownloadPolicy', () => {
    it('writes one policy (status=approved) plus one wildcard statement with no expression links on the broad path', async () => {
      const { policy_id } = await policyService.createDownloadPolicy({
        name: 'Broad Path Test',
        description: 'two feature types, no expression',
        expressionId: null
      });

      const policyRow = await connection.sql(SQL`
        SELECT name, description, status FROM policy WHERE policy_id = ${policy_id};
      `);
      expect(policyRow.rowCount).to.equal(1);
      expect(policyRow.rows[0].name).to.equal('Broad Path Test');
      expect(policyRow.rows[0].status).to.equal('approved');

      const statements = await connection.sql(SQL`
        SELECT
          ss.urn_feature_type,
          concat('urn:', ss.urn_submission_id, ':', ss.urn_feature_type, ':', ss.urn_feature_id) AS submission_feature_urn,
          ps.effect
        FROM policy_statement ps
        JOIN security_scope ss ON ss.security_scope_id = ps.security_scope_id
        WHERE ps.policy_id = ${policy_id} AND ps.record_end_date IS NULL
        ORDER BY ss.urn_feature_type;
      `);
      expect(statements.rowCount).to.equal(1);
      expect(statements.rows[0].urn_feature_type).to.equal('*');
      expect(statements.rows[0].effect).to.equal('allow');
      expect(statements.rows[0].submission_feature_urn).to.equal('urn:*:*:*');

      // Broad path: no statement-level expression links.
      const expressionLinks = await connection.sql(SQL`
        SELECT policy_statement_id
        FROM policy_statement
        WHERE policy_id = ${policy_id}
          AND policy_expression_id IS NOT NULL
          AND record_end_date IS NULL;
      `);
      expect(expressionLinks.rowCount).to.equal(0);
    });

    it('writes one expression link for the wildcard statement when an expressionId is provided', async () => {
      const expressionId = await writeNamePredicate('Edge2-Tree');

      const { policy_id } = await policyService.createDownloadPolicy({
        name: 'Two FT Same Expression',
        description: null,
        expressionId
      });

      const expressionLinks = await connection.sql(SQL`
        SELECT pe.expression_id, ps.policy_statement_id
        FROM policy_statement ps
        JOIN policy_expression pe ON pe.policy_expression_id = ps.policy_expression_id
        WHERE ps.policy_id = ${policy_id}
          AND pe.record_end_date IS NULL;
      `);
      expect(expressionLinks.rowCount).to.equal(1);
      const expressionIds = new Set(expressionLinks.rows.map((r: any) => r.expression_id));
      expect(expressionIds.size).to.equal(1);
      expect(expressionIds.has(expressionId)).to.equal(true);
      const statementIds = new Set(expressionLinks.rows.map((r: any) => r.policy_statement_id));
      expect(statementIds.size).to.equal(1);
    });

    it('does not write team_policy or team_security_scope grant rows for the new policy', async () => {
      // U4 (AC #5): download policies define the feature set to export, not who
      // can read it. Statements still point at security_scope rows, but skipping
      // team_policy / team_security_scope keeps create-download from being a
      // backdoor for granting access; export-time enforcement is the security boundary.
      const { policy_id } = await policyService.createDownloadPolicy({
        name: 'No Scope Leak',
        description: null,
        expressionId: null
      });

      const teamPolicies = await connection.sql(SQL`
        SELECT count(*)::int AS n FROM team_policy WHERE policy_id = ${policy_id};
      `);
      expect(teamPolicies.rows[0].n).to.equal(0);

      const statements = await connection.sql(SQL`
        SELECT count(*)::int AS n
        FROM policy_statement
        WHERE policy_id = ${policy_id}
          AND security_scope_id IS NOT NULL
          AND record_end_date IS NULL;
      `);
      expect(statements.rows[0].n).to.equal(1);

      const teamScopeGrants = await connection.sql(SQL`
        SELECT count(*)::int AS n
        FROM team_security_scope tss
        JOIN policy_statement ps USING (security_scope_id)
        WHERE ps.policy_id = ${policy_id};
      `);
      expect(teamScopeGrants.rows[0].n).to.equal(0);
    });

    it('audit chain: download → policy → policy_statement → policy_expression → expression round-trips the original tree', async () => {
      // U5 (audit chain): walk download → policy → statement → expression link
      // → expression and confirm the persisted tree round-trips deep-equal.
      const inputTree: ExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            type: 'predicate',
            feature_property_id: 31,
            feature_type_property_id: 70,
            operator: 'Equals',
            value: 'AuditChain-Tree'
          }
        ]
      };
      const { expression_id: rootExpressionId } = await expressionTreeService.writeExpressionTree(inputTree);

      const { policy_id } = await policyService.createDownloadPolicy({
        name: 'Audit Chain',
        description: null,
        expressionId: rootExpressionId
      });

      const { download_id } = await downloadService.createDownload({
        policyId: policy_id,
        format: 'parquet',
        requestedBy: connection.systemUserId()
      });

      const linkRows = await connection.sql(SQL`
        SELECT pe.expression_id
          FROM download d
          JOIN policy_statement ps USING (policy_id)
          JOIN policy_expression pe ON pe.policy_expression_id = ps.policy_expression_id
         WHERE d.download_id = ${download_id}
           AND pe.record_end_date IS NULL;
      `);
      expect(linkRows.rowCount).to.equal(1);
      const linkedExpressionId = linkRows.rows[0].expression_id as string;
      expect(linkedExpressionId).to.equal(rootExpressionId);

      const reconstructed = await expressionTreeService.readExpressionTree(linkedExpressionId);
      expect(reconstructed).to.deep.equal(inputTree);
    });

    it('rejects a second download referencing the same policy_id (UNIQUE constraint)', async () => {
      const { policy_id } = await policyService.createDownloadPolicy({
        name: 'Unique Policy',
        description: null,
        expressionId: null
      });

      await downloadService.createDownload({
        policyId: policy_id,
        format: 'parquet',
        requestedBy: connection.systemUserId()
      });

      try {
        await downloadService.createDownload({
          policyId: policy_id,
          format: 'parquet',
          requestedBy: connection.systemUserId()
        });
        expect.fail('Expected unique-violation on duplicate policy_id');
      } catch (error: any) {
        const pgMessage = error.errors?.[0]?.message ?? error.message ?? '';
        // Index name from the migration: download_policy_unique
        expect(pgMessage).to.include('download_policy_unique');
      }
    });

    it('throws foreign_key_violation when deleting a policy that still has a referencing download', async () => {
      const { policy_id } = await policyService.createDownloadPolicy({
        name: 'FK Guard',
        description: null,
        expressionId: null
      });
      await downloadService.createDownload({
        policyId: policy_id,
        format: 'parquet',
        requestedBy: connection.systemUserId()
      });

      try {
        await connection.sql(SQL`DELETE FROM policy WHERE policy_id = ${policy_id};`);
        expect.fail('Expected foreign_key_violation when deleting referenced policy');
      } catch (error: any) {
        // The pg client wrapper strips SQLSTATE from the surfaced error and
        // exposes only `name` and `message` on `errors[0]`. Match on the
        // PG-rendered message — it always starts with the violation phrase.
        const pgMessage = error.errors?.[0]?.message ?? error.message ?? '';
        expect(pgMessage).to.match(
          /violates foreign key constraint/,
          `expected foreign-key-violation message, got: ${pgMessage}`
        );
      }
    });
  });
});
