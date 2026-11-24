// Integration test for the per-submission refresh of a security scope's feature bitmap
// (SecurityScopeService.refreshScopeFeatureBitmapForSubmission) against the real database.
//
// Every scope here is `urn:*:<type>:*` over a feature type created for the test, so a full build
// only ever spans the test's own features and no existing scope matches them.
//
// Closure rows for the fixtures are written by hand rather than through the closure recompute, so
// the spec can hold shapes the recompute never produces together: a non-current feature that still
// has closure rows, and a current feature with ancestry rows but no self-loop.
//
// The first six tests write their rows in a transaction that is ROLLED BACK. The two tests under
// "with two connections" need rows other connections can see, so they COMMIT their fixture and
// delete it again in `afterEach`. What stays behind from those two: the audit_log entries the
// journal triggers write for the committed inserts and deletes.
//
// Run: make test-db
// Requires: make web (database must be running, migrations applied)

import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SubmissionUploadReviewScope, SubmissionUploadReviewStatus } from '../../models/submission-upload-review';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import { SecurityScopeService } from '../../services/access-policy/security-scope-service';
import { SecurityScopeUrn } from '../../services/access-policy/security-scope-service.interface';
import { SubmissionUploadReviewSecurityService } from '../../services/upload/submission-upload-review-security-service';
import { SubmissionUploadReviewService } from '../../services/upload/submission-upload-review-service';
import { createTestUpload } from '../helpers/test-feature-property-helpers';
import {
  computeAnchors,
  createPolicy,
  createPolicyStatement,
  createTeam,
  createTeamPolicy,
  secureFeature
} from '../helpers/test-rbac-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

/**
 * The refresh method under test.
 */
interface ScopeFeatureBitmapRefresher {
  refreshScopeFeatureBitmapForSubmission(
    securityScopeId: string,
    urn: SecurityScopeUrn,
    submissionId: number
  ): Promise<void>;
}

function hasBitmapRefresh<T extends object>(service: T): service is T & ScopeFeatureBitmapRefresher {
  return (
    'refreshScopeFeatureBitmapForSubmission' in service &&
    typeof service.refreshScopeFeatureBitmapForSubmission === 'function'
  );
}

/**
 * A SecurityScopeService on the connection, narrowed to the refresh method. Throws when the service
 * does not have the method.
 */
function refreshServiceFor(connection: IDBConnection): SecurityScopeService & ScopeFeatureBitmapRefresher {
  const service = new SecurityScopeService(connection);

  if (!hasBitmapRefresh(service)) {
    throw new TypeError('SecurityScopeService.refreshScopeFeatureBitmapForSubmission is not a function');
  }

  return service;
}

interface SeededSubmission {
  submissionId: number;
  submissionUploadId: string;
  featureTypeName: string;
  anchorId: number;
  childId: number;
  secondAnchorId: number;
  /** Every feature of the submission the scope grants after the first build, ascending. */
  builtIds: number[];
}

interface BuiltScope {
  securityScopeId: string;
  urn: SecurityScopeUrn;
  policyId: string;
  featureTypeName: string;
  submissions: SeededSubmission[];
}

/** A scope added to an existing fixture: its own policy and statement, anchors computed, bitmap built. */
interface AddedScope {
  securityScopeId: string;
  urn: SecurityScopeUrn;
  policyId: string;
}

/**
 * A scope naming one submission (`urn:<submission>:<type>:*`) with its bitmap built, and a security
 * review of the submission's upload.
 *
 *   anchor (secured by the seeded rule)         the parent
 *   └── child                                   covered only through the parent's rule
 *   secondAnchor (secured by the seeded rule)
 *   └── secondChild
 */
interface ReviewedSubmissionScope extends BuiltScope {
  submission: SeededSubmission;
  secondChildId: number;
  submissionUploadReviewId: string;
}

/** The fixture of the rule-removal tests: three scopes holding submission A's ids, and one that holds none. */
interface RemovalFixture {
  submissionA: SeededSubmission;
  submissionUploadReviewId: string;
  /** `urn:*:<type 1>:*`, no team linked. Holds ids of A and B. */
  unlinkedWildcardScope: AddedScope;
  /** `urn:*:<type 2>:*`, a team linked. Holds ids of A and B. */
  linkedWildcardScope: AddedScope;
  /** `urn:<A>:<type 1>:*`. Holds ids of A only. */
  scopeNamingA: AddedScope;
  /** `urn:<C>:<type 3>:*`. Holds ids of a third submission only. */
  scopeNamingC: AddedScope;
  /** Ids of submission B in each wildcard bitmap, ascending. */
  idsOfBInUnlinkedWildcard: number[];
  idsOfBInLinkedWildcard: number[];
  /** `feature_ids::bytea` of the scope naming C, before any removal. */
  hexOfScopeNamingC: string;
}

/** The rule `secureFeature` assigns. */
const SEEDED_SECURITY_RULE_ID = 1;

describe('Security scope feature bitmap refresh (integration)', function () {
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

  // Removing rule assignments publishes anchor and bitmap jobs; pg-boss is not running under this suite.
  beforeEach(() => {
    sinon
      .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
      .resolves({ status: 'published', jobId: 'stub-job-id' });
    sinon
      .stub(SecurityScopeService.dependencies, 'publishComputeScopeFeatureBitmapJob')
      .resolves({ status: 'published', jobId: 'stub-job-id' });
  });

  afterEach(() => {
    sinon.restore();
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  /**
   * Insert one submission_feature under the given upload. `ended` makes the feature non-current
   * (published, then ended a day ago); `successorFeatureId` makes it superseded.
   */
  async function insertFeatureRow(
    db: IDBConnection,
    params: {
      submissionId: number;
      submissionUploadId: string;
      featureTypeName: string;
      parentFeatureId?: number;
      ended?: boolean;
      successorFeatureId?: number;
    }
  ): Promise<number> {
    const result = await db.sql(SQL`
      INSERT INTO submission_feature (
        submission_id,
        submission_upload_id,
        feature_type_id,
        parent_submission_feature_id,
        successor_submission_feature_id,
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
        ${params.successorFeatureId ?? null},
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
  async function insertClosureRow(db: IDBConnection, descendantId: number, ancestorId: number): Promise<void> {
    await db.sql(SQL`
      INSERT INTO submission_feature_closure (source_submission_feature_id, target_submission_feature_id, is_ancestor)
      VALUES (${descendantId}, ${ancestorId}, true);
    `);
  }

  /**
   * Add a secured root feature with a closure self-loop to the submission. `ended` or
   * `successorFeatureId` leave everything else in place, so only the lifecycle state can keep the
   * feature out of a bitmap.
   */
  async function insertSecuredFeature(
    db: IDBConnection,
    submission: SeededSubmission,
    lifecycle: { ended?: boolean; successorFeatureId?: number } = {}
  ): Promise<number> {
    const featureId = await insertFeatureRow(db, {
      submissionId: submission.submissionId,
      submissionUploadId: submission.submissionUploadId,
      featureTypeName: submission.featureTypeName,
      ...lifecycle
    });

    await secureFeature(db, featureId);
    await insertClosureRow(db, featureId, featureId);

    return featureId;
  }

  /**
   * End a feature a day ago, making it non-current. Its closure rows and security rule stay.
   */
  async function endFeature(db: IDBConnection, submissionFeatureId: number): Promise<void> {
    await db.sql(SQL`
      UPDATE submission_feature
      SET record_end_date = now() - INTERVAL '1 day'
      WHERE submission_feature_id = ${submissionFeatureId};
    `);
  }

  /**
   * One submission holding two secured roots of the scope's feature type, one of them with a child.
   *
   *   anchor (secured)            current, self-loop
   *   └── child                   current, self-loop
   *   secondAnchor (secured)      current, self-loop
   */
  async function seedSubmission(db: IDBConnection, featureTypeName: string): Promise<SeededSubmission> {
    const submissionId = await createTestSubmission(db);
    const submissionUploadId = await createTestUpload(db, submissionId);
    const base = { submissionId, submissionUploadId, featureTypeName };

    const anchorId = await insertFeatureRow(db, base);
    const childId = await insertFeatureRow(db, { ...base, parentFeatureId: anchorId });
    const secondAnchorId = await insertFeatureRow(db, base);

    await secureFeature(db, anchorId);
    await secureFeature(db, secondAnchorId);

    for (const featureId of [anchorId, childId, secondAnchorId]) {
      await insertClosureRow(db, featureId, featureId);
    }

    await insertClosureRow(db, childId, anchorId);

    return {
      submissionId,
      submissionUploadId,
      featureTypeName,
      anchorId,
      childId,
      secondAnchorId,
      builtIds: [anchorId, childId, secondAnchorId].sort((a, b) => a - b)
    };
  }

  /**
   * Compute the scope's anchors on the connection — what the anchor job does before a bitmap job runs.
   */
  async function recomputeAnchors(db: IDBConnection, securityScopeId: string): Promise<void> {
    await computeAnchors(new SecurityScopeRepository(db), securityScopeId);
  }

  /**
   * Create a feature type of its own, `submissionCount` submissions holding features of it, and a
   * `urn:*:<type>:*` scope referenced by an active ALLOW statement of an approved policy; then
   * compute the scope's anchors and build its bitmap in full.
   */
  async function seedBuiltScope(db: IDBConnection, submissionCount: number): Promise<BuiltScope> {
    const featureTypeName = `bitmap_refresh_${randomUUID().replace(/-/g, '_')}`;

    await db.sql(SQL`
      INSERT INTO feature_type (name, display_name, create_user)
      VALUES (${featureTypeName}, 'Bitmap refresh test type', ${db.systemUserId()});
    `);

    const submissions: SeededSubmission[] = [];

    for (let index = 0; index < submissionCount; index++) {
      submissions.push(await seedSubmission(db, featureTypeName));
    }

    const policyId = await createPolicy(db, `Bitmap refresh policy ${featureTypeName}`);
    const statementId = await createPolicyStatement(db, policyId, `urn:*:${featureTypeName}:*`);
    const statement = await db.sql(SQL`
      SELECT security_scope_id
      FROM policy_statement
      WHERE policy_statement_id = ${statementId};
    `);
    const securityScopeId: string = statement.rows[0].security_scope_id;

    const scopeService = new SecurityScopeService(db);
    const urn = await scopeService.resolveUrnForScope(securityScopeId);

    if (!urn) {
      throw new Error(`Fixture scope ${securityScopeId} does not resolve to a URN`);
    }

    await recomputeAnchors(db, securityScopeId);
    await scopeService.buildScopeFeatureBitmap(securityScopeId, urn);

    // Fixture check: the full build holds every seeded feature of every submission, and nothing else.
    const built = await getBitmap(db, securityScopeId);
    const seededIds = submissions.flatMap((submission) => submission.builtIds).sort((a, b) => a - b);

    expect(built.ids, 'fixture: feature_ids after the first full build').to.eql(seededIds);

    return { securityScopeId, urn, policyId, featureTypeName, submissions };
  }

  async function getBitmap(
    db: IDBConnection,
    securityScopeId: string
  ): Promise<{ ids: number[]; hex: string; isRunOptimised: boolean }> {
    const result = await db.sql(SQL`
      SELECT
        rb_to_array(feature_ids) AS ids,
        encode(feature_ids::bytea, 'hex') AS hex,
        feature_ids::bytea = rb_runoptimize(feature_ids)::bytea AS is_run_optimised
      FROM security_scope
      WHERE security_scope_id = ${securityScopeId};
    `);
    const row = result.rows[0];

    return {
      ids: [...row.ids].sort((a: number, b: number) => a - b),
      hex: row.hex,
      isRunOptimised: row.is_run_optimised
    };
  }

  /**
   * The ids in the scope's bitmap that belong to the given submission, ascending.
   */
  async function getBitmapIdsOfSubmission(
    db: IDBConnection,
    securityScopeId: string,
    submissionId: number
  ): Promise<number[]> {
    const result = await db.sql(SQL`
      SELECT feature.submission_feature_id
      FROM security_scope scope
      JOIN submission_feature feature
        ON feature.submission_feature_id = ANY(rb_to_array(scope.feature_ids))
      WHERE scope.security_scope_id = ${securityScopeId}
        AND feature.submission_id = ${submissionId}
      ORDER BY feature.submission_feature_id;
    `);

    return result.rows.map((row) => row.submission_feature_id);
  }

  async function getScopeRowVersion(
    db: IDBConnection,
    securityScopeId: string
  ): Promise<{ xmin: string; ctid: string }> {
    const result = await db.sql(SQL`
      SELECT xmin::text AS xmin, ctid::text AS ctid
      FROM security_scope
      WHERE security_scope_id = ${securityScopeId};
    `);

    return { xmin: result.rows[0].xmin, ctid: result.rows[0].ctid };
  }

  async function insertFeatureType(db: IDBConnection): Promise<string> {
    const featureTypeName = `bitmap_refresh_${randomUUID().replace(/-/g, '_')}`;

    await db.sql(SQL`
      INSERT INTO feature_type (name, display_name, create_user)
      VALUES (${featureTypeName}, 'Bitmap refresh test type', ${db.systemUserId()});
    `);

    return featureTypeName;
  }

  /**
   * Add a scope for the URN, referenced by an active ALLOW statement of an approved policy of its
   * own; compute its anchors and build its bitmap in full. `teamLinked` links a new team to the policy.
   */
  async function addBuiltScope(
    db: IDBConnection,
    urnText: string,
    options: { teamLinked?: boolean } = {}
  ): Promise<AddedScope> {
    const policyId = await createPolicy(db, `Bitmap refresh policy ${randomUUID()}`);
    const statementId = await createPolicyStatement(db, policyId, urnText);
    const statement = await db.sql(SQL`
      SELECT security_scope_id
      FROM policy_statement
      WHERE policy_statement_id = ${statementId};
    `);
    const securityScopeId: string = statement.rows[0].security_scope_id;

    if (options.teamLinked) {
      const teamId = await createTeam(db, `Bitmap refresh team ${randomUUID()}`);
      await createTeamPolicy(db, teamId, policyId);
      await new SecurityScopeRepository(db).insertTeamSecurityScopesForPolicy(teamId, policyId);
    }

    const scopeService = new SecurityScopeService(db);
    const urn = await scopeService.resolveUrnForScope(securityScopeId);

    if (!urn) {
      throw new Error(`Fixture scope ${securityScopeId} does not resolve to a URN`);
    }

    await recomputeAnchors(db, securityScopeId);
    await scopeService.buildScopeFeatureBitmap(securityScopeId, urn);

    return { securityScopeId, urn, policyId };
  }

  /**
   * Open a security review of the upload, in progress.
   */
  async function insertSecurityReview(
    db: IDBConnection,
    submissionId: number,
    submissionUploadId: string
  ): Promise<string> {
    const review = await new SubmissionUploadReviewService(db).insertSubmissionUploadReview(submissionId, {
      submission_upload_id: submissionUploadId,
      name: `Bitmap refresh review ${randomUUID()}`,
      description: null,
      scope: SubmissionUploadReviewScope.SECURITY,
      status: SubmissionUploadReviewStatus.IN_PROGRESS,
      requested_by: null
    });

    return review.submission_upload_review_id;
  }

  /**
   * The security rule assignments on the given features, as `<feature id>:<rule id>`, ascending.
   */
  async function getRuleAssignments(db: IDBConnection, submissionFeatureIds: number[]): Promise<string[]> {
    const result = await db.sql(SQL`
      SELECT submission_feature_id, security_rule_id
      FROM submission_feature_security
      WHERE submission_feature_id = ANY(${submissionFeatureIds}::integer[])
      ORDER BY submission_feature_id, security_rule_id;
    `);

    return result.rows.map((row) => `${row.submission_feature_id}:${row.security_rule_id}`);
  }

  /**
   * Three scopes whose bitmaps hold submission A's ids — a wildcard scope with no team, a wildcard
   * scope a team is linked to, and a scope naming A — and a scope naming a third submission C. Both
   * wildcard bitmaps also hold ids of a second submission B. Each wildcard scope has a feature type
   * of its own, and so does C, so every bitmap holds only what is listed here.
   */
  async function seedRemovalFixture(db: IDBConnection): Promise<RemovalFixture> {
    // Type 1: A and B, under `urn:*:<type 1>:*` with no team linked.
    const typeOne = await seedBuiltScope(db, 2);
    const [submissionA, submissionB] = typeOne.submissions;

    // Type 2: one secured root in each of A and B, under `urn:*:<type 2>:*` with a team linked.
    const typeTwoName = await insertFeatureType(db);
    const typeTwoIdOfA = await insertSecuredFeature(db, { ...submissionA, featureTypeName: typeTwoName });
    const typeTwoIdOfB = await insertSecuredFeature(db, { ...submissionB, featureTypeName: typeTwoName });
    const linkedWildcardScope = await addBuiltScope(db, `urn:*:${typeTwoName}:*`, { teamLinked: true });

    const scopeNamingA = await addBuiltScope(db, `urn:${submissionA.submissionId}:${typeOne.featureTypeName}:*`);

    // Type 3: a third submission, under a scope naming it.
    const typeThree = await seedBuiltScope(db, 1);
    const [submissionC] = typeThree.submissions;
    const scopeNamingC = await addBuiltScope(db, `urn:${submissionC.submissionId}:${typeThree.featureTypeName}:*`);

    const submissionUploadReviewId = await insertSecurityReview(
      db,
      submissionA.submissionId,
      submissionA.submissionUploadId
    );

    // Fixture checks: every bitmap holds what the tests say it holds before a removal.
    const linkedBitmap = await getBitmap(db, linkedWildcardScope.securityScopeId);
    const bitmapNamingA = await getBitmap(db, scopeNamingA.securityScopeId);
    const bitmapNamingC = await getBitmap(db, scopeNamingC.securityScopeId);

    expect(linkedBitmap.ids, 'fixture: feature_ids of the team-linked wildcard scope').to.eql(
      [typeTwoIdOfA, typeTwoIdOfB].sort((a, b) => a - b)
    );
    expect(bitmapNamingA.ids, 'fixture: feature_ids of the scope naming A').to.eql(submissionA.builtIds);
    expect(bitmapNamingC.ids, 'fixture: feature_ids of the scope naming C').to.eql(submissionC.builtIds);

    return {
      submissionA,
      submissionUploadReviewId,
      unlinkedWildcardScope: typeOne,
      linkedWildcardScope,
      scopeNamingA,
      scopeNamingC,
      idsOfBInUnlinkedWildcard: submissionB.builtIds,
      idsOfBInLinkedWildcard: [typeTwoIdOfB],
      hexOfScopeNamingC: bitmapNamingC.hex
    };
  }

  /**
   * Read the four bitmaps on the connection and expect: none of the three that held A's ids holds
   * one, both wildcard bitmaps hold exactly B's ids, and the scope naming C is as it was.
   */
  async function expectSubmissionARevoked(db: IDBConnection, fixture: RemovalFixture): Promise<void> {
    const submissionId = fixture.submissionA.submissionId;

    expect(
      await getBitmapIdsOfSubmission(db, fixture.unlinkedWildcardScope.securityScopeId, submissionId),
      'ids of submission A in the wildcard bitmap with no team linked'
    ).to.eql([]);
    expect(
      await getBitmapIdsOfSubmission(db, fixture.linkedWildcardScope.securityScopeId, submissionId),
      'ids of submission A in the team-linked wildcard bitmap'
    ).to.eql([]);
    expect(
      await getBitmapIdsOfSubmission(db, fixture.scopeNamingA.securityScopeId, submissionId),
      'ids of submission A in the bitmap of the scope naming A'
    ).to.eql([]);

    const unlinkedBitmap = await getBitmap(db, fixture.unlinkedWildcardScope.securityScopeId);
    const linkedBitmap = await getBitmap(db, fixture.linkedWildcardScope.securityScopeId);
    const bitmapNamingC = await getBitmap(db, fixture.scopeNamingC.securityScopeId);

    expect(unlinkedBitmap.ids, 'feature_ids of the wildcard scope with no team linked').to.eql(
      fixture.idsOfBInUnlinkedWildcard
    );
    expect(linkedBitmap.ids, 'feature_ids of the team-linked wildcard scope').to.eql(fixture.idsOfBInLinkedWildcard);
    expect(bitmapNamingC.hex, 'feature_ids::bytea of the scope naming a third submission').to.equal(
      fixture.hexOfScopeNamingC
    );
  }

  /**
   * Create a feature type of its own, one submission of two secured parents with a child each, a
   * `urn:<submission>:<type>:*` scope with its anchors computed and its bitmap built in full, and a
   * security review of the submission's upload.
   */
  async function seedReviewedSubmissionScope(db: IDBConnection): Promise<ReviewedSubmissionScope> {
    const featureTypeName = await insertFeatureType(db);
    const seeded = await seedSubmission(db, featureTypeName);

    const secondChildId = await insertFeatureRow(db, {
      submissionId: seeded.submissionId,
      submissionUploadId: seeded.submissionUploadId,
      featureTypeName,
      parentFeatureId: seeded.secondAnchorId
    });
    await insertClosureRow(db, secondChildId, secondChildId);
    await insertClosureRow(db, secondChildId, seeded.secondAnchorId);

    const submission: SeededSubmission = {
      ...seeded,
      builtIds: [...seeded.builtIds, secondChildId].sort((a, b) => a - b)
    };

    const scope = await addBuiltScope(db, `urn:${submission.submissionId}:${featureTypeName}:*`);
    const submissionUploadReviewId = await insertSecurityReview(
      db,
      submission.submissionId,
      submission.submissionUploadId
    );

    // Fixture check: the full build holds both parents and both children, and nothing else.
    const built = await getBitmap(db, scope.securityScopeId);

    expect(built.ids, 'fixture: feature_ids after the first full build').to.eql(submission.builtIds);

    return {
      ...scope,
      featureTypeName,
      submissions: [submission],
      submission,
      secondChildId,
      submissionUploadReviewId
    };
  }

  /**
   * Bring the scope's anchors up to date on the connection, as the anchor job does: add the missing
   * ones, then delete the stale ones.
   */
  async function syncAnchors(db: IDBConnection, securityScopeId: string): Promise<void> {
    await recomputeAnchors(db, securityScopeId);

    const scopeService = new SecurityScopeService(db);
    let lastId = 0;

    while (true) {
      const batch = await scopeService.deleteStaleAnchorBatch(securityScopeId, lastId, null);

      if (!batch) {
        break;
      }

      lastId = batch.pageLastId;
    }
  }

  /**
   * The features of the submission the scope's anchors grant, ascending: every current feature with
   * a closure self-loop that is an anchor of the scope or has one among its ancestors.
   */
  async function getAnchorGrantedIds(
    db: IDBConnection,
    securityScopeId: string,
    submissionId: number
  ): Promise<number[]> {
    const result = await db.sql(SQL`
      SELECT DISTINCT feature.submission_feature_id
      FROM security_scope_anchor anchor
      JOIN submission_feature_closure closure
        ON closure.target_submission_feature_id = anchor.anchor_submission_feature_id
        AND closure.is_ancestor = true
      JOIN submission_feature feature
        ON feature.submission_feature_id = closure.source_submission_feature_id
      WHERE anchor.security_scope_id = ${securityScopeId}
        AND feature.submission_id = ${submissionId}
        AND feature.record_effective_date <= now()
        AND (feature.record_end_date IS NULL OR feature.record_end_date > now())
        AND feature.successor_submission_feature_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM submission_feature_closure self_loop
          WHERE self_loop.source_submission_feature_id = feature.submission_feature_id
            AND self_loop.target_submission_feature_id = feature.submission_feature_id
        )
      ORDER BY feature.submission_feature_id;
    `);

    return result.rows.map((row) => row.submission_feature_id);
  }

  // ── Tests ────────────────────────────────────────────────────────────

  // AC5
  it('refreshing one submission leaves the ids of another submission in the same bitmap exactly as they were', async () => {
    const scope = await seedBuiltScope(connection, 2);
    const [submissionA, submissionB] = scope.submissions;

    const idsOfBBefore = await getBitmapIdsOfSubmission(connection, scope.securityScopeId, submissionB.submissionId);

    // Fixture check: the bitmap holds B's features before the refresh.
    expect(idsOfBBefore, 'fixture: ids of submission B before the refresh').to.eql(submissionB.builtIds);

    await endFeature(connection, submissionA.secondAnchorId);
    await insertSecuredFeature(connection, submissionA);
    await recomputeAnchors(connection, scope.securityScopeId);

    await refreshServiceFor(connection).refreshScopeFeatureBitmapForSubmission(
      scope.securityScopeId,
      scope.urn,
      submissionA.submissionId
    );

    const idsOfBAfter = await getBitmapIdsOfSubmission(connection, scope.securityScopeId, submissionB.submissionId);

    expect(idsOfBAfter, 'ids of submission B after refreshing submission A').to.eql(idsOfBBefore);
  });

  // AC6
  it('a refresh stores the same run-optimised bitmap as a full build, without superseded, ended or self-loop-less features', async () => {
    const scope = await seedBuiltScope(connection, 2);
    const [submissionA] = scope.submissions;

    const newCurrentId = await insertSecuredFeature(connection, submissionA);
    const supersededId = await insertSecuredFeature(connection, submissionA, { successorFeatureId: newCurrentId });
    const endedId = await insertSecuredFeature(connection, submissionA, { ended: true });
    const noSelfLoopId = await insertFeatureRow(connection, {
      submissionId: submissionA.submissionId,
      submissionUploadId: submissionA.submissionUploadId,
      featureTypeName: submissionA.featureTypeName,
      parentFeatureId: submissionA.anchorId
    });
    await insertClosureRow(connection, noSelfLoopId, submissionA.anchorId);
    await recomputeAnchors(connection, scope.securityScopeId);

    const service = refreshServiceFor(connection);

    await service.refreshScopeFeatureBitmapForSubmission(scope.securityScopeId, scope.urn, submissionA.submissionId);
    const refreshed = await getBitmap(connection, scope.securityScopeId);

    await service.buildScopeFeatureBitmap(scope.securityScopeId, scope.urn);
    const fullyBuilt = await getBitmap(connection, scope.securityScopeId);

    // Fixture check: the data change reaches a full build, so the comparison below is not between
    // two bitmaps that both missed it.
    expect(fullyBuilt.ids, 'fixture: full build holds the new current secured feature').to.include(newCurrentId);

    expect(refreshed.hex, 'feature_ids::bytea after the refresh vs after a full build').to.equal(fullyBuilt.hex);
    expect(refreshed.isRunOptimised, 'feature_ids::bytea = rb_runoptimize(feature_ids)::bytea after the refresh').to.be
      .true;
    expect(refreshed.ids, 'superseded feature').to.not.include(supersededId);
    expect(refreshed.ids, 'ended feature').to.not.include(endedId);
    expect(refreshed.ids, 'feature with ancestry rows but no closure self-loop').to.not.include(noSelfLoopId);
  });

  // AC7
  it('a refresh on unchanged data does not rewrite the scope row, and a refresh after a data change does', async () => {
    const scope = await seedBuiltScope(connection, 1);
    const [submissionA] = scope.submissions;
    const service = refreshServiceFor(connection);

    const before = await getScopeRowVersion(connection, scope.securityScopeId);

    await service.refreshScopeFeatureBitmapForSubmission(scope.securityScopeId, scope.urn, submissionA.submissionId);

    const afterUnchanged = await getScopeRowVersion(connection, scope.securityScopeId);

    expect(afterUnchanged.xmin, 'xmin after a refresh on unchanged data').to.equal(before.xmin);
    expect(afterUnchanged.ctid, 'ctid after a refresh on unchanged data').to.equal(before.ctid);

    // Control: the same read does see a row that the refresh writes.
    await insertSecuredFeature(connection, submissionA);
    await recomputeAnchors(connection, scope.securityScopeId);

    await service.refreshScopeFeatureBitmapForSubmission(scope.securityScopeId, scope.urn, submissionA.submissionId);

    const afterChanged = await getScopeRowVersion(connection, scope.securityScopeId);

    expect(afterChanged.ctid, 'ctid after a refresh on changed data').to.not.equal(before.ctid);
  });

  // AC8
  it('running the same refresh twice stores the same bytes as running it once', async () => {
    const scope = await seedBuiltScope(connection, 2);
    const [submissionA] = scope.submissions;

    await endFeature(connection, submissionA.secondAnchorId);
    await insertSecuredFeature(connection, submissionA);
    await recomputeAnchors(connection, scope.securityScopeId);

    const service = refreshServiceFor(connection);

    await service.refreshScopeFeatureBitmapForSubmission(scope.securityScopeId, scope.urn, submissionA.submissionId);
    const first = await getBitmap(connection, scope.securityScopeId);

    await service.refreshScopeFeatureBitmapForSubmission(scope.securityScopeId, scope.urn, submissionA.submissionId);
    const second = await getBitmap(connection, scope.securityScopeId);

    expect(second.hex, 'feature_ids::bytea after the second refresh').to.equal(first.hex);
  });

  // Discovery: the full build owns the first build.
  it('a refresh leaves a bitmap that was never built NULL', async () => {
    const scope = await seedBuiltScope(connection, 1);
    const [submissionA] = scope.submissions;

    await connection.sql(SQL`
      UPDATE security_scope
      SET feature_ids = NULL
      WHERE security_scope_id = ${scope.securityScopeId};
    `);

    await refreshServiceFor(connection).refreshScopeFeatureBitmapForSubmission(
      scope.securityScopeId,
      scope.urn,
      submissionA.submissionId
    );

    const result = await connection.sql(SQL`
      SELECT feature_ids IS NULL AS is_null
      FROM security_scope
      WHERE security_scope_id = ${scope.securityScopeId};
    `);

    expect(result.rows[0].is_null, 'feature_ids IS NULL after the refresh').to.be.true;
  });

  // Discovery: zero rows updated is a normal result for the refresh.
  it('a refresh of a scope id that does not exist resolves and writes no other scope', async () => {
    const scope = await seedBuiltScope(connection, 1);
    const [submissionA] = scope.submissions;
    const missingScopeId = randomUUID();

    const before = await getScopeRowVersion(connection, scope.securityScopeId);

    await refreshServiceFor(connection).refreshScopeFeatureBitmapForSubmission(
      missingScopeId,
      scope.urn,
      submissionA.submissionId
    );

    const missing = await connection.sql(SQL`
      SELECT 1 FROM security_scope WHERE security_scope_id = ${missingScopeId};
    `);
    const after = await getScopeRowVersion(connection, scope.securityScopeId);

    expect(missing.rows, 'rows for the missing scope id').to.have.length(0);
    expect(after.ctid, 'ctid of the existing scope').to.equal(before.ctid);
  });

  // AC3
  it('removing one rule from a feature clears the submission from every matching bitmap before the change commits', async () => {
    const fixture = await seedRemovalFixture(connection);
    const { submissionA } = fixture;

    await new SubmissionUploadReviewSecurityService(connection).deleteSubmissionUploadReviewSecurityRuleAssignments(
      submissionA.submissionId,
      submissionA.submissionUploadId,
      fixture.submissionUploadReviewId,
      SEEDED_SECURITY_RULE_ID,
      [submissionA.anchorId]
    );

    // Fixture check: the rule is gone from the selected feature and from no other.
    expect(
      await getRuleAssignments(connection, [submissionA.anchorId, submissionA.secondAnchorId]),
      'fixture: rule assignments after the removal'
    ).to.eql([`${submissionA.secondAnchorId}:${SEEDED_SECURITY_RULE_ID}`]);

    await expectSubmissionARevoked(connection, fixture);
  });

  // AC3
  it("resetting a review's rule assignments clears the submission from every matching bitmap before the change commits", async () => {
    const fixture = await seedRemovalFixture(connection);
    const { submissionA } = fixture;

    await new SubmissionUploadReviewSecurityService(connection).deleteSubmissionUploadReviewSecurityAssignments(
      submissionA.submissionId,
      submissionA.submissionUploadId,
      fixture.submissionUploadReviewId
    );

    // Fixture check: the reset removed every assignment of the upload.
    expect(
      await getRuleAssignments(connection, [submissionA.anchorId, submissionA.secondAnchorId]),
      'fixture: rule assignments after the reset'
    ).to.eql([]);

    await expectSubmissionARevoked(connection, fixture);
  });

  // AC4
  it('after the only rule covering a child is removed, the bitmap grants nothing the anchor check denies, and a refresh restores what the scope still grants', async () => {
    const scope = await seedReviewedSubmissionScope(connection);
    const { submission } = scope;

    await new SubmissionUploadReviewSecurityService(connection).deleteSubmissionUploadReviewSecurityRuleAssignments(
      submission.submissionId,
      submission.submissionUploadId,
      scope.submissionUploadReviewId,
      SEEDED_SECURITY_RULE_ID,
      [submission.anchorId]
    );

    await syncAnchors(connection, scope.securityScopeId);

    const anchorGranted = await getAnchorGrantedIds(connection, scope.securityScopeId, submission.submissionId);

    // Fixture check: the anchor check now grants the second parent and its child, and denies the
    // first parent and its child.
    expect(anchorGranted, 'fixture: features the anchor check grants after the removal').to.eql(
      [submission.secondAnchorId, scope.secondChildId].sort((a, b) => a - b)
    );

    const afterRemoval = await getBitmap(connection, scope.securityScopeId);

    expect(
      afterRemoval.ids.filter((id) => !anchorGranted.includes(id)),
      'ids in feature_ids that the anchor check denies, after the removal and before the refresh'
    ).to.eql([]);
    expect(afterRemoval.ids, 'child covered only through the removed rule, before the refresh').to.not.include(
      submission.childId
    );

    await refreshServiceFor(connection).refreshScopeFeatureBitmapForSubmission(
      scope.securityScopeId,
      scope.urn,
      submission.submissionId
    );

    const afterRefresh = await getBitmap(connection, scope.securityScopeId);

    expect(afterRefresh.ids, 'feature_ids after the refresh vs features the anchor check grants').to.eql(anchorGranted);
  });

  describe('with two connections', function () {
    // Long enough for a lock wait that ends when the first connection commits; short enough that a
    // call that never returns fails the test instead of hanging the suite.
    this.timeout(30000);

    /** How long the second connection's call is left running before the first connection commits. */
    const OVERLAP_MS = 500;

    let firstConnection: IDBConnection | null;
    let secondConnection: IDBConnection | null;
    let committedScope: BuiltScope | null;

    beforeEach(() => {
      firstConnection = null;
      secondConnection = null;
      committedScope = null;
    });

    afterEach(async () => {
      // The first connection goes first: ending its transaction releases anything the second waits on.
      for (const openConnection of [firstConnection, secondConnection]) {
        if (openConnection) {
          await openConnection.rollback();
          openConnection.release();
        }
      }

      if (committedScope) {
        await deleteCommittedScope(committedScope);
      }
    });

    /**
     * Run `write` in a transaction of its own and commit it.
     */
    async function commitRows<T>(write: (db: IDBConnection) => Promise<T>): Promise<T> {
      const db = getAPIUserDBConnection();
      await db.open();

      try {
        const result = await write(db);
        await db.commit();

        return result;
      } catch (error) {
        await db.rollback();
        throw error;
      } finally {
        db.release();
      }
    }

    /**
     * Delete every row a committed `seedBuiltScope` fixture wrote, and every feature later added to
     * its submissions, in foreign-key order. The shared 'SIMS' contributor and 'Integration Ticket
     * Team' the submission helpers reuse are not the fixture's and are left alone.
     */
    async function deleteCommittedScope(scope: BuiltScope): Promise<void> {
      const submissionIds = scope.submissions.map((submission) => submission.submissionId);

      await commitRows(async (db) => {
        const uploads = await db.sql(SQL`
          SELECT upload_id, team_id, ticket_id
          FROM submission_upload
          WHERE submission_id = ANY(${submissionIds}::integer[]);
        `);
        const submissionTeams = await db.sql(SQL`
          SELECT team_id
          FROM submission
          WHERE submission_id = ANY(${submissionIds}::integer[]);
        `);
        const uploadIds: string[] = uploads.rows.map((row) => row.upload_id);
        const ticketIds: string[] = uploads.rows.map((row) => row.ticket_id);
        const teamIds: string[] = [...uploads.rows, ...submissionTeams.rows].map((row) => row.team_id);

        await db.sql(SQL`DELETE FROM security_scope_anchor WHERE security_scope_id = ${scope.securityScopeId};`);
        await db.sql(SQL`DELETE FROM policy_statement WHERE policy_id = ${scope.policyId};`);
        await db.sql(SQL`DELETE FROM policy WHERE policy_id = ${scope.policyId};`);
        await db.sql(SQL`DELETE FROM security_scope WHERE security_scope_id = ${scope.securityScopeId};`);

        await db.sql(SQL`
          DELETE FROM submission_feature_security
          WHERE submission_feature_id IN (
            SELECT submission_feature_id FROM submission_feature WHERE submission_id = ANY(${submissionIds}::integer[])
          );
        `);
        await db.sql(SQL`
          DELETE FROM submission_feature_closure
          WHERE source_submission_feature_id IN (
            SELECT submission_feature_id FROM submission_feature WHERE submission_id = ANY(${submissionIds}::integer[])
          );
        `);
        await db.sql(SQL`
          UPDATE submission_feature
          SET parent_submission_feature_id = NULL, successor_submission_feature_id = NULL
          WHERE submission_id = ANY(${submissionIds}::integer[]);
        `);
        await db.sql(SQL`DELETE FROM submission_feature WHERE submission_id = ANY(${submissionIds}::integer[]);`);
        await db.sql(SQL`DELETE FROM submission_upload WHERE submission_id = ANY(${submissionIds}::integer[]);`);
        await db.sql(SQL`DELETE FROM submission WHERE submission_id = ANY(${submissionIds}::integer[]);`);

        await db.sql(SQL`DELETE FROM ticket_status WHERE ticket_id = ANY(${ticketIds}::uuid[]);`);
        await db.sql(SQL`DELETE FROM ticket WHERE ticket_id = ANY(${ticketIds}::uuid[]);`);
        await db.sql(SQL`DELETE FROM upload WHERE upload_id = ANY(${uploadIds}::uuid[]);`);
        await db.sql(SQL`DELETE FROM team_member WHERE team_id = ANY(${teamIds}::uuid[]);`);
        await db.sql(SQL`DELETE FROM team WHERE team_id = ANY(${teamIds}::uuid[]);`);
        await db.sql(SQL`DELETE FROM feature_type WHERE name = ${scope.featureTypeName};`);
      });
    }

    /**
     * Open a connection with a transaction of its own.
     */
    async function openConnection(): Promise<IDBConnection> {
      const db = getAPIUserDBConnection();
      await db.open();

      return db;
    }

    // AC9
    it('refreshes of two submissions on one scope from overlapping transactions leave both submissions refreshed ids in the bitmap', async () => {
      const scope = await commitRows((db) => seedBuiltScope(db, 2));
      committedScope = scope;
      const [submissionA, submissionB] = scope.submissions;

      const added = await commitRows(async (db) => {
        const newIdOfA = await insertSecuredFeature(db, submissionA);
        const newIdOfB = await insertSecuredFeature(db, submissionB);
        await recomputeAnchors(db, scope.securityScopeId);

        return { newIdOfA, newIdOfB };
      });

      firstConnection = await openConnection();
      secondConnection = await openConnection();

      // Connection 1 refreshes A and stays open.
      await refreshServiceFor(firstConnection).refreshScopeFeatureBitmapForSubmission(
        scope.securityScopeId,
        scope.urn,
        submissionA.submissionId
      );

      // Connection 2 starts refreshing B while connection 1's transaction is still open.
      const pending = refreshServiceFor(secondConnection).refreshScopeFeatureBitmapForSubmission(
        scope.securityScopeId,
        scope.urn,
        submissionB.submissionId
      );
      // Awaited below; this only keeps an early rejection from being reported as unhandled.
      pending.catch(() => undefined);

      await delay(OVERLAP_MS);
      await firstConnection.commit();
      await pending;
      await secondConnection.commit();

      const bitmap = await getBitmap(connection, scope.securityScopeId);

      expect(bitmap.ids, 'new id of submission A').to.include(added.newIdOfA);
      expect(bitmap.ids, 'new id of submission B').to.include(added.newIdOfB);
    });

    // AC11
    it('a full build started while a refresh is uncommitted does not undo the refresh', async () => {
      const scope = await commitRows((db) => seedBuiltScope(db, 1));
      committedScope = scope;
      const [submissionA] = scope.submissions;

      firstConnection = await openConnection();
      secondConnection = await openConnection();

      // Connection 1: change A's features and refresh A, uncommitted.
      const newId = await insertSecuredFeature(firstConnection, submissionA);
      const endedId = submissionA.secondAnchorId;
      await endFeature(firstConnection, endedId);
      await recomputeAnchors(firstConnection, scope.securityScopeId);

      await refreshServiceFor(firstConnection).refreshScopeFeatureBitmapForSubmission(
        scope.securityScopeId,
        scope.urn,
        submissionA.submissionId
      );

      // Connection 2: start a full build of the same scope.
      const pending = new SecurityScopeService(secondConnection).buildScopeFeatureBitmap(
        scope.securityScopeId,
        scope.urn
      );
      // Awaited below; this only keeps an early rejection from being reported as unhandled.
      pending.catch(() => undefined);

      await delay(OVERLAP_MS);
      await firstConnection.commit();
      await pending;
      await secondConnection.commit();

      const afterBoth = await getBitmap(connection, scope.securityScopeId);

      expect(afterBoth.ids, 'new id of submission A').to.include(newId);
      expect(afterBoth.ids, 'ended id of submission A').to.not.include(endedId);

      // One more full build on the same data, on a connection that is rolled back before the cleanup
      // hook runs: the build holds the scope's row lock, which the hook's DELETE would wait on.
      const rebuildConnection = getAPIUserDBConnection();
      await rebuildConnection.open();
      let rebuilt: Awaited<ReturnType<typeof getBitmap>>;

      try {
        await new SecurityScopeService(rebuildConnection).buildScopeFeatureBitmap(scope.securityScopeId, scope.urn);
        rebuilt = await getBitmap(rebuildConnection, scope.securityScopeId);
      } finally {
        await rebuildConnection.rollback();
        rebuildConnection.release();
      }

      expect(afterBoth.hex, 'feature_ids::bytea after both commits vs after one more full build').to.equal(rebuilt.hex);
    });

    // AC12
    it('a refresh started while a rule removal is uncommitted does not put the revoked parent or child back', async () => {
      const scope = await commitRows((db) => seedReviewedSubmissionScope(db));
      committedScope = scope;
      const { submission } = scope;

      try {
        firstConnection = await openConnection();
        secondConnection = await openConnection();

        // Connection 1: remove the rule from the parent, uncommitted.
        await new SubmissionUploadReviewSecurityService(
          firstConnection
        ).deleteSubmissionUploadReviewSecurityRuleAssignments(
          submission.submissionId,
          submission.submissionUploadId,
          scope.submissionUploadReviewId,
          SEEDED_SECURITY_RULE_ID,
          [submission.anchorId]
        );

        // Connection 2: start a refresh of the same submission.
        const pending = refreshServiceFor(secondConnection).refreshScopeFeatureBitmapForSubmission(
          scope.securityScopeId,
          scope.urn,
          submission.submissionId
        );
        // Awaited below; this only keeps an early rejection from being reported as unhandled.
        pending.catch(() => undefined);

        await delay(OVERLAP_MS);
        await firstConnection.commit();
        await pending;
        await secondConnection.commit();

        const bitmap = await getBitmap(connection, scope.securityScopeId);

        expect(bitmap.ids, 'parent the rule was removed from').to.not.include(submission.anchorId);
        expect(bitmap.ids, 'child covered only through the removed rule').to.not.include(submission.childId);
      } finally {
        // The review is this test's own committed row, and the cleanup hook's delete of the upload
        // would fail on it. Both transactions end first, the first connection's before the second's,
        // so nothing holds a lock on the scope or waits on one when the rows are deleted.
        for (const openedConnection of [firstConnection, secondConnection]) {
          if (openedConnection) {
            await openedConnection.rollback();
            openedConnection.release();
          }
        }

        firstConnection = null;
        secondConnection = null;

        await commitRows((db) =>
          db.sql(SQL`
            DELETE FROM submission_upload_review
            WHERE submission_upload_review_id = ${scope.submissionUploadReviewId}::uuid;
          `)
        );
      }
    });
  });
});
