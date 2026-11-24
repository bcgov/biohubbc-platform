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
// The first four tests write their rows in a transaction that is ROLLED BACK. The two tests under
// "with two connections" need rows other connections can see, so they COMMIT their fixture and
// delete it again in `afterEach`. What stays behind from those two: the audit_log entries the
// journal triggers write for the committed inserts and deletes.
//
// Run: make test-db
// Requires: make web (database must be running, migrations applied)

import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import { SecurityScopeService } from '../../services/access-policy/security-scope-service';
import { SecurityScopeUrn } from '../../services/access-policy/security-scope-service.interface';
import { createTestUpload } from '../helpers/test-feature-property-helpers';
import { computeAnchors, createPolicy, createPolicyStatement, secureFeature } from '../helpers/test-rbac-helpers';
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

      // One more full build on the same data, on the test's rolled-back connection.
      await new SecurityScopeService(connection).buildScopeFeatureBitmap(scope.securityScopeId, scope.urn);
      const rebuilt = await getBitmap(connection, scope.securityScopeId);

      expect(afterBoth.hex, 'feature_ids::bytea after both commits vs after one more full build').to.equal(rebuilt.hex);
    });
  });
});
