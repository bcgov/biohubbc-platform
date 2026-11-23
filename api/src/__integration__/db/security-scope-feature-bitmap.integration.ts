// Integration test for the security scope feature bitmap — verifies the schema contract
// (the feature_ids roaringbitmap column on security_scope) and the bitmap build
// (SecurityScopeService.buildScopeFeatureBitmap) against the real database.
//
// Closure rows for the fixtures are written by hand rather than through the closure recompute, so
// the spec can hold shapes the recompute never produces together: a non-current feature that still
// has closure rows, and a current feature with ancestry rows but no self-loop.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running, migrations applied)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import { SecurityScopeService } from '../../services/access-policy/security-scope-service';
import { createTestUpload } from '../helpers/test-feature-property-helpers';
import { computeAnchors, createPolicy, createPolicyStatement, secureFeature } from '../helpers/test-rbac-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

describe('Security scope feature bitmap (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let scopeRepo: SecurityScopeRepository;
  let scopeService: SecurityScopeService;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    scopeRepo = new SecurityScopeRepository(connection);
    scopeService = new SecurityScopeService(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  /**
   * Insert one submission_feature under the given upload. `ended` makes the feature non-current
   * (published, then ended a day ago).
   */
  async function insertFeatureRow(params: {
    submissionId: number;
    submissionUploadId: string;
    featureTypeName: string;
    parentFeatureId?: number;
    ended?: boolean;
  }): Promise<number> {
    const result = await connection.sql(SQL`
      INSERT INTO submission_feature (
        submission_id,
        submission_upload_id,
        feature_type_id,
        parent_submission_feature_id,
        data,
        data_byte_size,
        record_effective_date,
        record_end_date
      )
      VALUES (
        ${params.submissionId},
        ${params.submissionUploadId}::uuid,
        (SELECT feature_type_id FROM feature_type WHERE name = ${params.featureTypeName} LIMIT 1),
        ${params.parentFeatureId ?? null},
        '{}'::jsonb,
        500,
        now() - INTERVAL '2 days',
        CASE WHEN ${params.ended ?? false}::boolean THEN now() - INTERVAL '1 day' END
      )
      RETURNING submission_feature_id;
    `);

    return result.rows[0].submission_feature_id;
  }

  /**
   * Insert one closure row: `descendantId` (source) reaches `ancestorId` (target) through parent
   * ancestry. Pass the same id twice for a self-loop.
   */
  async function insertClosureRow(descendantId: number, ancestorId: number): Promise<void> {
    await connection.sql(SQL`
      INSERT INTO submission_feature_closure (source_submission_feature_id, target_submission_feature_id, is_ancestor)
      VALUES (${descendantId}, ${ancestorId}, true);
    `);
  }

  /**
   * Create a scope for the URN, referenced by an active ALLOW statement of an approved policy, so
   * `resolveUrnForScope` resolves it.
   */
  async function createResolvableScope(urn: string): Promise<string> {
    const policyId = await createPolicy(connection, `Bitmap policy ${urn}`);
    const statementId = await createPolicyStatement(connection, policyId, urn);
    const result = await connection.sql(SQL`
      SELECT security_scope_id
      FROM policy_statement
      WHERE policy_statement_id = ${statementId};
    `);

    return result.rows[0].security_scope_id;
  }

  /**
   * One submission holding a secured survey with a subtree, plus features outside what a
   * `urn:<submission>:survey:*` scope grants.
   *
   *   survey (secured, anchor)
   *   ├── sampleSite              other type, current, self-loop
   *   │   └── samplePeriod        other type, current, self-loop
   *   ├── observation             other type, current, self-loop
   *   ├── endedChild              NOT current (ended), has self-loop and ancestry rows
   *   └── noSelfLoopChild         current, ancestry row only, NO self-loop
   *   report (secured)            other type, outside the subtree
   *   dataset (not secured)       other type, outside the subtree
   */
  async function seedSurveySubtree(): Promise<{
    submissionId: number;
    surveyId: number;
    grantedIds: number[];
    endedChildId: number;
    noSelfLoopChildId: number;
    unrelatedSecuredId: number;
    unsecuredDatasetId: number;
  }> {
    const submissionId = await createTestSubmission(connection);
    const submissionUploadId = await createTestUpload(connection, submissionId);
    const base = { submissionId, submissionUploadId };

    const surveyId = await insertFeatureRow({ ...base, featureTypeName: 'survey' });
    const sampleSiteId = await insertFeatureRow({ ...base, featureTypeName: 'sample_site', parentFeatureId: surveyId });
    const samplePeriodId = await insertFeatureRow({
      ...base,
      featureTypeName: 'sample_period',
      parentFeatureId: sampleSiteId
    });
    const observationId = await insertFeatureRow({
      ...base,
      featureTypeName: 'species_observation',
      parentFeatureId: surveyId
    });
    const endedChildId = await insertFeatureRow({
      ...base,
      featureTypeName: 'sample_site',
      parentFeatureId: surveyId,
      ended: true
    });
    const noSelfLoopChildId = await insertFeatureRow({
      ...base,
      featureTypeName: 'sample_site',
      parentFeatureId: surveyId
    });
    const unrelatedSecuredId = await insertFeatureRow({ ...base, featureTypeName: 'report' });
    const unsecuredDatasetId = await insertFeatureRow({ ...base, featureTypeName: 'dataset' });

    await secureFeature(connection, surveyId);
    await secureFeature(connection, unrelatedSecuredId);

    // Self-loops: every feature except noSelfLoopChild. The ended child keeps its rows so that only
    // its lifecycle state, not a missing closure row, can keep it out of the bitmap.
    for (const featureId of [
      surveyId,
      sampleSiteId,
      samplePeriodId,
      observationId,
      endedChildId,
      unrelatedSecuredId,
      unsecuredDatasetId
    ]) {
      await insertClosureRow(featureId, featureId);
    }

    // Ancestry: descendant (source) → ancestor (target).
    await insertClosureRow(sampleSiteId, surveyId);
    await insertClosureRow(samplePeriodId, sampleSiteId);
    await insertClosureRow(samplePeriodId, surveyId);
    await insertClosureRow(observationId, surveyId);
    await insertClosureRow(endedChildId, surveyId);
    await insertClosureRow(noSelfLoopChildId, surveyId);

    return {
      submissionId,
      surveyId,
      grantedIds: [surveyId, sampleSiteId, samplePeriodId, observationId].sort((a, b) => a - b),
      endedChildId,
      noSelfLoopChildId,
      unrelatedSecuredId,
      unsecuredDatasetId
    };
  }

  async function getAnchorIds(securityScopeId: string): Promise<number[]> {
    const result = await connection.sql(SQL`
      SELECT anchor_submission_feature_id
      FROM security_scope_anchor
      WHERE security_scope_id = ${securityScopeId}
      ORDER BY anchor_submission_feature_id;
    `);

    return result.rows.map((row) => row.anchor_submission_feature_id);
  }

  /**
   * Resolve the scope's URN, compute its anchors, then build its bitmap — the order the anchor and
   * bitmap jobs run in. Returns false, building nothing, when the URN does not resolve.
   */
  async function computeAnchorsAndBuildBitmap(securityScopeId: string): Promise<boolean> {
    const urn = await scopeService.resolveUrnForScope(securityScopeId);

    if (!urn) {
      return false;
    }

    await computeAnchors(scopeRepo, securityScopeId);
    await scopeService.buildScopeFeatureBitmap(securityScopeId, urn);

    return true;
  }

  async function getBitmap(securityScopeId: string): Promise<{
    ids: number[] | null;
    cardinality: number | null;
    bytes: Buffer | null;
    isRunOptimised: boolean | null;
  }> {
    const result = await connection.sql(SQL`
      SELECT
        rb_to_array(feature_ids) AS ids,
        rb_cardinality(feature_ids)::integer AS cardinality,
        feature_ids::bytea AS bytes,
        feature_ids::bytea = rb_runoptimize(feature_ids)::bytea AS is_run_optimised
      FROM security_scope
      WHERE security_scope_id = ${securityScopeId};
    `);
    const row = result.rows[0];

    return {
      ids: row.ids === null ? null : [...row.ids].sort((a: number, b: number) => a - b),
      cardinality: row.cardinality,
      bytes: row.bytes,
      isRunOptimised: row.is_run_optimised
    };
  }

  /**
   * What the scope's stored anchors grant: each anchor and its descendants (closure rows with
   * `is_ancestor = true`, descendant on the source side), restricted to current features that have
   * a closure self-loop.
   */
  async function getIdsGrantedByAnchors(securityScopeId: string): Promise<number[]> {
    const result = await connection.sql(SQL`
      SELECT DISTINCT closure.source_submission_feature_id AS submission_feature_id
      FROM security_scope_anchor anchor
      JOIN submission_feature_closure closure
        ON closure.target_submission_feature_id = anchor.anchor_submission_feature_id
       AND closure.is_ancestor = true
      JOIN submission_feature feature
        ON feature.submission_feature_id = closure.source_submission_feature_id
      WHERE anchor.security_scope_id = ${securityScopeId}
        AND feature.record_effective_date <= now()
        AND (feature.record_end_date IS NULL OR now() < feature.record_end_date)
        AND feature.successor_submission_feature_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM submission_feature_closure self_loop
          WHERE self_loop.source_submission_feature_id = closure.source_submission_feature_id
            AND self_loop.target_submission_feature_id = closure.source_submission_feature_id
        )
      ORDER BY 1;
    `);

    return result.rows.map((row) => row.submission_feature_id);
  }

  // ── Tests ────────────────────────────────────────────────────────────

  it('AC2: security_scope has a nullable feature_ids roaringbitmap column and the extension is installed', async () => {
    const columns = await connection.sql(SQL`
      SELECT is_nullable, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'biohub'
        AND table_name = 'security_scope'
        AND column_name = 'feature_ids'
    `);

    expect(columns.rows, 'biohub.security_scope.feature_ids column').to.have.length(1);
    expect(columns.rows[0].is_nullable).to.equal('YES');
    expect(columns.rows[0].udt_name).to.equal('roaringbitmap');

    const extensions = await connection.sql(SQL`
      SELECT extname
      FROM pg_extension
      WHERE extname = 'roaringbitmap'
    `);

    expect(extensions.rows, 'roaringbitmap extension').to.have.length(1);
  });

  it('AC4: the bitmap holds exactly the anchor and its current, self-looped descendants, run-optimised, and is empty rather than NULL for a scope that matches no secured feature', async () => {
    const fixture = await seedSurveySubtree();
    const scopeId = await createResolvableScope(`urn:${fixture.submissionId}:survey:*`);
    // The dataset exists in the submission but is not secured, so this scope matches no secured feature.
    const emptyScopeId = await createResolvableScope(`urn:${fixture.submissionId}:dataset:*`);

    expect(await computeAnchorsAndBuildBitmap(scopeId), 'survey scope resolves').to.be.true;
    expect(await computeAnchorsAndBuildBitmap(emptyScopeId), 'dataset scope resolves').to.be.true;

    // Fixture check: the survey is the scope's only anchor, and the empty scope has none.
    expect(await getAnchorIds(scopeId)).to.eql([fixture.surveyId]);
    expect(await getAnchorIds(emptyScopeId)).to.eql([]);

    const bitmap = await getBitmap(scopeId);

    expect(bitmap.ids).to.eql(fixture.grantedIds);
    expect(bitmap.ids, 'non-current descendant').to.not.include(fixture.endedChildId);
    expect(bitmap.ids, 'descendant with no closure self-loop').to.not.include(fixture.noSelfLoopChildId);
    expect(bitmap.ids, 'secured feature of another type outside the subtree').to.not.include(
      fixture.unrelatedSecuredId
    );
    expect(bitmap.ids, 'unsecured feature outside the subtree').to.not.include(fixture.unsecuredDatasetId);
    expect(bitmap.isRunOptimised, 'feature_ids::bytea = rb_runoptimize(feature_ids)::bytea').to.be.true;

    const emptyBitmap = await getBitmap(emptyScopeId);

    expect(emptyBitmap.bytes, 'empty scope feature_ids is not NULL').to.not.be.null;
    expect(emptyBitmap.cardinality).to.equal(0);
    expect(emptyBitmap.ids).to.eql([]);
    expect(emptyBitmap.isRunOptimised).to.be.true;
  });

  it('AC6: building a scope bitmap twice on unchanged data stores the same bytes', async () => {
    const fixture = await seedSurveySubtree();
    const scopeId = await createResolvableScope(`urn:${fixture.submissionId}:survey:*`);

    expect(await computeAnchorsAndBuildBitmap(scopeId), 'scope resolves').to.be.true;
    const first = await getBitmap(scopeId);

    expect(await computeAnchorsAndBuildBitmap(scopeId), 'scope resolves').to.be.true;
    const second = await getBitmap(scopeId);

    expect(first.bytes, 'feature_ids after the first build').to.not.be.null;
    expect(first.ids).to.eql(fixture.grantedIds);
    expect(second.bytes?.toString('hex')).to.equal(first.bytes?.toString('hex'));
  });

  it('AC8: every resolvable scope bitmap equals the features its stored anchors grant', async function () {
    this.timeout(120000);

    // Test-created scopes with anchors, so the comparison is never limited to whatever is seeded.
    const fixture = await seedSurveySubtree();
    const surveyScopeId = await createResolvableScope(`urn:${fixture.submissionId}:survey:*`);
    const submissionScopeId = await createResolvableScope(`urn:${fixture.submissionId}:*:*`);

    const scopes = await connection.sql(SQL`
      SELECT security_scope_id
      FROM security_scope
      ORDER BY security_scope_id;
    `);

    const comparedScopeIds: string[] = [];
    let comparedScopesWithAnchors = 0;

    for (const scope of scopes.rows) {
      const scopeId: string = scope.security_scope_id;

      if (!(await computeAnchorsAndBuildBitmap(scopeId))) {
        continue;
      }

      // Compare right after the build: bitmaps are not refreshed on uploads or rule changes yet.
      const expectedIds = await getIdsGrantedByAnchors(scopeId);
      const bitmap = await getBitmap(scopeId);

      expect(bitmap.ids, `feature_ids of scope ${scopeId}`).to.eql(expectedIds);

      comparedScopeIds.push(scopeId);
      comparedScopesWithAnchors += expectedIds.length > 0 ? 1 : 0;
    }

    expect(comparedScopeIds).to.include.members([surveyScopeId, submissionScopeId]);
    expect(comparedScopesWithAnchors, 'compared scopes that grant at least one feature').to.be.greaterThan(0);
    expect(await getIdsGrantedByAnchors(surveyScopeId)).to.eql(fixture.grantedIds);
  });
});
