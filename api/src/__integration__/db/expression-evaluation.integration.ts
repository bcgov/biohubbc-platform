// Integration tests for expression-evaluation — verifies that the emitted SQL returns the expected
// submission_feature_id sets against a real schema, including the security filter applied for an
// authenticated user.
//
// SEMANTICS UNDER TEST — closure + recursive content walk:
// The evaluator resolves a predicate's evidence features (security-filtered on the evidence side) and
// then expands them to the anchor feature type through two reachability sources combined with UNION:
//
//   content_reach  = a bounded recursive walk SEEDED FROM the evidence (depth 0), following the BIDIRECTIONAL
//                    edges the closure omits — submission_feature_feature content edges AND synthetic
//                    dataset↔same-submission membership edges (both endpoints active) — cap depth < 6 in the
//                    recursive step (deepest node reached is 6 edges from the seed), cycle-guarded by the
//                    visited path. content_reach ALWAYS includes the evidence itself.
//   reachable      = content_reach
//                    ∪ closureForward = { c.target : c.source ∈ content_reach }  (ancestors + referenced)
//                    ∪ closureReverse = { c.source : c.target ∈ content_reach }  (descendants + referencing)
//   result         = { sf ∈ reachable : sf is of anchorFeatureType, sf active, sf passes TARGET security }
//
// The closure (submission_feature_closure) is UPLOAD-SCOPED and precomputes parent-ancestry and
// property-reference reach. A parent edge stores (source=child, target=parent); a property edge stores
// (source=feature, target=referenced). It is built by SubmissionFeatureClosureService.computeClosureForUpload
// AFTER seeding and BEFORE running the subquery. Closure relatedness therefore REQUIRES a shared upload.
// Content edges are excluded from the closure and are walked at read time; they need neither a shared
// upload nor a closure rebuild.
//
// Key consequences pinned by these tests:
//   1. Evidence is always in content_reach, so a reflexive match (anchor = evidence's own type) returns
//      the evidence even with an empty closure and no content edges.
//   2. Ancestor / descendant / property reach REQUIRES a shared upload + computeClosureForUpload.
//   3. Content reach is a RECURSIVE multi-hop walk (not one-hop).
//   4. content→closure chains: a content neighbour M of E contributes M's closure ancestors/descendants,
//      because M ∈ content_reach and the closure is probed from content_reach.
//   5. ACCEPTED, INTENTIONAL GAP: the reverse order (closure-ancestor of E, then THAT ancestor's content
//      edge) is NOT recovered — the content walk seeds only from evidence, not from closure results.
//   6. Dataset MEMBERSHIP reach (dataset ↔ every same-submission feature) is walked at read time like
//      content — closure-independent, needing only a shared submission_id (not an upload or a rebuild).
//
// UO#5 / API-shape acceptance rows are exercised at the route layer and are out of scope for this
// evaluator suite, which pins the emitted-SQL reachability semantics directly.
//
// Both the search wrapper (POST /api/search/feature) and the download pipeline (POST /api/download)
// consume the same emitted SQL, so a single substrate keeps semantics identical across both consumers.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: docker compose exec api npm run test:mocha -- --no-config --extension ts \
//        'src/__integration__/db/expression-evaluation.integration.ts'
// Requires: database container running with seed data.

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { MAX_SEARCH_GRAPH_DEPTH } from '../../constants/expression';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import {
  NormalizedExpressionTreeExpression,
  NormalizedExpressionTreePredicate
} from '../../models/expression-tree-internal';
import {
  buildBroadFeatureTypeSubquery,
  buildExpressionTreeFeatureIdsSubquery
} from '../../repositories/expression-evaluation';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import { createFeatureTypeProperty, createTestUpload } from '../helpers/test-feature-property-helpers';
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';

// Verified seed ids (checked against the live DB):
//   feature_property name           = 31
//   sample_site.name ftp            = 45
//   dataset.name ftp                = 70
const FEATURE_PROPERTY_NAME_ID = 31;
const SAMPLE_SITE_NAME_FTP_ID = 45;
const DATASET_NAME_FTP_ID = 70;

/**
 * Build a normalized predicate clause that targets a string `name` property.
 *
 * `feature_property_id` stays 31 (the shared `name` feature_property); `featureTypePropertyId` selects
 * the typed slot to filter on (45 = sample_site.name, 70 = dataset.name). The predicate is intentionally
 * target-feature agnostic — it only identifies EVIDENCE features that carry the matching string row; the
 * evaluator then projects that evidence to the anchor type through the closure + content walk.
 */
function namePredicate(
  value: string,
  featureTypePropertyId: number = SAMPLE_SITE_NAME_FTP_ID
): NormalizedExpressionTreePredicate {
  return {
    type: 'predicate',
    feature_property_id: FEATURE_PROPERTY_NAME_ID,
    feature_type_property_id: featureTypePropertyId,
    operator: 'Equals',
    value,
    feature_property_type_id: 1,
    feature_property_type_name: 'string',
    internal_predicate: { type: 'string', operator: 'Equals', value }
  } as unknown as NormalizedExpressionTreePredicate;
}

describe('expression-evaluation (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  // --- local fixture helpers -----------------------------------------------

  /**
   * Insert one submission_feature bound to a SPECIFIC upload, resolving feature_type_id by NAME so the
   * anchor filter can isolate a target type.
   *
   * The closure recompute is upload-scoped and only walks edges whose BOTH endpoints are active features
   * of the same upload, so a parent and its children must share one submission_upload_id. createTestFeature
   * mints its OWN upload per call and cannot place a parent + child under one upload, so the closure-driven
   * fixtures insert features directly here. `recordEndDate` marks a feature inactive (excluded from the
   * active universe, dropped from the closure and the content walk's active-endpoint guard).
   *
   * @returns The new submission_feature_id.
   */
  async function insertFeatureRow(params: {
    submissionId: number;
    submissionUploadId: string;
    featureTypeName: string;
    parentFeatureId?: number;
    recordEndDate?: boolean;
  }): Promise<number> {
    const systemUserId = connection.systemUserId();

    const result = await connection.sql(SQL`
      INSERT INTO submission_feature (
        submission_id,
        submission_upload_id,
        feature_type_id,
        parent_submission_feature_id,
        data,
        data_byte_size,
        record_effective_date,
        record_end_date,
        create_user
      )
      VALUES (
        ${params.submissionId},
        ${params.submissionUploadId}::uuid,
        (SELECT feature_type_id FROM feature_type WHERE name = ${params.featureTypeName} LIMIT 1),
        ${params.parentFeatureId ?? null},
        '{}'::jsonb,
        500,
        now(),
        ${params.recordEndDate ? 'now()' : null},
        ${systemUserId}
      )
      RETURNING submission_feature_id;
    `);

    return result.rows[0].submission_feature_id;
  }

  /**
   * Index a string `name` value on a feature so a predicate can find it as evidence.
   *
   * The evaluator JOINs feature_type_property and reads from submission_feature_property_string; both must
   * agree on the typed slot. `featureTypePropertyId` defaults to sample_site.name (45); pass 70 for
   * dataset.name. The slot here MUST match the one in the matching `namePredicate(...)`.
   */
  async function indexNameProperty(
    submissionFeatureId: number,
    value: string,
    featureTypePropertyId: number = SAMPLE_SITE_NAME_FTP_ID
  ): Promise<void> {
    const systemUserId = connection.systemUserId();
    await connection.sql(SQL`
      INSERT INTO submission_feature_property_string
        (submission_feature_id, feature_type_property_id, value, create_user)
      VALUES (${submissionFeatureId}, ${featureTypePropertyId}, ${value}, ${systemUserId});
    `);
  }

  /**
   * Insert a single content edge (submission_feature_feature) source -> target.
   *
   * Content edges are walked at read time (bidirectionally) and are NOT part of the closure, so this
   * helper drives the recursive-content-walk assertions. The table has a unique index on
   * (LEAST(source, target), GREATEST(source, target)), so only ONE direction per unordered pair may be
   * inserted — the evaluator makes the walk bidirectional regardless of stored direction.
   */
  async function insertContentEdge(sourceFeatureId: number, targetFeatureId: number): Promise<void> {
    const systemUserId = connection.systemUserId();
    await connection.sql(SQL`
      INSERT INTO submission_feature_feature (source_feature_id, target_feature_id, create_user)
      VALUES (${sourceFeatureId}, ${targetFeatureId}, ${systemUserId});
    `);
  }

  /**
   * Insert a property edge (submission_feature_property_feature) source -> referenced, using the supplied
   * feature_type_property_id (mint one via createFeatureTypeProperty on the source type). In the closure
   * this stores (source=feature, target=referenced): closureForward(feature) reaches the referenced
   * feature; closureReverse(referenced) reaches the referencing feature.
   */
  async function insertPropertyEdge(
    sourceFeatureId: number,
    referencedFeatureId: number,
    featureTypePropertyId: number
  ): Promise<void> {
    const systemUserId = connection.systemUserId();
    await connection.sql(SQL`
      INSERT INTO submission_feature_property_feature (
        submission_feature_id,
        feature_type_property_id,
        referenced_submission_feature_id,
        create_user
      )
      VALUES (${sourceFeatureId}, ${featureTypePropertyId}, ${referencedFeatureId}, ${systemUserId});
    `);
  }

  /** Apply security rule 1 to a feature so anonymous callers (and ungranted users) cannot read it. */
  async function secureFeature(submissionFeatureId: number): Promise<void> {
    const systemUserId = connection.systemUserId();
    await connection.sql(SQL`
      INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, create_user)
      VALUES (${submissionFeatureId}, 1, ${systemUserId});
    `);
  }

  /**
   * Grant the current API user read access to a SECURED feature by standing up the scope-grant chain the
   * security filter's Branch 2 walks: security_scope -> security_scope_anchor (on the feature) ->
   * team_security_scope -> team -> team_member (for connection.systemUserId()). Without this chain a
   * plain DATABASE-type API user is NOT effectively privileged over an arbitrary secured feature.
   */
  async function grantPrivilegedAccess(anchorSubmissionFeatureId: number): Promise<void> {
    const systemUserId = connection.systemUserId();

    const scope = await connection.sql(SQL`
      INSERT INTO security_scope (scope_hash)
      VALUES (${`test-scope-${anchorSubmissionFeatureId}`})
      RETURNING security_scope_id;
    `);
    const securityScopeId = scope.rows[0].security_scope_id;

    await connection.sql(SQL`
      INSERT INTO security_scope_anchor (security_scope_id, anchor_submission_feature_id)
      VALUES (${securityScopeId}, ${anchorSubmissionFeatureId});
    `);

    const team = await connection.sql(SQL`
      INSERT INTO team (name, description, create_user)
      VALUES (${`Privileged Test Team ${anchorSubmissionFeatureId}`}, 'integration', ${systemUserId})
      RETURNING team_id;
    `);
    const teamId = team.rows[0].team_id;

    await connection.sql(SQL`
      INSERT INTO team_security_scope (team_id, security_scope_id)
      VALUES (${teamId}, ${securityScopeId});
    `);

    await connection.sql(SQL`
      INSERT INTO team_member (system_user_id, team_id, create_user)
      VALUES (${systemUserId}, ${teamId}, ${systemUserId});
    `);
  }

  /**
   * Run an emitted Knex subquery and return the resulting SET of submission_feature_id values. Set
   * equality is what every reachability test asserts on; ordering is irrelevant. NOTE: a Set hides
   * duplicates — use runCount for the UNION-dedup assertion.
   */
  async function runSubquery(subquery: any): Promise<Set<number>> {
    const { sql, bindings } = subquery.toSQL().toNative();
    const result = await connection.query<{ submission_feature_id: number }>(sql, bindings as any[]);
    return new Set(result.rows.map((r) => r.submission_feature_id));
  }

  /**
   * Count the rows the emitted subquery returns by wrapping it as a derived table. Needed where a Set
   * would collapse duplicates — the evaluator UNIONs (not UNION ALL) its reachability sources, so a
   * feature reachable by more than one path must surface exactly once.
   */
  async function runCount(subquery: any): Promise<number> {
    const { sql, bindings } = subquery.toSQL().toNative();
    const result = await connection.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM (${sql}) t`,
      bindings as any[]
    );
    return result.rows[0].count;
  }

  /** Mint a real feature_type_property usable as a property-edge label, from source type to target type. */
  async function mintPropertyEdgeLabel(sourceFeatureType: string, targetFeatureType: string): Promise<number> {
    const { featureTypePropertyId } = await createFeatureTypeProperty(connection, sourceFeatureType, targetFeatureType);
    return featureTypePropertyId;
  }

  // === broad feature-type projection (no closure needed) ===================

  describe('buildBroadFeatureTypeSubquery', () => {
    it('returns every active submission_feature of the given type for an authenticated user', async () => {
      const submissionId = await createTestSubmission(connection);
      const a = await createTestFeature(connection, submissionId, 'sample_site', { name: 'A' });
      const b = await createTestFeature(connection, submissionId, 'sample_site', { name: 'B' });
      // Decoy of a different feature type — must not appear.
      const decoy = await createTestFeature(connection, submissionId, 'capture', { comment: 'cap' });

      const subquery = buildBroadFeatureTypeSubquery('sample_site', connection.systemUserId());
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
      // The broad subquery's security filter resolves "is this feature secured" via the closure
      // (isEffectivelySecuredViaClosure), so the secured `restricted` feature only reads as secured
      // once its closure self-loop exists. Seed it under a shared upload and rebuild the closure
      // BEFORE the subquery; otherwise an empty closure reads it as unsecured and it is NOT stripped.
      const submissionAccessible = await createTestSubmission(connection);
      const uploadAccessible = await createTestUpload(connection, submissionAccessible);
      const accessible = await insertFeatureRow({
        submissionId: submissionAccessible,
        submissionUploadId: uploadAccessible,
        featureTypeName: 'sample_site'
      });

      const submissionRestricted = await createTestSubmission(connection);
      const uploadRestricted = await createTestUpload(connection, submissionRestricted);
      const restricted = await insertFeatureRow({
        submissionId: submissionRestricted,
        submissionUploadId: uploadRestricted,
        featureTypeName: 'capture'
      });

      // Apply a security rule. With systemUserId=null (anonymous), the security filter
      // strips any secured feature — the same mechanism that strips features from a
      // statement whose policy creator lacks the matching team grant.
      await secureFeature(restricted);

      const closure = new SubmissionFeatureClosureService(connection);
      await closure.computeClosureForUpload(uploadAccessible);
      await closure.computeClosureForUpload(uploadRestricted);

      // Per-statement subquery for the type the user CAN see → returns the row.
      const accessibleIds = await runSubquery(buildBroadFeatureTypeSubquery('sample_site', null));
      expect(accessibleIds.has(accessible)).to.equal(true);

      // Per-statement subquery for the type the user CAN'T see → returns nothing
      // and crucially does not throw. At pipeline level this is what produces an
      // empty Parquet file rather than a failed download.
      const restrictedIds = await runSubquery(buildBroadFeatureTypeSubquery('capture', null));
      expect(restrictedIds.has(restricted)).to.equal(false);
      expect(restrictedIds.size).to.equal(0);
    });
  });

  // === self-match: evidence ∈ content_reach guards the set-op combinator and evidence security =========

  describe('buildExpressionTreeFeatureIdsSubquery — self-match (evidence ∈ content_reach)', () => {
    it('AND tree returns only features matching every predicate', async () => {
      // Self-match: anchor type == evidence type, so the result is the evidence itself (content_reach
      // always contains the evidence) with no closure or content edges needed. Isolated submissions keep
      // the target and decoy from sharing any reach.
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

      const subquery = buildExpressionTreeFeatureIdsSubquery('sample_site', tree, connection.systemUserId());
      const ids = await runSubquery(subquery);

      expect(ids.has(target)).to.equal(true);
      expect(ids.has(other)).to.equal(false);
    });

    it('OR tree returns the union of predicate matches', async () => {
      // Self-match OR: the UNION combinator over two predicate branches; each candidate is its own
      // evidence in content_reach. Each in its own submission to keep reach narrow.
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

      const subquery = buildExpressionTreeFeatureIdsSubquery('sample_site', tree, connection.systemUserId());
      const ids = await runSubquery(subquery);

      expect(ids.has(a)).to.equal(true);
      expect(ids.has(b)).to.equal(true);
      expect(ids.has(decoy)).to.equal(false);
    });

    it('security filter excludes features the user cannot read', async () => {
      // Evidence-side security: a secured candidate is dropped before projection, so it never reaches
      // the result even as its own self-match. The drop is driven by the closure-based security filter
      // (isEffectivelySecuredViaClosure), so each feature is seeded under its OWN upload and its closure
      // self-loop is rebuilt BEFORE the subquery — without the self-loop the secured feature reads as
      // unsecured and would NOT be stripped. Separate uploads keep the OR-tree reach narrow (each
      // feature only self-matches; no shared upload means no incidental closure relatedness between them).
      const submissionOpen = await createTestSubmission(connection);
      const uploadOpen = await createTestUpload(connection, submissionOpen);
      const open = await insertFeatureRow({
        submissionId: submissionOpen,
        submissionUploadId: uploadOpen,
        featureTypeName: 'sample_site'
      });
      await indexNameProperty(open, 'Open-secfilter');

      const submissionSecured = await createTestSubmission(connection);
      const uploadSecured = await createTestUpload(connection, submissionSecured);
      const secured = await insertFeatureRow({
        submissionId: submissionSecured,
        submissionUploadId: uploadSecured,
        featureTypeName: 'sample_site'
      });
      await indexNameProperty(secured, 'Secured-secfilter');

      await secureFeature(secured);

      const closure = new SubmissionFeatureClosureService(connection);
      await closure.computeClosureForUpload(uploadOpen);
      await closure.computeClosureForUpload(uploadSecured);

      const tree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'OR',
        clauses: [namePredicate('Open-secfilter'), namePredicate('Secured-secfilter')]
      };
      const subquery = buildExpressionTreeFeatureIdsSubquery('sample_site', tree, null);
      const ids = await runSubquery(subquery);

      expect(ids.has(open)).to.equal(true);
      expect(ids.has(secured)).to.equal(false);
    });
  });

  // === closure + recursive content-walk reachability =====================================

  describe('buildExpressionTreeFeatureIdsSubquery — closure + content-walk reachability', () => {
    /**
     * Descendant reach (load-bearing reverse closure probe). D(dataset) ← A(animal) ← C(capture) under one
     * upload; evidence = D (dataset.name). content_reach = {D}; closureReverse(D) = D's descendants = {A, C}.
     * Anchor=capture isolates C. A FORWARD-ONLY probe would return EMPTY here — descendant reach exists only
     * because the closure is probed in BOTH directions.
     */
    it('1: descendant reach — anchor below evidence is recovered via closureReverse', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);

      const d = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'dataset' });
      const a = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'animal',
        parentFeatureId: d
      });
      const c = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'capture',
        parentFeatureId: a
      });
      await indexNameProperty(d, 'Caribou Study', DATASET_NAME_FTP_ID);

      await new SubmissionFeatureClosureService(connection).computeClosureForUpload(uploadId);

      const tree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [namePredicate('Caribou Study', DATASET_NAME_FTP_ID)]
      };
      const ids = await runSubquery(buildExpressionTreeFeatureIdsSubquery('capture', tree, connection.systemUserId()));

      expect(ids.has(c)).to.equal(true);
    });

    /**
     * Ancestor reach (forward closure probe). D(dataset) ← S(sample_site) under one upload; evidence = S.
     * content_reach = {S}; closureForward(S) = S's ancestors = {D}. Anchor=dataset isolates D.
     */
    it('2: ancestor reach — anchor above evidence is recovered via closureForward', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);

      const d = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'dataset' });
      const s = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'sample_site',
        parentFeatureId: d
      });
      await indexNameProperty(s, 'leaf', SAMPLE_SITE_NAME_FTP_ID);

      await new SubmissionFeatureClosureService(connection).computeClosureForUpload(uploadId);

      const tree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [namePredicate('leaf', SAMPLE_SITE_NAME_FTP_ID)]
      };
      const ids = await runSubquery(buildExpressionTreeFeatureIdsSubquery('dataset', tree, connection.systemUserId()));

      expect(ids.has(d)).to.equal(true);
    });

    /**
     * Property-reference reach in BOTH directions. F(sample_site) → G(animal) via a property edge, NO parent
     * link. Forward: evidence=F, closureForward(F)→G, anchor=animal returns G (the referenced feature).
     * Reverse: evidence=G, closureReverse(G)→F, anchor=sample_site returns F (the referencing feature).
     */
    it('3: property-reference reach — referenced (forward) and referencing (reverse) both recovered', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);

      const f = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'sample_site' });
      const g = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'animal' });
      const label = await mintPropertyEdgeLabel('sample_site', 'animal');
      await insertPropertyEdge(f, g, label);
      await indexNameProperty(f, 'ref', SAMPLE_SITE_NAME_FTP_ID);
      // Index G with an animal-agnostic value reusing the sample_site slot only for evidence selection in
      // the reverse sub-case; the predicate is type-agnostic and only needs a matching string row.
      await indexNameProperty(g, 'ref-reverse', SAMPLE_SITE_NAME_FTP_ID);

      await new SubmissionFeatureClosureService(connection).computeClosureForUpload(uploadId);

      // (a) forward: filter F (referencing) -> anchor animal returns G (referenced).
      const forwardTree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [namePredicate('ref', SAMPLE_SITE_NAME_FTP_ID)]
      };
      const forwardIds = await runSubquery(
        buildExpressionTreeFeatureIdsSubquery('animal', forwardTree, connection.systemUserId())
      );
      expect(forwardIds.has(g)).to.equal(true);

      // (b) reverse: filter G (referenced) -> anchor sample_site returns F (referencing).
      const reverseTree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [namePredicate('ref-reverse', SAMPLE_SITE_NAME_FTP_ID)]
      };
      const reverseIds = await runSubquery(
        buildExpressionTreeFeatureIdsSubquery('sample_site', reverseTree, connection.systemUserId())
      );
      expect(reverseIds.has(f)).to.equal(true);
    });

    /**
     * Defense-in-depth: the security filter is re-applied to PROJECTED targets, not just evidence. evidence
     * (sample_site, unsecured) and securedTarget (sample_site, parent=evidence) share one upload, so the
     * closure connects them (parent edge securedTarget→evidence ⇒ closureReverse(evidence) reaches it). With
     * systemUserId=null the secured target must NOT leak; with a privileged user (scope-granted) it appears.
     */
    it('4: secured projected target is filtered for anonymous and visible to a granted user', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);

      const evidence = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'sample_site'
      });
      const securedTarget = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'sample_site',
        parentFeatureId: evidence
      });
      await indexNameProperty(evidence, 'evidence-row', SAMPLE_SITE_NAME_FTP_ID);
      await secureFeature(securedTarget);

      await new SubmissionFeatureClosureService(connection).computeClosureForUpload(uploadId);

      const tree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [namePredicate('evidence-row', SAMPLE_SITE_NAME_FTP_ID)]
      };

      // Anonymous: evidence (unsecured) is kept; the secured descendant must not leak.
      const anonymousIds = await runSubquery(buildExpressionTreeFeatureIdsSubquery('sample_site', tree, null));
      expect(anonymousIds.has(evidence)).to.equal(true);
      expect(anonymousIds.has(securedTarget)).to.equal(false);

      // Granted: stand up the scope-grant chain on the secured target, then the privileged user sees it.
      await grantPrivilegedAccess(securedTarget);
      const grantedIds = await runSubquery(
        buildExpressionTreeFeatureIdsSubquery('sample_site', tree, connection.systemUserId())
      );
      expect(grantedIds.has(securedTarget)).to.equal(true);
    });

    /**
     * Reflexive reach. A single feature E(sample_site) with an empty closure and no content edges still
     * returns itself, because content_reach is seeded from the evidence and always contains it.
     */
    it('5: reflexive — evidence returns itself with empty closure and no edges', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);

      const e = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'sample_site' });
      await indexNameProperty(e, 'self', SAMPLE_SITE_NAME_FTP_ID);

      await new SubmissionFeatureClosureService(connection).computeClosureForUpload(uploadId);

      const tree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [namePredicate('self', SAMPLE_SITE_NAME_FTP_ID)]
      };
      const ids = await runSubquery(
        buildExpressionTreeFeatureIdsSubquery('sample_site', tree, connection.systemUserId())
      );

      expect(ids.has(e)).to.equal(true);
    });

    /**
     * UNION dedup. F is reachable from evidence E both as a referenced feature (closureForward, via a
     * property edge E→F) AND as a descendant (closureReverse, via parent F→E). UNION (not UNION ALL) must
     * collapse the two paths so F appears EXACTLY ONCE — a downstream count(*) wrap must not double-count.
     */
    it('6: UNION dedup — a multi-path target appears exactly once', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);

      const e = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'sample_site' });
      // F is BOTH a descendant of E (parent edge F->E) and a referenced feature of E (property edge E->F).
      const f = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'animal',
        parentFeatureId: e
      });
      const label = await mintPropertyEdgeLabel('sample_site', 'animal');
      await insertPropertyEdge(e, f, label);
      await indexNameProperty(e, 'dedup', SAMPLE_SITE_NAME_FTP_ID);

      await new SubmissionFeatureClosureService(connection).computeClosureForUpload(uploadId);

      const tree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [namePredicate('dedup', SAMPLE_SITE_NAME_FTP_ID)]
      };
      const subquery = buildExpressionTreeFeatureIdsSubquery('animal', tree, connection.systemUserId());

      expect(await runCount(subquery)).to.equal(1);
      expect((await runSubquery(subquery)).has(f)).to.equal(true);
    });

    /**
     * Content-only reach is preserved (no closure path). F(sample_site) ─content→ G(telemetry); G2(telemetry)
     * has NO edge. The closure adds only self loops, so G is reached purely by the content walk; G2 (the
     * control) proves it is the content edge doing the work, not incidental same-upload reach.
     */
    it('7: content-only — content neighbour reached, unconnected same-type decoy not', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);

      const f = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'sample_site' });
      const g = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'telemetry' });
      const g2 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'telemetry' });
      await insertContentEdge(f, g);
      await indexNameProperty(f, 'c', SAMPLE_SITE_NAME_FTP_ID);

      await new SubmissionFeatureClosureService(connection).computeClosureForUpload(uploadId);

      const tree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [namePredicate('c', SAMPLE_SITE_NAME_FTP_ID)]
      };
      const ids = await runSubquery(
        buildExpressionTreeFeatureIdsSubquery('telemetry', tree, connection.systemUserId())
      );

      expect(ids.has(g)).to.equal(true);
      expect(ids.has(g2)).to.equal(false);
    });

    /**
     * Dataset membership fan-out is restored. D(dataset) with a real descendant Y(animal, parent=D) and an
     * UNCONNECTED same-submission X(animal, no parent). Evidence=D reaches Y via closureReverse AND reaches X
     * via the restored dataset→every-feature-in-submission membership edge.
     */
    it('8: dataset evidence reaches descendants and unconnected same-submission features via membership', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);

      const d = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'dataset' });
      const y = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'animal',
        parentFeatureId: d
      });
      const x = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'animal' });
      await indexNameProperty(d, 'ds', DATASET_NAME_FTP_ID);

      await new SubmissionFeatureClosureService(connection).computeClosureForUpload(uploadId);

      const tree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [namePredicate('ds', DATASET_NAME_FTP_ID)]
      };
      const ids = await runSubquery(buildExpressionTreeFeatureIdsSubquery('animal', tree, connection.systemUserId()));

      expect(ids.has(y)).to.equal(true);
      expect(ids.has(x)).to.equal(true);
    });

    /**
     * Empty-closure behaviour, two halves. (a) Without computeClosureForUpload, closure ancestor reach is
     * empty: A(sample_site) ← E(sample_site), evidence=E, anchor=sample_site → A ABSENT (the closure is what
     * carries ancestor reach). A NON-dataset ancestor is used deliberately — the dataset membership edge is
     * closure-independent, so a dataset ancestor would be reachable here and mask the closure dependence.
     * (b) The content walk works WITHOUT a closure: E2(sample_site) ─content→ M(animal), evidence=E2,
     * anchor=animal → M PRESENT. Distinct uploads keep the halves clean.
     */
    it('9: empty closure — closure ancestor reach absent, content reach still works', async () => {
      const submissionId = await createTestSubmission(connection);

      // (a) closure ancestor reach needs the closure — do NOT rebuild it. NON-dataset ancestor so the dataset
      // membership edge (closure-independent) can't mask the closure dependence.
      const uploadA = await createTestUpload(connection, submissionId);
      const ancestorSite = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadA,
        featureTypeName: 'sample_site'
      });
      const e = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadA,
        featureTypeName: 'sample_site',
        parentFeatureId: ancestorSite
      });
      await indexNameProperty(e, 'no-closure-ancestor', SAMPLE_SITE_NAME_FTP_ID);

      const ancestorTree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [namePredicate('no-closure-ancestor', SAMPLE_SITE_NAME_FTP_ID)]
      };
      const ancestorIds = await runSubquery(
        buildExpressionTreeFeatureIdsSubquery('sample_site', ancestorTree, connection.systemUserId())
      );
      expect(ancestorIds.has(ancestorSite)).to.equal(false);

      // (b) content reach does NOT need the closure — also do NOT rebuild it.
      const uploadB = await createTestUpload(connection, submissionId);
      const e2 = await insertFeatureRow({ submissionId, submissionUploadId: uploadB, featureTypeName: 'sample_site' });
      const m = await insertFeatureRow({ submissionId, submissionUploadId: uploadB, featureTypeName: 'animal' });
      await insertContentEdge(e2, m);
      await indexNameProperty(e2, 'no-closure-content', SAMPLE_SITE_NAME_FTP_ID);

      const contentTree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [namePredicate('no-closure-content', SAMPLE_SITE_NAME_FTP_ID)]
      };
      const contentIds = await runSubquery(
        buildExpressionTreeFeatureIdsSubquery('animal', contentTree, connection.systemUserId())
      );
      expect(contentIds.has(m)).to.equal(true);
    });

    /**
     * AND/OR compose over closure-related features. Two datasets in separate SUBMISSIONS each have a child
     * sample_site: D1 ← S1, D2 ← S2. Separate submissions (not just uploads) so the dataset membership edge —
     * which keys on submission_id — cannot cross-link them. An OR of [D1.name, D2.name] anchored at sample_site
     * UNIONs the two descendant reaches (S1 and S2). An AND INTERSECTs them — no sample_site is a descendant of
     * both datasets, so the intersection is empty. The raw combinator is already pinned by the self-match AND/OR
     * tests; this guards that it composes correctly when leaves resolve THROUGH closure relatedness.
     */
    it('10: AND/OR compose over closure-related features (union widens, intersect narrows)', async () => {
      const submissionOne = await createTestSubmission(connection);
      const uploadOne = await createTestUpload(connection, submissionOne);
      const d1 = await insertFeatureRow({
        submissionId: submissionOne,
        submissionUploadId: uploadOne,
        featureTypeName: 'dataset'
      });
      const s1 = await insertFeatureRow({
        submissionId: submissionOne,
        submissionUploadId: uploadOne,
        featureTypeName: 'sample_site',
        parentFeatureId: d1
      });
      await indexNameProperty(d1, 'compose-d1', DATASET_NAME_FTP_ID);

      const submissionTwo = await createTestSubmission(connection);
      const uploadTwo = await createTestUpload(connection, submissionTwo);
      const d2 = await insertFeatureRow({
        submissionId: submissionTwo,
        submissionUploadId: uploadTwo,
        featureTypeName: 'dataset'
      });
      const s2 = await insertFeatureRow({
        submissionId: submissionTwo,
        submissionUploadId: uploadTwo,
        featureTypeName: 'sample_site',
        parentFeatureId: d2
      });
      await indexNameProperty(d2, 'compose-d2', DATASET_NAME_FTP_ID);

      const closure = new SubmissionFeatureClosureService(connection);
      await closure.computeClosureForUpload(uploadOne);
      await closure.computeClosureForUpload(uploadTwo);

      const orTree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'OR',
        clauses: [namePredicate('compose-d1', DATASET_NAME_FTP_ID), namePredicate('compose-d2', DATASET_NAME_FTP_ID)]
      };
      const orIds = await runSubquery(
        buildExpressionTreeFeatureIdsSubquery('sample_site', orTree, connection.systemUserId())
      );
      expect(orIds.has(s1)).to.equal(true);
      expect(orIds.has(s2)).to.equal(true);

      const andTree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [namePredicate('compose-d1', DATASET_NAME_FTP_ID), namePredicate('compose-d2', DATASET_NAME_FTP_ID)]
      };
      const andIds = await runSubquery(
        buildExpressionTreeFeatureIdsSubquery('sample_site', andTree, connection.systemUserId())
      );
      // No sample_site descends from BOTH datasets, so the intersection of the two reaches is empty.
      expect(andIds.has(s1)).to.equal(false);
      expect(andIds.has(s2)).to.equal(false);
    });

    /**
     * Cross-type anchor filter. D(dataset) ← A(animal) ← C(capture) under one upload; evidence=D reaches
     * {A, C} via closureReverse plus D itself. Anchor=animal returns ONLY A — not C (capture), not D
     * (dataset). The anchor type is the sole result filter over the reachable set.
     */
    it('11: anchor type filters the reachable set to one type', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);

      const d = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'dataset' });
      const a = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'animal',
        parentFeatureId: d
      });
      const c = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'capture',
        parentFeatureId: a
      });
      await indexNameProperty(d, 'cross-type', DATASET_NAME_FTP_ID);

      await new SubmissionFeatureClosureService(connection).computeClosureForUpload(uploadId);

      const tree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [namePredicate('cross-type', DATASET_NAME_FTP_ID)]
      };
      const ids = await runSubquery(buildExpressionTreeFeatureIdsSubquery('animal', tree, connection.systemUserId()));

      expect(ids.has(a)).to.equal(true);
      expect(ids.has(c)).to.equal(false);
      expect(ids.has(d)).to.equal(false);
    });

    /**
     * Multi-hop content chain (CRITICAL). Content edges A→B and B→C only (no A→C). Evidence=A; the recursive
     * walk reaches C across TWO content hops (A→B→C). Anchor=telemetry returns C and not the unconnected
     * decoy. This result would be EMPTY under a one-hop probe — that is the point of the recursive walk.
     */
    it('12: multi-hop content chain — target reached across two content hops', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);

      const a = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'sample_site' });
      const b = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'animal' });
      const c = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'telemetry' });
      const cDecoy = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'telemetry'
      });
      await insertContentEdge(a, b);
      await insertContentEdge(b, c);
      await indexNameProperty(a, 'chain', SAMPLE_SITE_NAME_FTP_ID);

      await new SubmissionFeatureClosureService(connection).computeClosureForUpload(uploadId);

      const tree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [namePredicate('chain', SAMPLE_SITE_NAME_FTP_ID)]
      };
      const ids = await runSubquery(
        buildExpressionTreeFeatureIdsSubquery('telemetry', tree, connection.systemUserId())
      );

      expect(ids.has(c)).to.equal(true);
      expect(ids.has(cDecoy)).to.equal(false);
    });

    /**
     * content→closure chain. E ─content→ M, and M's parent is P (closure: M→P ancestor). Evidence=E;
     * content_reach={E, M}; closureForward(M)→P. Anchor=capture returns P (and not the unconnected Pdecoy):
     * a content neighbour contributes ITS closure ancestors because the closure is probed from content_reach.
     */
    it('13: content→closure chain — content neighbour contributes its closure ancestor', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);

      const e = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'sample_site' });
      const p = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'capture' });
      const m = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'animal',
        parentFeatureId: p
      });
      const pDecoy = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'capture'
      });
      await insertContentEdge(e, m);
      await indexNameProperty(e, 'cc', SAMPLE_SITE_NAME_FTP_ID);

      await new SubmissionFeatureClosureService(connection).computeClosureForUpload(uploadId);

      const tree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [namePredicate('cc', SAMPLE_SITE_NAME_FTP_ID)]
      };
      const ids = await runSubquery(buildExpressionTreeFeatureIdsSubquery('capture', tree, connection.systemUserId()));

      expect(ids.has(p)).to.equal(true);
      expect(ids.has(pDecoy)).to.equal(false);
    });

    /**
     * ACCEPTED INTENTIONAL GAP (negative). A(capture) is rootless; E(sample_site, parent=A) so the closure
     * gives E→A ancestor. A ─content→ Q (NOT E→Q). Evidence=E; content_reach={E} (E has no content edge).
     * closureForward(E)→A, but A is reached via the CLOSURE, not content_reach, so A's content neighbour Q is
     * never walked — the walk seeds only from evidence, not from closure results. Q must be ABSENT. This is a
     * deliberate one-way design choice (closure-then-content is not recovered), not a bug.
     */
    it('14: accepted gap — closure-ancestor then ITS content edge is not recovered', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);

      const a = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'capture' });
      const e = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'sample_site',
        parentFeatureId: a
      });
      const q = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'telemetry' });
      await insertContentEdge(a, q);
      await indexNameProperty(e, 'gap', SAMPLE_SITE_NAME_FTP_ID);

      await new SubmissionFeatureClosureService(connection).computeClosureForUpload(uploadId);

      const tree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [namePredicate('gap', SAMPLE_SITE_NAME_FTP_ID)]
      };
      const ids = await runSubquery(
        buildExpressionTreeFeatureIdsSubquery('telemetry', tree, connection.systemUserId())
      );

      expect(ids.has(q)).to.equal(false);
    });

    /**
     * Depth cap = MAX_SEARCH_GRAPH_DEPTH (6). A linear content chain n1→…→n8 (7 edges). n1 is depth 0; the
     * deepest reachable node is 6 edges from the seed (depth 6 included, depth 7 excluded). n7 (animal) sits
     * at depth 6 and is reachable; n8 (telemetry) sits at depth 7 and is truncated. n1..n6 are sample_site so
     * the animal/telemetry anchors isolate n7 and n8.
     */
    it('15: depth cap — node at depth 6 reachable, node at depth 7 truncated', async () => {
      expect(MAX_SEARCH_GRAPH_DEPTH).to.equal(6);

      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);

      const nodes: number[] = [];
      for (let i = 0; i < 8; i++) {
        const featureTypeName = i < 6 ? 'sample_site' : i === 6 ? 'animal' : 'telemetry';
        nodes.push(await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName }));
      }
      for (let i = 0; i < nodes.length - 1; i++) {
        await insertContentEdge(nodes[i], nodes[i + 1]);
      }
      await indexNameProperty(nodes[0], 'depth', SAMPLE_SITE_NAME_FTP_ID);

      await new SubmissionFeatureClosureService(connection).computeClosureForUpload(uploadId);

      const tree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [namePredicate('depth', SAMPLE_SITE_NAME_FTP_ID)]
      };

      // n7 (index 6) is depth 6 — exactly at the cap — so it is reachable.
      const animalIds = await runSubquery(
        buildExpressionTreeFeatureIdsSubquery('animal', tree, connection.systemUserId())
      );
      expect(animalIds.has(nodes[6])).to.equal(true);

      // n8 (index 7) is depth 7 — one past the cap — so it is truncated.
      const telemetryIds = await runSubquery(
        buildExpressionTreeFeatureIdsSubquery('telemetry', tree, connection.systemUserId())
      );
      expect(telemetryIds.has(nodes[7])).to.equal(false);
    });
  });
});
