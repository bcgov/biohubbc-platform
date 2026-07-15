// Service-level integration tests for the derived submission-feature reachability closure.
//
// Drives SubmissionFeatureClosureService.computeClosureForUpload(submissionUploadId) against a real
// database and asserts on the rows the recompute writes into submission_feature_closure. The
// closure is the "evidence" reach used by search: reachability over the UNION of two edge kinds —
// parent (submission_feature.parent_*) and property (submission_feature_property_feature) — plus a
// self row for every active feature in the upload. Content edges (submission_feature_feature) are
// intentionally EXCLUDED from the reach: content is the parent tree reversed, so closing over
// parent + content yields the complete same-upload digraph (O(N^2)); the down/descendant direction
// is recovered via the reverse (target, source) index instead. The recursive CTE composes parent and
// property edges and uses UNION (not UNION ALL) so cycles terminate and multi-path pairs collapse to
// one row. Each row also carries is_ancestor: true for pure parent-ancestry pairs (the authorization
// reach), false for pairs reachable only via a property edge. Search reads all rows; auth reads
// WHERE is_ancestor.
//
// Each test seeds its own upload-scoped fixture and rolls back after, so nothing is persisted.
//
// SCOPING NOTE: the local database already holds pre-existing submission_feature_closure rows from
// other data, so a bare count(*) on the table is meaningless. Every row-set assertion is scoped to
// the test's own fixture feature ids (source AND target IN <fixtureIds>); the upload-scoped
// insertedCount returned by the service is the reliable total.
//
// Run: docker compose exec api npm run test:mocha -- --no-config --extension ts \
//        'src/__integration__/db/submission-feature-closure-service.integration.ts'
// Requires: database container running with seed data.

import { expect } from 'chai';
import { describe } from 'mocha';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import { createFeatureTypeProperty, createTestUpload } from '../helpers/test-feature-property-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

/**
 * Normalize an unordered set of [source, target] pairs to "source-target" strings, sorted numerically by
 * source then target to match the SQL `ORDER BY source_submission_feature_id, target_submission_feature_id`
 * used by getScopedClosurePairs. A default string sort would diverge once ids cross a digit boundary.
 */
function expectedPairs(pairs: [number, number][]): string[] {
  return [...pairs]
    .sort(([source1, target1], [source2, target2]) => source1 - source2 || target1 - target2)
    .map(([source, target]) => `${source}-${target}`);
}

describe('SubmissionFeatureClosureService — closure recompute (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let service: SubmissionFeatureClosureService;

  before(() => initDBPool(defaultPoolConfig));

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new SubmissionFeatureClosureService(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  // --- local fixture helpers -----------------------------------------------

  /**
   * Insert one submission_feature bound to a SPECIFIC upload, returning its submission_feature_id.
   *
   * The closure recompute is upload-scoped and only walks edges whose BOTH endpoints are active
   * features of the same upload, so a parent + its children must share one submission_upload_id.
   * createTestFeature / createTestFeaturesInBulk each mint their OWN upload internally and cannot
   * place a parent and child under one upload, so the closure suite inserts features directly.
   *
   * Feature type is irrelevant to closure semantics (the function never reads it), so any seeded
   * type id satisfies the NOT NULL FK. `record_end_date` (a date) marks a feature inactive: an
   * inactive feature is excluded from the active-feature universe, so it never appears in any
   * closure row and any edge touching it is dropped.
   *
   * @returns The new submission_feature_id.
   */
  async function insertFeatureRow(params: {
    submissionId: number;
    submissionUploadId: string;
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
        (SELECT feature_type_id FROM feature_type LIMIT 1),
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
   * Insert a content edge (submission_feature_feature) source -> target.
   *
   * Content edges are intentionally EXCLUDED from the closure reach (see file header), so this helper
   * exists to verify that exclusion: inserting a content edge must NOT create a closure pair. The
   * table carries a unique index on (LEAST(source, target), GREATEST(source, target)), so the REVERSE
   * of an already-inserted pair cannot also be inserted as a content edge.
   */
  async function insertContentEdge(sourceFeatureId: number, targetFeatureId: number): Promise<void> {
    const systemUserId = connection.systemUserId();
    await connection.sql(SQL`
      INSERT INTO submission_feature_feature (source_feature_id, target_feature_id, create_user)
      VALUES (${sourceFeatureId}, ${targetFeatureId}, ${systemUserId});
    `);
  }

  /**
   * Insert a property edge (submission_feature_property_feature) source -> referenced, using the
   * supplied feature_type_property_id (which must reference a real feature_type_property row).
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
        blueprint_feature_type_property_id,
        referenced_submission_feature_id,
        create_user
      )
      SELECT
        ${sourceFeatureId},
        ${featureTypePropertyId},
        bftp.blueprint_feature_type_property_id,
        ${referencedFeatureId},
        ${systemUserId}
      FROM submission_feature sf
      JOIN submission_upload su ON su.submission_upload_id = sf.submission_upload_id
      JOIN blueprint_feature_type bft
        ON bft.blueprint_id = su.blueprint_id AND bft.record_end_date IS NULL
      JOIN blueprint_feature_type_property bftp
        ON bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id
       AND bftp.feature_type_property_id = ${featureTypePropertyId}
       AND bftp.record_end_date IS NULL
      WHERE sf.submission_feature_id = ${sourceFeatureId};
    `);
  }

  /**
   * Read the closure rows whose source AND target are both within the given fixture feature ids,
   * returned as sorted "source-target" strings. Scoping to fixture ids is mandatory: the table holds
   * unrelated pre-existing rows, so an unscoped read would be non-deterministic.
   */
  async function getScopedClosurePairs(featureIds: number[]): Promise<string[]> {
    const result = await connection.sql(SQL`
      SELECT source_submission_feature_id AS source, target_submission_feature_id AS target
      FROM submission_feature_closure
      WHERE source_submission_feature_id = ANY(${featureIds})
        AND target_submission_feature_id = ANY(${featureIds})
      ORDER BY source_submission_feature_id, target_submission_feature_id;
    `);
    return result.rows.map((row) => `${row.source}-${row.target}`);
  }

  /** Read the is_ancestor flag for a single (source, target) pair (null if the pair is absent). */
  async function getIsAncestor(source: number, target: number): Promise<boolean | null> {
    const result = await connection.sql(SQL`
      SELECT is_ancestor
      FROM submission_feature_closure
      WHERE source_submission_feature_id = ${source}
        AND target_submission_feature_id = ${target};
    `);
    return result.rows[0]?.is_ancestor ?? null;
  }

  /** Mint a real feature_type_property id usable as a property-edge label (the value is irrelevant to closure). */
  async function createPropertyEdgeLabel(): Promise<number> {
    const { featureTypePropertyId } = await createFeatureTypeProperty(connection, 'mortality', 'observation_subcount');
    return featureTypePropertyId;
  }

  // --- scenarios -----------------------------------------------------------

  // Worked example: composition across parent + property edges. F1 root; F2/F3 parent=F1; F4 parent=F3;
  // property edge F2->F3; plus a content edge F2->F4 that the closure must IGNORE. Verifies self rows
  // for every active feature, the direct parent/property edges, the transitive pair F4->F1 (F4->F3
  // composed with F3->F1), and that the content edge F2->F4 contributes no pair. Guards the recursive
  // `closure JOIN direct_edges ON d.source = c.target` composition and the content exclusion.
  it('1: worked example — 9 rows (4 self + 5 directed pairs; content edge ignored)', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);
    const propertyLabelId = await createPropertyEdgeLabel();

    const f1 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId });
    const f2 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, parentFeatureId: f1 });
    const f3 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, parentFeatureId: f1 });
    const f4 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, parentFeatureId: f3 });
    await insertContentEdge(f2, f4);
    await insertPropertyEdge(f2, f3, propertyLabelId);

    const { insertedCount } = await service.computeClosureForUpload(uploadId);

    expect(insertedCount).to.equal(9);
    expect(await getScopedClosurePairs([f1, f2, f3, f4])).to.deep.equal(
      expectedPairs([
        [f1, f1],
        [f2, f2],
        [f3, f3],
        [f4, f4],
        [f2, f1],
        [f3, f1],
        [f4, f3],
        [f2, f3],
        [f4, f1]
      ])
    );
  });

  // Idempotency: the recompute is DELETE-then-INSERT scoped to the upload, so a second run reproduces
  // the same rows rather than duplicating or accumulating them. Guards the leading DELETE.
  it('2: idempotent rerun — identical insertedCount and identical scoped row set', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);

    const f1 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId });
    const f2 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, parentFeatureId: f1 });

    const first = await service.computeClosureForUpload(uploadId);
    const firstPairs = await getScopedClosurePairs([f1, f2]);

    const second = await service.computeClosureForUpload(uploadId);
    const secondPairs = await getScopedClosurePairs([f1, f2]);

    expect(second.insertedCount).to.equal(first.insertedCount);
    expect(secondPairs).to.deep.equal(firstPairs);
  });

  // Cycle dedupe: property edges A->B, B->C, C->A form a 3-cycle (the property edge graph is not
  // cycle-prevented at the schema level). Reachability over a 3-cycle is every ordered pair, so the
  // result is 3 self + 6 directed = 9 rows, each appearing exactly once. Guards UNION (not UNION ALL)
  // terminating the recursion instead of looping forever.
  it('3: 3-cycle dedupe — 9 rows, no pair repeated', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);
    const propertyLabelId = await createPropertyEdgeLabel();

    const a = await insertFeatureRow({ submissionId, submissionUploadId: uploadId });
    const b = await insertFeatureRow({ submissionId, submissionUploadId: uploadId });
    const c = await insertFeatureRow({ submissionId, submissionUploadId: uploadId });
    await insertPropertyEdge(a, b, propertyLabelId);
    await insertPropertyEdge(b, c, propertyLabelId);
    await insertPropertyEdge(c, a, propertyLabelId);

    const { insertedCount } = await service.computeClosureForUpload(uploadId);

    expect(insertedCount).to.equal(9);
    const pairs = await getScopedClosurePairs([a, b, c]);
    expect(pairs).to.deep.equal(
      expectedPairs([
        [a, a],
        [a, b],
        [a, c],
        [b, a],
        [b, b],
        [b, c],
        [c, a],
        [c, b],
        [c, c]
      ])
    );
    // No duplicates: every ordered pair appears exactly once.
    expect(new Set(pairs).size).to.equal(pairs.length);
  });

  // Inactive-feature exclusion: B is inactive (record_end_date set). The active-feature universe
  // drives both the self rows and the edge join filter, so B gets no self row and the property edge
  // A->B is dropped (its target is not an active feature). Only A's self row survives in scope.
  it('4: inactive feature excluded — appears in no closure row', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);
    const propertyLabelId = await createPropertyEdgeLabel();

    const a = await insertFeatureRow({ submissionId, submissionUploadId: uploadId });
    const b = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, recordEndDate: true });
    await insertPropertyEdge(a, b, propertyLabelId);

    const { insertedCount } = await service.computeClosureForUpload(uploadId);

    expect(insertedCount).to.equal(1);
    expect(await getScopedClosurePairs([a, b])).to.deep.equal(expectedPairs([[a, a]]));

    // B is absent as both source and target across the whole table (not just the scoped slice).
    const bRows = await connection.sql(SQL`
      SELECT 1
      FROM submission_feature_closure
      WHERE source_submission_feature_id = ${b} OR target_submission_feature_id = ${b};
    `);
    expect(bRows.rows).to.have.lengthOf(0);
  });

  // Intra-upload filter: a property edge from A (in U1) to X (in U2) crosses uploads, so the recompute
  // of U1 drops it (X is not an active feature of U1). A's closure is just its self row, and the
  // cross-upload pair (A, X) never appears. Guards the af_tgt join on the property_edges CTE.
  it('5: cross-upload edge filtered — pair (A, X) absent from U1 closure', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadOne = await createTestUpload(connection, submissionId);
    const uploadTwo = await createTestUpload(connection, submissionId);
    const propertyLabelId = await createPropertyEdgeLabel();

    const a = await insertFeatureRow({ submissionId, submissionUploadId: uploadOne });
    const x = await insertFeatureRow({ submissionId, submissionUploadId: uploadTwo });
    await insertPropertyEdge(a, x, propertyLabelId);

    const { insertedCount } = await service.computeClosureForUpload(uploadOne);

    expect(insertedCount).to.equal(1);
    expect(await getScopedClosurePairs([a, x])).to.deep.equal(expectedPairs([[a, a]]));
  });

  // Empty-upload safety: an upload with no active features produces zero closure rows and must not
  // error. A count of zero is a valid result the service surfaces as insertedCount 0.
  it('6: empty upload — succeeds with insertedCount 0', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);

    // One feature, then deactivated, so the upload has zero ACTIVE features.
    const f1 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, recordEndDate: true });

    const { insertedCount } = await service.computeClosureForUpload(uploadId);

    expect(insertedCount).to.equal(0);
    expect(await getScopedClosurePairs([f1])).to.deep.equal([]);
  });

  // Stale-row removal: a feature with closure rows is deactivated, then the upload is recomputed. The
  // leading DELETE scopes by submission_upload_id (not active-only), so the now-inactive feature's
  // prior rows are removed even though it is no longer in the active universe.
  it('7: recompute removes a deactivated feature’s stale rows', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);

    const f1 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId });
    const f2 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, parentFeatureId: f1 });

    const firstRecompute = await service.computeClosureForUpload(uploadId);
    expect(firstRecompute.insertedCount).to.equal(3); // F1 self, F2 self, F2->F1
    expect(await getScopedClosurePairs([f1, f2])).to.deep.equal(
      expectedPairs([
        [f1, f1],
        [f2, f2],
        [f2, f1]
      ])
    );

    // Deactivate F2 and recompute: its self row and its parent edge to F1 must disappear.
    await connection.sql(SQL`
      UPDATE submission_feature SET record_end_date = now() WHERE submission_feature_id = ${f2};
    `);

    const secondRecompute = await service.computeClosureForUpload(uploadId);
    expect(secondRecompute.insertedCount).to.equal(1); // only F1 self remains
    expect(await getScopedClosurePairs([f1, f2])).to.deep.equal(expectedPairs([[f1, f1]]));

    const f2Rows = await connection.sql(SQL`
      SELECT 1
      FROM submission_feature_closure
      WHERE source_submission_feature_id = ${f2} OR target_submission_feature_id = ${f2};
    `);
    expect(f2Rows.rows).to.have.lengthOf(0);
  });

  // Multi-path dedupe: the pair (F2, F3) is reachable two ways — a DIRECT property edge F2->F3 and
  // the TRANSITIVE composition F2->F4 (property) then F4->F3 (parent). UNION in the recursive CTE
  // collapses both paths to a single closure row. Guards against UNION ALL duplicating multi-path pairs.
  it('8: multi-path pair appears exactly once', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);
    const propertyLabelId = await createPropertyEdgeLabel();

    const f3 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId });
    const f4 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, parentFeatureId: f3 });
    const f2 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId });
    await insertPropertyEdge(f2, f4, propertyLabelId); // F2 -> F4 (property); reachable F2 -> F4 -> F3 via parent
    await insertPropertyEdge(f2, f3, propertyLabelId); // F2 -> F3 (direct property)

    await service.computeClosureForUpload(uploadId);

    const f2ToF3 = await connection.sql(SQL`
      SELECT count(*)::integer AS count
      FROM submission_feature_closure
      WHERE source_submission_feature_id = ${f2} AND target_submission_feature_id = ${f3};
    `);
    expect(f2ToF3.rows[0].count).to.equal(1);
  });

  // Content exclusion: a content edge F1->F2 (submission_feature_feature) must NOT produce a closure
  // pair — content is deliberately outside the evidence reach (closing over parent + content is
  // O(N^2)). Only the two self rows survive; (F1, F2) is absent. Guards against content creeping back
  // into the recompute's edge union.
  it('9: content edge excluded — produces no closure pair', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);

    const f1 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId });
    const f2 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId });
    await insertContentEdge(f1, f2);

    const { insertedCount } = await service.computeClosureForUpload(uploadId);

    expect(insertedCount).to.equal(2); // F1 self, F2 self — the content edge contributes nothing
    expect(await getScopedClosurePairs([f1, f2])).to.deep.equal(
      expectedPairs([
        [f1, f1],
        [f2, f2]
      ])
    );
  });

  // No-explosion guard: a parent P with K children, plus a content edge P->child for every child
  // (the data shape that, under the old parent+content reach, composed into the full K^2 sibling
  // cross-product — telemetry_A -> P -> telemetry_B). With content excluded the closure is linear:
  // (K+1) self + K (child -> P) parent edges = 2K+1 rows, and NO sibling pair child_i -> child_j
  // exists. Guards the O(N) bound that is the entire point of excluding content.
  it('10: no sibling cross-product — parent + content stays O(N), not O(N^2)', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);

    const k = 20;
    const parent = await insertFeatureRow({ submissionId, submissionUploadId: uploadId });
    const children: number[] = [];
    for (let i = 0; i < k; i++) {
      const child = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, parentFeatureId: parent });
      children.push(child);
      await insertContentEdge(parent, child); // the would-be explosion source; must be ignored
    }

    const { insertedCount } = await service.computeClosureForUpload(uploadId);

    // Linear, not quadratic: (k + 1) self rows + k (child -> parent) edges.
    expect(insertedCount).to.equal(2 * k + 1);

    // No sibling pair exists (sample the first two children, both directions).
    const siblingPairs = await connection.sql(SQL`
      SELECT count(*)::integer AS count
      FROM submission_feature_closure
      WHERE (source_submission_feature_id = ${children[0]} AND target_submission_feature_id = ${children[1]})
         OR (source_submission_feature_id = ${children[1]} AND target_submission_feature_id = ${children[0]});
    `);
    expect(siblingPairs.rows[0].count).to.equal(0);
  });

  // is_ancestor flag: one table serves auth (the ancestry subset) and search (all rows). F1 root;
  // F2,F3 parent F1; property F2->F3 (cross-branch); property F3->F1 (duplicates F3's parent edge).
  //   (F2,F1) parent only         -> is_ancestor TRUE
  //   (F2,F3) property only       -> is_ancestor FALSE (F2's parent is F1, not F3)
  //   (F3,F1) reachable both ways -> is_ancestor TRUE (a pure-parent path exists)
  //   (F2,F2) self                -> is_ancestor TRUE
  // The WHERE is_ancestor subset is exactly the pure parent-ancestry pairs (the authorization reach).
  it('11: is_ancestor marks the pure parent-ancestry (auth) subset', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);
    const propertyLabelId = await createPropertyEdgeLabel();

    const f1 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId });
    const f2 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, parentFeatureId: f1 });
    const f3 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, parentFeatureId: f1 });
    await insertPropertyEdge(f2, f3, propertyLabelId); // cross-branch reference, not ancestry
    await insertPropertyEdge(f3, f1, propertyLabelId); // same pair as the F3->F1 parent edge

    await service.computeClosureForUpload(uploadId);

    expect(await getIsAncestor(f2, f1)).to.equal(true); // parent
    expect(await getIsAncestor(f2, f3)).to.equal(false); // property only
    expect(await getIsAncestor(f3, f1)).to.equal(true); // parent (and property) -> true
    expect(await getIsAncestor(f2, f2)).to.equal(true); // self

    // The auth subset (WHERE is_ancestor) = every ancestry pair, none of the reference-only pairs.
    const ancestorPairs = await connection.sql(SQL`
      SELECT source_submission_feature_id AS source, target_submission_feature_id AS target
      FROM submission_feature_closure
      WHERE source_submission_feature_id = ANY(${[f1, f2, f3]})
        AND target_submission_feature_id = ANY(${[f1, f2, f3]})
        AND is_ancestor
      ORDER BY source_submission_feature_id, target_submission_feature_id;
    `);
    expect(ancestorPairs.rows.map((r) => `${r.source}-${r.target}`)).to.deep.equal(
      expectedPairs([
        [f1, f1],
        [f2, f1],
        [f2, f2],
        [f3, f1],
        [f3, f3]
      ])
    );
  });
});
