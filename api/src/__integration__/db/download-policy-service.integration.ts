// Integration test for DownloadPolicyService — verifies that creating a download
// policy writes the expected policy + policy_statement + policy_statement_expression
// rows against a real database, and that download policies are intentionally
// scope-free (no team_policy / security_scope rows) so they can never act as a
// backdoor for granting access.
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
   * dataset.name and return the persisted root id. Mirrors the route's call
   * sequence (`writeExpressionTree`) so the test exercises the same write
   * path as production.
   */
  async function writeNamePredicate(value: string): Promise<string> {
    // dataset.name → feature_property_id=31, feature_type_property_id=70 (seed).
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
    it('writes one policy (status=approved) plus one statement per feature type with no expression links on the broad path', async () => {
      const { policy_id } = await policyService.createDownloadPolicy({
        name: 'Broad Path Test',
        description: 'two feature types, no expression',
        featureTypes: ['dataset', 'sample_site'],
        expressionId: null
      });

      const policyRow = await connection.sql(SQL`
        SELECT name, description, status FROM policy WHERE policy_id = ${policy_id};
      `);
      expect(policyRow.rowCount).to.equal(1);
      expect(policyRow.rows[0].name).to.equal('Broad Path Test');
      expect(policyRow.rows[0].status).to.equal('approved');

      const statements = await connection.sql(SQL`
        SELECT urn_feature_type, submission_feature_urn, effect
        FROM policy_statement
        WHERE policy_id = ${policy_id} AND record_end_date IS NULL
        ORDER BY urn_feature_type;
      `);
      expect(statements.rowCount).to.equal(2);
      expect(statements.rows[0].urn_feature_type).to.equal('dataset');
      expect(statements.rows[0].effect).to.equal('allow');
      expect(statements.rows[0].submission_feature_urn).to.equal('urn:*:dataset:*');
      expect(statements.rows[1].urn_feature_type).to.equal('sample_site');

      // Broad path: no expression links.
      const expressionLinks = await connection.sql(SQL`
        SELECT pse.policy_statement_expression_id
        FROM policy_statement_expression pse
        JOIN policy_statement ps ON ps.policy_statement_id = pse.policy_statement_id
        WHERE ps.policy_id = ${policy_id} AND pse.record_end_date IS NULL;
      `);
      expect(expressionLinks.rowCount).to.equal(0);
    });

    it('writes one expression link per statement when an expressionId is provided, sharing the same expression_id across statements', async () => {
      // Edge case #2 from the plan: featureTypes:['a','b'] + one expressionId →
      // 2 statements, 2 expression links, same expression_id on both rows.
      const expressionId = await writeNamePredicate('Edge2-Tree');

      const { policy_id } = await policyService.createDownloadPolicy({
        name: 'Two FT Same Expression',
        description: null,
        featureTypes: ['dataset', 'sample_site'],
        expressionId
      });

      const expressionLinks = await connection.sql(SQL`
        SELECT pse.expression_id, pse.policy_statement_id
        FROM policy_statement_expression pse
        JOIN policy_statement ps ON ps.policy_statement_id = pse.policy_statement_id
        WHERE ps.policy_id = ${policy_id} AND pse.record_end_date IS NULL;
      `);
      expect(expressionLinks.rowCount).to.equal(2);
      const expressionIds = new Set(expressionLinks.rows.map((r: any) => r.expression_id));
      expect(expressionIds.size).to.equal(1);
      expect(expressionIds.has(expressionId)).to.equal(true);
      // Two distinct statements, both linked to the same expression.
      const statementIds = new Set(expressionLinks.rows.map((r: any) => r.policy_statement_id));
      expect(statementIds.size).to.equal(2);
    });

    it('does not write team_policy or security_scope rows for the new policy', async () => {
      // U4 (AC #5): download policies define the feature set to export, not who
      // can read it. Skipping team_policy / security_scope keeps create-download
      // from being a backdoor for granting access; export-time enforcement is
      // the security boundary.
      const { policy_id } = await policyService.createDownloadPolicy({
        name: 'No Scope Leak',
        description: null,
        featureTypes: ['dataset'],
        expressionId: null
      });

      const teamPolicies = await connection.sql(SQL`
        SELECT count(*)::int AS n FROM team_policy WHERE policy_id = ${policy_id};
      `);
      expect(teamPolicies.rows[0].n).to.equal(0);

      // security_scope rows are linked to policy_statement rows via the
      // policy_statement_scope join table. A scope-free policy must produce
      // zero rows in that join for any of its statements.
      const statementIds = (
        await connection.sql(SQL`
          SELECT policy_statement_id FROM policy_statement WHERE policy_id = ${policy_id};
        `)
      ).rows.map((r: any) => r.policy_statement_id);
      expect(statementIds.length).to.be.greaterThan(0);

      const scopeJoinRows = await connection.sql(SQL`
        SELECT count(*)::int AS n FROM policy_statement_scope
        WHERE policy_statement_id = ANY(${statementIds}::uuid[]);
      `);
      expect(scopeJoinRows.rows[0].n).to.equal(0);
    });

    it('audit chain: download → policy → policy_statement → policy_statement_expression → expression round-trips the original tree', async () => {
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
        featureTypes: ['dataset'],
        expressionId: rootExpressionId
      });

      const { download_id } = await downloadService.createDownload({ policyId: policy_id, format: 'parquet' });

      const linkRows = await connection.sql(SQL`
        SELECT pse.expression_id
          FROM download d
          JOIN policy_statement ps USING (policy_id)
          JOIN policy_statement_expression pse USING (policy_statement_id)
         WHERE d.download_id = ${download_id} AND pse.record_end_date IS NULL;
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
        featureTypes: ['dataset'],
        expressionId: null
      });

      await downloadService.createDownload({ policyId: policy_id, format: 'parquet' });

      try {
        await downloadService.createDownload({ policyId: policy_id, format: 'parquet' });
        expect.fail('Expected unique-violation on duplicate policy_id');
      } catch (error: any) {
        const pgMessage = error.errors?.[0]?.message ?? error.message ?? '';
        // Index name from the migration: download_policy_unique
        expect(pgMessage).to.include('download_policy_unique');
      }
    });

    it('rejects unknown feature types with HTTP400 before any DB write (AC #7)', async () => {
      const before = await connection.sql(SQL`SELECT count(*)::int AS n FROM policy;`);
      const beforeCount = before.rows[0].n as number;

      try {
        await policyService.createDownloadPolicy({
          name: 'Should Reject',
          description: null,
          featureTypes: ['dataset', 'definitely_not_a_real_feature_type'],
          expressionId: null
        });
        expect.fail('Expected HTTP400 for unknown feature type');
      } catch (error: any) {
        // HTTP400 surfaces a `status` of 400.
        expect(error.status).to.equal(400);
      }

      const after = await connection.sql(SQL`SELECT count(*)::int AS n FROM policy;`);
      expect(after.rows[0].n as number).to.equal(beforeCount);
    });

    it('throws foreign_key_violation when deleting a policy that still has a referencing download', async () => {
      const { policy_id } = await policyService.createDownloadPolicy({
        name: 'FK Guard',
        description: null,
        featureTypes: ['dataset'],
        expressionId: null
      });
      await downloadService.createDownload({ policyId: policy_id, format: 'parquet' });

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
