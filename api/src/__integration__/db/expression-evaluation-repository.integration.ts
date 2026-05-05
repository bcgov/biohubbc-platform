// Integration test for ExpressionEvaluationRepository — verifies that the
// emitted SQL (recursive expression-tree evaluator + broad feature-type
// projection) returns the expected submission_feature_id sets against a real
// schema, including the security filter applied for an authenticated user.
//
// Both the search wrapper (POST /api/search/feature) and the download pipeline
// (POST /api/download) consume the same emitted SQL, so a single substrate
// keeps semantics identical across both consumers — these tests pin that.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { NormalizedExpressionTreeExpression, NormalizedExpressionTreePredicate } from '../../models/expression-tree-internal';
import { ExpressionEvaluationRepository } from '../../repositories/expression-evaluation-repository';
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';

/**
 * Build a normalized predicate clause that targets the `sample_site.name` string property.
 *
 * Why sample_site rather than dataset: the evaluator's recursive graph projects evidence
 * through dataset → all-features-in-submission synthetic edges, which would pull in
 * decoy datasets when we want a clean target set. Anchoring on a non-dataset feature
 * type with its own `name` property keeps the target set tight, one feature per
 * submission per test.
 *
 * Both the predicate-evidence query and the typed-table JOIN need
 * (feature_property_id, feature_type_property_id, internal_predicate type/operator/value).
 *
 * Seed values: feature_property_id=31 (name, string), feature_type_property_id=45 (sample_site.name).
 */
function namePredicate(value: string): NormalizedExpressionTreePredicate {
  return {
    type: 'predicate',
    feature_property_id: 31,
    feature_type_property_id: 45,
    operator: 'Equals',
    value,
    feature_property_type_id: 1,
    feature_property_type_name: 'string',
    internal_predicate: { type: 'string', operator: 'Equals', value }
  } as unknown as NormalizedExpressionTreePredicate;
}

describe('ExpressionEvaluationRepository (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let repo: ExpressionEvaluationRepository;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    repo = new ExpressionEvaluationRepository(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  /**
   * Helper: write the typed string property row used by the predicate query.
   * The expression-tree evaluator JOINs feature_type_property + reads from
   * `submission_feature_property_string`; both have to be populated for a row
   * to satisfy a string predicate.
   *
   * Uses sample_site.name (feature_type_property_id=45) — see `namePredicate` for why.
   */
  async function indexNameProperty(submissionFeatureId: number, value: string): Promise<void> {
    const systemUserId = connection.systemUserId();
    await connection.sql(SQL`
      INSERT INTO submission_feature_property_string
        (submission_feature_id, feature_type_property_id, value, create_user)
      VALUES (${submissionFeatureId}, 45, ${value}, ${systemUserId});
    `);
  }

  /**
   * Helper: run an emitted Knex subquery and return the resulting set of
   * submission_feature_id values. Strips ordering off the caller — set-equality
   * is what every test cares about.
   */
  async function runSubquery(subquery: any): Promise<Set<number>> {
    const { sql, bindings } = subquery.toSQL().toNative();
    const result = await connection.query<{ submission_feature_id: number }>(sql, bindings as any[]);
    return new Set(result.rows.map((r) => r.submission_feature_id));
  }

  describe('buildBroadFeatureTypeSubquery', () => {
    it('returns every active submission_feature of the given type for an authenticated user', async () => {
      const submissionId = await createTestSubmission(connection);
      const a = await createTestFeature(connection, submissionId, 'sample_site', { name: 'A' });
      const b = await createTestFeature(connection, submissionId, 'sample_site', { name: 'B' });
      // Decoy of a different feature type — must not appear.
      const decoy = await createTestFeature(connection, submissionId, 'capture', { comment: 'cap' });

      const subquery = repo.buildBroadFeatureTypeSubquery('sample_site', connection.systemUserId());
      const ids = await runSubquery(subquery);

      expect(ids.has(a)).to.equal(true);
      expect(ids.has(b)).to.equal(true);
      expect(ids.has(decoy)).to.equal(false);
    });

    it('partial-access export: types with no readable features return an empty set without error', async () => {
      // Edge Case #8 from spec.md — a download with N feature types where the policy creator
      // can read some but not others. Per-statement evaluation returns the readable rows for
      // the accessible type and an empty set for the inaccessible type. The pipeline still
      // completes (one Parquet per statement, some empty) — "5 in, 5 files, 1 empty" is a
      // valid, deliberate outcome, not a failure.
      const submissionAccessible = await createTestSubmission(connection);
      const accessible = await createTestFeature(connection, submissionAccessible, 'sample_site', { name: 'visible' });

      const submissionRestricted = await createTestSubmission(connection);
      const restricted = await createTestFeature(connection, submissionRestricted, 'capture', { comment: 'hidden' });

      // Apply a security rule. With systemUserId=null (anonymous), the security filter
      // strips any secured feature — the same mechanism that strips features from a
      // statement whose policy creator lacks the matching team grant.
      const systemUserId = connection.systemUserId();
      await connection.sql(SQL`
        INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, create_user)
        VALUES (${restricted}, 1, ${systemUserId});
      `);

      // Per-statement subquery for the type the user CAN see → returns the row.
      const accessibleIds = await runSubquery(repo.buildBroadFeatureTypeSubquery('sample_site', null));
      expect(accessibleIds.has(accessible)).to.equal(true);

      // Per-statement subquery for the type the user CAN'T see → returns nothing
      // and crucially does not throw. At pipeline level this is what produces an
      // empty Parquet file rather than a failed download.
      const restrictedIds = await runSubquery(repo.buildBroadFeatureTypeSubquery('capture', null));
      expect(restrictedIds.has(restricted)).to.equal(false);
      expect(restrictedIds.size).to.equal(0);
    });
  });

  describe('buildExpressionTreeFeatureIdsSubquery', () => {
    it('AND tree returns only features matching every predicate', async () => {
      // Use isolated submissions so the dataset → submission synthetic edge can't
      // bridge target and decoy into the same connected component.
      const submissionTarget = await createTestSubmission(connection);
      const target = await createTestFeature(connection, submissionTarget, 'sample_site', { name: 'AND-target' });
      await indexNameProperty(target, 'AND-target');

      const submissionOther = await createTestSubmission(connection);
      const other = await createTestFeature(connection, submissionOther, 'sample_site', { name: 'AND-other' });
      await indexNameProperty(other, 'AND-other');

      const tree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [namePredicate('AND-target')]
      };

      const subquery = repo.buildExpressionTreeFeatureIdsSubquery('sample_site', tree, connection.systemUserId());
      const ids = await runSubquery(subquery);

      expect(ids.has(target)).to.equal(true);
      expect(ids.has(other)).to.equal(false);
    });

    it('OR tree returns the union of predicate matches', async () => {
      // Each candidate lives in its own submission to keep the bridge narrow.
      const submissionA = await createTestSubmission(connection);
      const a = await createTestFeature(connection, submissionA, 'sample_site', { name: 'OR-A' });
      await indexNameProperty(a, 'OR-A');

      const submissionB = await createTestSubmission(connection);
      const b = await createTestFeature(connection, submissionB, 'sample_site', { name: 'OR-B' });
      await indexNameProperty(b, 'OR-B');

      const submissionDecoy = await createTestSubmission(connection);
      const decoy = await createTestFeature(connection, submissionDecoy, 'sample_site', { name: 'OR-decoy' });
      await indexNameProperty(decoy, 'OR-decoy');

      const tree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'OR',
        clauses: [namePredicate('OR-A'), namePredicate('OR-B')]
      };

      const subquery = repo.buildExpressionTreeFeatureIdsSubquery('sample_site', tree, connection.systemUserId());
      const ids = await runSubquery(subquery);

      expect(ids.has(a)).to.equal(true);
      expect(ids.has(b)).to.equal(true);
      expect(ids.has(decoy)).to.equal(false);
    });

    it('security filter excludes features the user cannot read', async () => {
      const submissionOpen = await createTestSubmission(connection);
      const open = await createTestFeature(connection, submissionOpen, 'sample_site', { name: 'Open-secfilter' });
      await indexNameProperty(open, 'Open-secfilter');

      const submissionSecured = await createTestSubmission(connection);
      const secured = await createTestFeature(connection, submissionSecured, 'sample_site', { name: 'Secured-secfilter' });
      await indexNameProperty(secured, 'Secured-secfilter');

      // Apply a security rule. Anonymous callers see only unsecured features.
      const systemUserId = connection.systemUserId();
      await connection.sql(SQL`
        INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, create_user)
        VALUES (${secured}, 1, ${systemUserId});
      `);

      const tree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'OR',
        clauses: [namePredicate('Open-secfilter'), namePredicate('Secured-secfilter')]
      };
      const subquery = repo.buildExpressionTreeFeatureIdsSubquery('sample_site', tree, null);
      const ids = await runSubquery(subquery);

      expect(ids.has(open)).to.equal(true);
      expect(ids.has(secured)).to.equal(false);
    });

    it('security filter excludes secured target features even when reached from unsecured evidence (defense in depth)', async () => {
      // Regression test for the leak path the download pipeline previously had:
      // evidence-side filtering let the predicate see an unsecured row, then graph traversal
      // projected to a related SECURED target row. With only evidence-side filtering, the
      // secured target id flowed out of the subquery to any consumer that bypassed the search
      // wrapper's outer filter (e.g. the download cursor). The fix re-applies the security
      // filter at the projected target level.
      const submission = await createTestSubmission(connection);

      // Evidence row — anonymous callers can read it; carries the predicate match.
      const evidence = await createTestFeature(connection, submission, 'sample_site', { name: 'evidence-row' });
      await indexNameProperty(evidence, 'evidence-row');

      // Target row — same anchor type, parent of evidence so the parent-child graph edge
      // bridges them. SECURED, so anonymous callers must NOT see it.
      const securedTarget = await createTestFeature(
        connection,
        submission,
        'sample_site',
        { name: 'secured-target' },
        evidence
      );
      const systemUserId = connection.systemUserId();
      await connection.sql(SQL`
        INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, create_user)
        VALUES (${securedTarget}, 1, ${systemUserId});
      `);

      const tree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [namePredicate('evidence-row')]
      };
      const subquery = repo.buildExpressionTreeFeatureIdsSubquery('sample_site', tree, null);
      const ids = await runSubquery(subquery);

      // Evidence is unsecured and matches the predicate — keep it.
      expect(ids.has(evidence)).to.equal(true);
      // Secured target is reachable via the graph from `evidence` — must NOT leak through.
      expect(ids.has(securedTarget)).to.equal(false);
    });
  });
});
