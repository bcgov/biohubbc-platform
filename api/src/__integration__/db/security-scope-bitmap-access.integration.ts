// Acceptance tests for SIMSBIOHUB-1211 — search pages, counts and single-feature checks decide access to a
// secured feature from the bitmaps (`security_scope.feature_ids`) of the scopes the caller's active teams hold,
// not from the scopes' anchors.
//
// Every fixture builds its scope with `setupFullAccess` / `setupScopeChain`, which write the scope's anchors AND
// its bitmap, so the two grant stores agree until a test edits the bitmap by SQL. A test that edits only the
// bitmap therefore tells the two readers apart: the anchors still grant what the bitmap no longer holds.
//
// Behaviour is graded through the repository methods the routes call:
//   - search page:      SearchFeatureRepository.searchFeaturesByExpressionTree
//   - counts:           SearchFeatureRepository.countFeaturesByExpressionTree (broad, and with an expression)
//   - feature page:     TeamAuthorizationRepository.isSubmissionFeatureAccessibleToUser
//   - search summary:   SearchRepository.findFeatureSummary
//   - submission list:  SubmissionRepository.getSubmissionFeatures
//
// pg-boss is not running in the make test-db environment, so the scope job publishers are stubbed.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { NormalizedExpressionTree } from '../../models/expression-tree-internal';
import { FEATURE_PROPERTY_TYPE } from '../../models/feature-property';
import { SearchFeatureSecurityContext } from '../../models/search';
import { SearchFeatureCursor } from '../../models/search-feature-pagination';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import { TeamAuthorizationRepository } from '../../repositories/authorization/team-authorization-repository';
import { SearchFeatureRepository } from '../../repositories/search-feature-repository';
import { SearchRepository } from '../../repositories/search-repository';
import { SubmissionRepository } from '../../repositories/submission-repository';
import { PolicyService } from '../../services/access-policy/policy-service';
import { SecurityScopeService } from '../../services/access-policy/security-scope-service';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import {
  addPropertyValue,
  createAssignedFeatureProperty,
  createTestUpload
} from '../helpers/test-feature-property-helpers';
import {
  addTeamMember,
  createPolicy,
  createPolicyStatement,
  createTeam,
  createTeamPolicy,
  secureFeature,
  setupFullAccess,
  setupScopeChain
} from '../helpers/test-rbac-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

// Every fixture feature is a `survey`: it is searchable by type and is one of the search summary's types.
const FEATURE_TYPE = 'survey';

// The string value every fixture feature carries, so one expression matches them all.
const MATCH_VALUE = 'bitmap-access-fixture';

/** A signed-in user's id, or null for an anonymous caller. */
type Caller = number | null;

describe('Security scope bitmap access (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let scopeRepo: SecurityScopeRepository;
  let searchRepo: SearchFeatureRepository;
  let authRepo: TeamAuthorizationRepository;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    scopeRepo = new SecurityScopeRepository(connection);
    searchRepo = new SearchFeatureRepository(connection);
    authRepo = new TeamAuthorizationRepository(connection);

    sinon
      .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
      .resolves({ status: 'published', jobId: 'stub-job-id' });
    sinon
      .stub(SecurityScopeService.dependencies, 'publishComputeScopeFeatureBitmapJob')
      .resolves({ status: 'published', jobId: 'stub-job-id' });
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
    sinon.restore();
  });

  // ── Fixture helpers (copied from security-scope-search.integration.ts where it defines them) ──────────

  /**
   * Insert ONE current submission_feature under a specific upload. The closure is upload-scoped, so features
   * that must share closure rows are inserted under one upload.
   */
  async function insertFeatureRow(params: {
    submissionId: number;
    submissionUploadId: string;
    featureTypeName: string;
    parentFeatureId?: number;
  }): Promise<number> {
    const result = await connection.sql(SQL`
      INSERT INTO submission_feature (
        submission_id,
        submission_upload_id,
        feature_type_id,
        parent_submission_feature_id,
        data,
        data_byte_size,
        record_effective_date
      )
      VALUES (
        ${params.submissionId},
        ${params.submissionUploadId}::uuid,
        (SELECT feature_type_id FROM feature_type WHERE name = ${params.featureTypeName} LIMIT 1),
        ${params.parentFeatureId ?? null},
        '{}'::jsonb,
        500,
        now()
      )
      RETURNING submission_feature_id;
    `);

    return result.rows[0].submission_feature_id;
  }

  /** Recompute the upload-scoped closure. Must run after seeding + securing and before the first read. */
  async function rebuildClosure(uploadId: string): Promise<void> {
    await new SubmissionFeatureClosureService(connection).computeClosureForUpload(uploadId);
  }

  let _userSeq = 0;
  /** Create a signed-in user who is in no team. */
  async function createOtherUser(): Promise<number> {
    const apiUserId = connection.systemUserId();
    const guid = `test-bitmap-${Date.now()}-${++_userSeq}`;
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
   * Mark `predecessorId` superseded by `successorId`, as seedHistoricalFeature does in the neighbouring spec.
   */
  async function supersede(predecessorId: number, successorId: number): Promise<void> {
    await connection.sql(SQL`
      UPDATE submission_feature
      SET successor_submission_feature_id = ${successorId},
          record_end_date = clock_timestamp()
      WHERE submission_feature_id = ${predecessorId};
    `);
  }

  /**
   * Give every feature the same string value under a new `survey` property and return the expression that
   * matches it, so the expression count and the broad count cover the same fixture features.
   */
  async function seedMatchExpression(featureIds: number[]): Promise<NormalizedExpressionTree> {
    const { featurePropertyId, assignments } = await createAssignedFeatureProperty(connection, 'string', [
      FEATURE_TYPE
    ]);
    const assignmentId = assignments[FEATURE_TYPE];

    await connection.query(
      `INSERT INTO submission_feature_property_string (submission_feature_id, blueprint_feature_type_property_id, value)
       SELECT unnest($1::INTEGER[]), $2, $3`,
      [featureIds, assignmentId, MATCH_VALUE]
    );

    const propertyType = await connection.sql(SQL`
      SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string';
    `);

    return {
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: featurePropertyId,
          blueprint_feature_type_property_id: assignmentId,
          feature_property_type_id: propertyType.rows[0].feature_property_type_id,
          feature_property_type_name: FEATURE_PROPERTY_TYPE.STRING,
          operator: 'Equals',
          value: MATCH_VALUE,
          internal_predicate: { type: 'string', operator: 'Equals', value: MATCH_VALUE }
        }
      ]
    };
  }

  /**
   * One submission holding `unsecured` unsecured and `secured` directly secured surveys under one upload,
   * closure rebuilt, with the expression that matches all of them.
   */
  async function seedSurveys(counts: { unsecured: number; secured: number }): Promise<{
    submissionId: number;
    unsecuredIds: number[];
    securedIds: number[];
    expression: NormalizedExpressionTree;
  }> {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);

    const unsecuredIds: number[] = [];
    for (let i = 0; i < counts.unsecured; i++) {
      unsecuredIds.push(
        await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: FEATURE_TYPE })
      );
    }

    const securedIds: number[] = [];
    for (let i = 0; i < counts.secured; i++) {
      const featureId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: FEATURE_TYPE
      });
      await secureFeature(connection, featureId);
      securedIds.push(featureId);
    }

    await rebuildClosure(uploadId);
    const expression = await seedMatchExpression([...unsecuredIds, ...securedIds]);

    return { submissionId, unsecuredIds, securedIds, expression };
  }

  /**
   * AC1's fixture: two unsecured surveys and two secured surveys A and B in one submission, and a user whose
   * team holds `urn:<submission>:*:*`. The scope's anchors and its bitmap both grant A and B.
   */
  async function seedGrantedPair(): Promise<{
    submissionId: number;
    unsecuredIds: number[];
    featureA: number;
    featureB: number;
    expression: NormalizedExpressionTree;
    userId: number;
    scopeId: string;
  }> {
    const { submissionId, unsecuredIds, securedIds, expression } = await seedSurveys({ unsecured: 2, secured: 2 });
    const [featureA, featureB] = securedIds;
    const userId = await createOtherUser();
    const { scopeId } = await setupFullAccess(
      connection,
      scopeRepo,
      `urn:${submissionId}:*:*`,
      userId,
      `Bitmap Pair Team ${randomUUID()}`
    );

    expect(await bitmapHolds(scopeId, featureA), 'fixture: the bitmap holds A').to.be.true;
    expect(await bitmapHolds(scopeId, featureB), 'fixture: the bitmap holds B').to.be.true;
    expect(await anchorCount(scopeId, [featureA, featureB]), 'fixture: A and B are anchors').to.equal(2);

    return { submissionId, unsecuredIds, featureA, featureB, expression, userId, scopeId };
  }

  /**
   * AC6's fixture: one unsecured and one secured survey, and a user granted the secured one through one team
   * holding `urn:<submission>:*:*` on one approved policy.
   */
  async function seedSingleGrant(): Promise<{
    submissionId: number;
    grantedId: number;
    expression: NormalizedExpressionTree;
    userId: number;
    scopeId: string;
    teamId: string;
    policyId: string;
  }> {
    const { submissionId, securedIds, expression } = await seedSurveys({ unsecured: 1, secured: 1 });
    const [grantedId] = securedIds;
    const userId = await createOtherUser();
    const { scopeId, teamId, policyId } = await setupFullAccess(
      connection,
      scopeRepo,
      `urn:${submissionId}:*:*`,
      userId,
      `Bitmap Lost Access Team ${randomUUID()}`
    );

    return { submissionId, grantedId, expression, userId, scopeId, teamId, policyId };
  }

  /**
   * AC7's fixture: a user holding `urn:<submission>:*:*` and three secured surveys that are no longer available —
   * one superseded by a current secured successor, one ended with no successor, one current whose closure rows
   * are all deleted. The scope is built after the three became unavailable.
   */
  async function seedUnavailableFeatures(): Promise<{
    submissionId: number;
    supersededId: number;
    successorId: number;
    endedId: number;
    noClosureId: number;
    expression: NormalizedExpressionTree;
    userId: number;
    scopeId: string;
  }> {
    const submissionId = await createTestSubmission(connection);
    const firstUploadId = await createTestUpload(connection, submissionId);
    const firstUpload = { submissionId, submissionUploadId: firstUploadId, featureTypeName: FEATURE_TYPE };
    const supersededId = await insertFeatureRow(firstUpload);
    const endedId = await insertFeatureRow(firstUpload);
    const noClosureId = await insertFeatureRow(firstUpload);
    for (const featureId of [supersededId, endedId, noClosureId]) {
      await secureFeature(connection, featureId);
    }
    await rebuildClosure(firstUploadId);

    const successorUploadId = await createTestUpload(connection, submissionId);
    const successorId = await insertFeatureRow({
      submissionId,
      submissionUploadId: successorUploadId,
      featureTypeName: FEATURE_TYPE
    });
    await secureFeature(connection, successorId);
    await supersede(supersededId, successorId);

    // Ended with no successor. now() is the transaction's start, so the end date is set before it for the
    // feature to read as ended inside this transaction.
    await connection.sql(SQL`
      UPDATE submission_feature
      SET record_effective_date = now() - INTERVAL '2 days',
          record_end_date = now() - INTERVAL '1 day'
      WHERE submission_feature_id = ${endedId};
    `);

    await rebuildClosure(successorUploadId);

    await connection.sql(SQL`
      DELETE FROM submission_feature_closure
      WHERE source_submission_feature_id = ${noClosureId}
         OR target_submission_feature_id = ${noClosureId};
    `);

    const expression = await seedMatchExpression([supersededId, successorId, endedId, noClosureId]);

    const userId = await createOtherUser();
    const { scopeId } = await setupFullAccess(
      connection,
      scopeRepo,
      `urn:${submissionId}:*:*`,
      userId,
      `Bitmap Stale Team ${randomUUID()}`
    );

    return { submissionId, supersededId, successorId, endedId, noClosureId, expression, userId, scopeId };
  }

  // ── Bitmap helpers ───────────────────────────────────────────────────────────────────────────────────

  async function takeOutOfBitmap(scopeId: string, featureId: number): Promise<void> {
    await connection.sql(SQL`
      UPDATE security_scope
      SET feature_ids = rb_andnot(feature_ids, rb_build(ARRAY[${featureId}]::integer[]))
      WHERE security_scope_id = ${scopeId};
    `);
    expect(await bitmapHolds(scopeId, featureId), `fixture: ${featureId} is out of the bitmap`).to.be.false;
  }

  async function putInBitmap(scopeId: string, featureIds: number[]): Promise<void> {
    await connection.sql(SQL`
      UPDATE security_scope
      SET feature_ids = rb_or(feature_ids, rb_build(${featureIds}::integer[]))
      WHERE security_scope_id = ${scopeId};
    `);
    for (const featureId of featureIds) {
      expect(await bitmapHolds(scopeId, featureId), `fixture: ${featureId} is in the bitmap`).to.be.true;
    }
  }

  /** Whether the scope's stored bitmap holds the id. False for a NULL bitmap. */
  async function bitmapHolds(scopeId: string, featureId: number): Promise<boolean> {
    const result = await connection.sql(SQL`
      SELECT COALESCE(rb_contains(feature_ids, ${featureId}::integer), false) AS holds
      FROM security_scope
      WHERE security_scope_id = ${scopeId};
    `);
    return result.rows[0].holds;
  }

  /** How many of the features are anchors of the scope. */
  async function anchorCount(scopeId: string, featureIds: number[]): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT count(*)::integer AS count
      FROM security_scope_anchor
      WHERE security_scope_id = ${scopeId}
        AND anchor_submission_feature_id = ANY(${featureIds}::integer[]);
    `);
    return result.rows[0].count;
  }

  // ── Read helpers ─────────────────────────────────────────────────────────────────────────────────────

  function securityContext(caller: Caller): SearchFeatureSecurityContext {
    return caller === null ? { type: 'anonymous' } : { type: 'user', systemUserId: caller };
  }

  /** The ids a search page returns for the submission's surveys. */
  async function searchIds(submissionId: number, caller: Caller): Promise<number[]> {
    const rows = await searchRepo.searchFeaturesByExpressionTree(
      FEATURE_TYPE,
      null,
      undefined,
      securityContext(caller),
      { submissionIds: [submissionId] }
    );
    return rows.map((row) => row.submission_feature_id);
  }

  /** The broad count (no expression) and the expression count for the submission's surveys. */
  async function readCounts(
    submissionId: number,
    expression: NormalizedExpressionTree,
    caller: Caller
  ): Promise<{ broad: number; expression: number }> {
    const filters = { submissionIds: [submissionId] };
    const broad = await searchRepo.countFeaturesByExpressionTree(FEATURE_TYPE, null, securityContext(caller), filters);
    const withExpression = await searchRepo.countFeaturesByExpressionTree(
      FEATURE_TYPE,
      expression,
      securityContext(caller),
      filters
    );
    return { broad, expression: withExpression };
  }

  /** The single-feature check behind the feature page. */
  async function canOpen(caller: Caller, featureId: number, submissionId: number): Promise<boolean> {
    return authRepo.isSubmissionFeatureAccessibleToUser(caller, featureId, submissionId);
  }

  // ── AC1 ──────────────────────────────────────────────────────────────────────────────────────────────

  it('AC1: access follows the bitmap, not the anchors', async () => {
    const { submissionId, featureA, featureB, expression, userId, scopeId } = await seedGrantedPair();

    const countsBefore = await readCounts(submissionId, expression, userId);
    const searchBefore = await searchIds(submissionId, userId);
    expect(searchBefore, 'search returns A while it is in the bitmap').to.include(featureA);
    expect(searchBefore, 'search returns B while it is in the bitmap').to.include(featureB);
    expect(countsBefore, 'both counts cover the 2 unsecured and 2 granted features').to.deep.equal({
      broad: 4,
      expression: 4
    });

    // Take B out of the bitmap. Its anchor row stays, so the anchors still grant it.
    await takeOutOfBitmap(scopeId, featureB);
    expect(await anchorCount(scopeId, [featureA, featureB]), 'the anchor rows are untouched').to.equal(2);

    const searchAfter = await searchIds(submissionId, userId);
    const countsAfter = await readCounts(submissionId, expression, userId);

    expect(searchAfter, 'search still returns A').to.include(featureA);
    expect(await canOpen(userId, featureA, submissionId), "A's single-feature check").to.be.true;

    expect(searchAfter, 'search no longer returns B once its id is out of the bitmap').to.not.include(featureB);
    expect(countsAfter.broad, 'broad count is one lower once B is out of the bitmap').to.equal(countsBefore.broad - 1);
    expect(countsAfter.expression, 'expression count is one lower once B is out of the bitmap').to.equal(
      countsBefore.expression - 1
    );
    expect(await canOpen(userId, featureB, submissionId), "B's single-feature check once out of the bitmap").to.be
      .false;
  });

  // ── AC2 ──────────────────────────────────────────────────────────────────────────────────────────────

  describe('AC2: unsecured for everyone, secured for no one without a grant', () => {
    const callers: { name: string; resolve: () => Promise<Caller> }[] = [
      { name: 'an anonymous caller', resolve: async () => null },
      { name: 'a signed-in user in no team', resolve: () => createOtherUser() }
    ];

    for (const { name, resolve } of callers) {
      it(`AC2: ${name} gets exactly the unsecured features`, async () => {
        const { submissionId, unsecuredIds, securedIds, expression } = await seedSurveys({ unsecured: 2, secured: 2 });
        const caller = await resolve();

        expect(
          await searchIds(submissionId, caller),
          'search returns exactly the two unsecured features'
        ).to.have.members(unsecuredIds);
        expect(await readCounts(submissionId, expression, caller), 'both counts are 2').to.deep.equal({
          broad: 2,
          expression: 2
        });

        for (const featureId of unsecuredIds) {
          expect(await canOpen(caller, featureId, submissionId), `unsecured feature ${featureId}`).to.be.true;
        }
        for (const featureId of securedIds) {
          expect(await canOpen(caller, featureId, submissionId), `secured feature ${featureId}`).to.be.false;
        }
      });
    }
  });

  // ── AC4 ──────────────────────────────────────────────────────────────────────────────────────────────

  it('AC4: same results as the anchors with 1,000 scopes', async function () {
    this.timeout(120000);

    const GRANTED = 1000;
    const UNGRANTED = 20;
    const UNSECURED = 20;
    const PAGE_SIZE = 250;

    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);

    const inserted = await connection.query<{ submission_feature_id: number }>(
      `INSERT INTO submission_feature (submission_id, submission_upload_id, feature_type_id, data, data_byte_size, record_effective_date)
       SELECT
         $1::INTEGER,
         $2::UUID,
         (SELECT feature_type_id FROM feature_type WHERE name = $3 LIMIT 1),
         '{}'::jsonb,
         500,
         now()
       FROM generate_series(1, $4)
       RETURNING submission_feature_id`,
      [submissionId, uploadId, FEATURE_TYPE, GRANTED + UNGRANTED + UNSECURED]
    );
    const allIds = inserted.rows.map((row) => row.submission_feature_id).sort((a, b) => a - b);
    const grantedIds = allIds.slice(0, GRANTED);
    const ungrantedIds = allIds.slice(GRANTED, GRANTED + UNGRANTED);
    const unsecuredIds = allIds.slice(GRANTED + UNGRANTED);

    await connection.query(
      `INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, create_user)
       SELECT unnest($1::INTEGER[]), 1, $2`,
      [[...grantedIds, ...ungrantedIds], connection.systemUserId()]
    );
    await rebuildClosure(uploadId);
    const expression = await seedMatchExpression(allIds);

    // 1,000 statements on one approved policy, each its own scope naming one feature; one team, one member.
    const policyId = await createPolicy(connection, `bitmap-many-scopes-${randomUUID()}`);
    for (const featureId of grantedIds) {
      const urn = `urn:${submissionId}:${FEATURE_TYPE}:${featureId}`;
      const statementId = await createPolicyStatement(connection, policyId, urn);
      await setupScopeChain(scopeRepo, statementId, urn);
    }
    const userId = await createOtherUser();
    const teamId = await createTeam(connection, `Bitmap Many Scopes Team ${randomUUID()}`);
    await addTeamMember(connection, teamId, userId);
    await createTeamPolicy(connection, teamId, policyId);
    await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyId);

    const heldScopes = await connection.sql(SQL`
      SELECT count(*)::integer AS count FROM team_security_scope WHERE team_id = ${teamId};
    `);
    expect(heldScopes.rows[0].count, 'fixture: the team holds 1,000 scopes').to.equal(GRANTED);

    // The expected visible set, from the stored anchors: unsecured current features, plus current features
    // with a self-loop that have a closure ancestor in security_scope_anchor for a scope the team holds.
    // The fixture is flat (no parents), so a feature is unsecured when it carries no live security row itself.
    const expectedResult = await connection.sql(SQL`
      SELECT sf.submission_feature_id
      FROM submission_feature sf
      WHERE sf.submission_id = ${submissionId}
        AND sf.record_effective_date <= now()
        AND sf.record_end_date IS NULL
        AND sf.successor_submission_feature_id IS NULL
        AND (
          NOT EXISTS (
            SELECT 1
            FROM submission_feature_security sfs
            WHERE sfs.submission_feature_id = sf.submission_feature_id
              AND sfs.record_end_date IS NULL
          )
          OR (
            EXISTS (
              SELECT 1
              FROM submission_feature_closure self
              WHERE self.source_submission_feature_id = sf.submission_feature_id
                AND self.target_submission_feature_id = sf.submission_feature_id
            )
            AND EXISTS (
              SELECT 1
              FROM submission_feature_closure c
              JOIN security_scope_anchor a ON a.anchor_submission_feature_id = c.target_submission_feature_id
              JOIN team_security_scope tss ON tss.security_scope_id = a.security_scope_id
              WHERE c.source_submission_feature_id = sf.submission_feature_id
                AND c.is_ancestor = true
                AND tss.team_id = ${teamId}
            )
          )
        );
    `);
    const expectedIds: number[] = expectedResult.rows.map(
      (row: { submission_feature_id: number }) => row.submission_feature_id
    );
    expect(expectedIds, 'fixture: the anchors grant the 1,000 named features plus the 20 unsecured').to.have.members([
      ...grantedIds,
      ...unsecuredIds
    ]);

    // Search, paged to the end.
    const returnedIds: number[] = [];
    let boundary: SearchFeatureCursor | undefined;
    for (let page = 0; page <= allIds.length / PAGE_SIZE + 1; page++) {
      const rows = await searchRepo.searchFeaturesByExpressionTree(
        FEATURE_TYPE,
        null,
        { sort: 'submission_feature_id', order: 'asc', limit: PAGE_SIZE, boundary },
        securityContext(userId),
        { submissionIds: [submissionId] }
      );
      if (rows.length === 0) {
        break;
      }
      expect(rows.length, 'a page holds at most the page size').to.be.at.most(PAGE_SIZE);
      returnedIds.push(...rows.map((row) => row.submission_feature_id));
      const last = rows[rows.length - 1];
      boundary = {
        direction: 'next',
        submission_feature_id: last.submission_feature_id,
        create_date: last.create_date
      };
    }

    expect(returnedIds, 'search returns exactly the set the anchors grant').to.have.members(expectedIds);
    expect(returnedIds.length, 'search returns no feature twice').to.equal(expectedIds.length);

    expect(await readCounts(submissionId, expression, userId), 'both counts equal the expected set size').to.deep.equal(
      { broad: expectedIds.length, expression: expectedIds.length }
    );

    for (let i = 0; i < 10; i++) {
      const featureId = grantedIds[i * 100];
      expect(await canOpen(userId, featureId, submissionId), `granted feature ${featureId}`).to.be.true;
    }
    for (const featureId of ungrantedIds) {
      expect(await canOpen(userId, featureId, submissionId), `ungranted secured feature ${featureId}`).to.be.false;
    }
  });

  // ── AC5 ──────────────────────────────────────────────────────────────────────────────────────────────

  it('AC5: counts read the bitmap', async () => {
    const { submissionId, featureB, expression, userId, scopeId } = await seedGrantedPair();

    const before = await readCounts(submissionId, expression, userId);
    await takeOutOfBitmap(scopeId, featureB);
    const after = await readCounts(submissionId, expression, userId);

    expect(after.broad, 'broad count drops by exactly 1').to.equal(before.broad - 1);
    expect(after.expression, 'expression count drops by exactly 1').to.equal(before.expression - 1);
  });

  // ── AC6 ──────────────────────────────────────────────────────────────────────────────────────────────

  describe('AC6: lost access takes effect on the next query', () => {
    type SingleGrant = Awaited<ReturnType<typeof seedSingleGrant>>;

    async function expectGranted(fixture: SingleGrant): Promise<{ broad: number; expression: number }> {
      const { submissionId, grantedId, expression, userId } = fixture;
      const counts = await readCounts(submissionId, expression, userId);

      expect(await searchIds(submissionId, userId), 'before: search returns the granted feature').to.include(grantedId);
      expect(counts, 'before: both counts cover the unsecured and the granted feature').to.deep.equal({
        broad: 2,
        expression: 2
      });
      expect(await canOpen(userId, grantedId, submissionId), 'before: single-feature check').to.be.true;

      return counts;
    }

    async function expectRevoked(
      fixture: SingleGrant,
      countsBefore: { broad: number; expression: number }
    ): Promise<void> {
      const { submissionId, grantedId, expression, userId, scopeId } = fixture;

      // No bitmap was rebuilt: the scope's bitmap still holds the id.
      expect(await bitmapHolds(scopeId, grantedId), "the scope's bitmap still holds the id").to.be.true;

      const countsAfter = await readCounts(submissionId, expression, userId);
      expect(await searchIds(submissionId, userId), 'after: search no longer returns the feature').to.not.include(
        grantedId
      );
      expect(countsAfter.broad, 'after: broad count is one lower').to.equal(countsBefore.broad - 1);
      expect(countsAfter.expression, 'after: expression count is one lower').to.equal(countsBefore.expression - 1);
      expect(await canOpen(userId, grantedId, submissionId), 'after: single-feature check').to.be.false;
    }

    it('AC6a: ending the team membership revokes on the next query', async () => {
      const fixture = await seedSingleGrant();
      const countsBefore = await expectGranted(fixture);

      await connection.sql(SQL`
        UPDATE team_member
        SET record_end_date = now()
        WHERE team_id = ${fixture.teamId}::uuid
          AND system_user_id = ${fixture.userId}
          AND record_end_date IS NULL;
      `);

      await expectRevoked(fixture, countsBefore);
    });

    it("AC6b: ending the team's link to the scope revokes on the next query", async () => {
      const fixture = await seedSingleGrant();
      const countsBefore = await expectGranted(fixture);

      await connection.sql(SQL`
        DELETE FROM team_security_scope
        WHERE team_id = ${fixture.teamId}::uuid
          AND security_scope_id = ${fixture.scopeId}::uuid;
      `);

      await expectRevoked(fixture, countsBefore);
    });

    it('AC6c: moving the policy out of approved revokes on the next query', async () => {
      const fixture = await seedSingleGrant();
      const countsBefore = await expectGranted(fixture);

      await new PolicyService(connection).updatePolicy(fixture.policyId, { status: 'reviewed' });

      await expectRevoked(fixture, countsBefore);
    });
  });

  // ── AC7 ──────────────────────────────────────────────────────────────────────────────────────────────

  it("AC7: stale ids don't bring features back in search and counts", async () => {
    const { submissionId, supersededId, successorId, endedId, noClosureId, expression, userId, scopeId } =
      await seedUnavailableFeatures();
    const staleIds = [supersededId, endedId, noClosureId];

    const searchBefore = await searchIds(submissionId, userId);
    const countsBefore = await readCounts(submissionId, expression, userId);
    expect(searchBefore, 'fixture: the current successor is granted and returned').to.include(successorId);
    for (const featureId of staleIds) {
      expect(searchBefore, `before: search does not return ${featureId}`).to.not.include(featureId);
    }

    await putInBitmap(scopeId, staleIds);

    const searchAfter = await searchIds(submissionId, userId);
    const countsAfter = await readCounts(submissionId, expression, userId);
    expect(searchAfter, 'after: search still returns the current successor').to.include(successorId);
    for (const featureId of staleIds) {
      expect(searchAfter, `after: search does not return stale id ${featureId}`).to.not.include(featureId);
    }
    expect(countsAfter.broad, 'broad count is the same with the stale ids in the bitmap').to.equal(countsBefore.broad);
    expect(countsAfter.expression, 'expression count is the same with the stale ids in the bitmap').to.equal(
      countsBefore.expression
    );
  });

  // ── AC8 ──────────────────────────────────────────────────────────────────────────────────────────────

  it("AC8: stale ids don't bring feature pages back", async () => {
    const { submissionId, supersededId, successorId, endedId, noClosureId, userId, scopeId } =
      await seedUnavailableFeatures();
    await putInBitmap(scopeId, [supersededId, endedId, noClosureId]);

    expect(await canOpen(userId, endedId, submissionId), 'the ended feature').to.be.false;
    expect(await canOpen(userId, noClosureId, submissionId), 'the feature with no closure rows').to.be.false;

    expect(await bitmapHolds(scopeId, successorId), "fixture: the bitmap holds the successor's id").to.be.true;
    expect(
      await canOpen(userId, supersededId, submissionId),
      "the superseded feature while its successor's id is in the bitmap"
    ).to.be.true;

    await takeOutOfBitmap(scopeId, successorId);
    expect(
      await canOpen(userId, supersededId, submissionId),
      "the superseded feature once its successor's id is out of the bitmap"
    ).to.be.false;
  });

  // ── AC9 ──────────────────────────────────────────────────────────────────────────────────────────────

  it('AC9: a granted id without a self-loop grants nothing', async () => {
    // One current survey, secured directly, with no parent: it has no secured ancestor and is its own anchor.
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);
    const featureId = await insertFeatureRow({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: FEATURE_TYPE
    });
    await secureFeature(connection, featureId);
    await rebuildClosure(uploadId);

    // A value only this feature carries, so the search summary's keyword matches nothing else.
    const keyword = `bitmap-self-loop-${randomUUID()}`;
    const { assignments } = await createAssignedFeatureProperty(connection, 'string', [FEATURE_TYPE]);
    await addPropertyValue(connection, 'string', featureId, assignments[FEATURE_TYPE], keyword);

    const userId = await createOtherUser();
    const { scopeId } = await setupFullAccess(
      connection,
      scopeRepo,
      `urn:${submissionId}:*:*`,
      userId,
      `Bitmap Self Loop Team ${randomUUID()}`
    );
    expect(await bitmapHolds(scopeId, featureId), 'fixture: the bitmap holds the feature').to.be.true;
    expect(await anchorCount(scopeId, [featureId]), 'fixture: the feature is its own anchor').to.equal(1);

    const summaryRepo = new SearchRepository(connection);
    const submissionRepo = new SubmissionRepository(connection);
    const listedIds = async () =>
      (await submissionRepo.getSubmissionFeatures(submissionId, userId)).map((row) => row.submission_feature_id);

    // Control: with the self-loop present the feature is in all three.
    expect(await summaryRepo.findFeatureSummary({ keyword }, userId), 'control: search summary').to.deep.equal([
      { feature_type_name: FEATURE_TYPE, total: 1 }
    ]);
    expect(await listedIds(), 'control: submission feature list').to.include(featureId);
    expect(await canOpen(userId, featureId, submissionId), 'control: single-feature check').to.be.true;

    // Delete only its self-loop row; the bitmap stays as built.
    const deleted = await connection.sql(SQL`
      DELETE FROM submission_feature_closure
      WHERE source_submission_feature_id = ${featureId}
        AND target_submission_feature_id = ${featureId};
    `);
    expect(deleted.rowCount, 'fixture: the self-loop row was deleted').to.equal(1);
    expect(await bitmapHolds(scopeId, featureId), 'fixture: the bitmap still holds the feature').to.be.true;

    expect(
      await summaryRepo.findFeatureSummary({ keyword }, userId),
      'search summary without the self-loop'
    ).to.deep.equal([]);
    expect(await listedIds(), 'submission feature list without the self-loop').to.not.include(featureId);
    expect(await canOpen(userId, featureId, submissionId), 'single-feature check without the self-loop').to.be.false;
  });

  // ── AC10 ─────────────────────────────────────────────────────────────────────────────────────────────

  it('AC10: a NULL bitmap grants nothing', async () => {
    const { submissionId, unsecuredIds, featureA, featureB, expression, userId, scopeId } = await seedGrantedPair();

    // The bitmap was never built; the anchors stay in place.
    await connection.sql(SQL`
      UPDATE security_scope SET feature_ids = NULL WHERE security_scope_id = ${scopeId};
    `);
    expect(await anchorCount(scopeId, [featureA, featureB]), 'the anchor rows are untouched').to.equal(2);

    // Every call resolves without error (a rejection fails the test here).
    const returned = await searchIds(submissionId, userId);
    const counts = await readCounts(submissionId, expression, userId);
    const openA = await canOpen(userId, featureA, submissionId);
    const openB = await canOpen(userId, featureB, submissionId);

    expect(returned, 'search returns exactly the unsecured features under a NULL bitmap').to.have.members(unsecuredIds);
    expect(counts, 'neither secured feature is counted under a NULL bitmap').to.deep.equal({
      broad: 2,
      expression: 2
    });
    expect(openA, "A's single-feature check under a NULL bitmap").to.be.false;
    expect(openB, "B's single-feature check under a NULL bitmap").to.be.false;
  });

  // ── AC13 ─────────────────────────────────────────────────────────────────────────────────────────────

  it('AC13: securing the current version secures every older version', async () => {
    // One feature with three versions in one submission: A superseded by B, B superseded by C; C is current and
    // secured. Each version is in its own upload, built as seedHistoricalFeature builds a superseded feature.
    const submissionId = await createTestSubmission(connection);

    const uploadA = await createTestUpload(connection, submissionId);
    const versionA = await insertFeatureRow({
      submissionId,
      submissionUploadId: uploadA,
      featureTypeName: FEATURE_TYPE
    });
    await rebuildClosure(uploadA);

    const uploadB = await createTestUpload(connection, submissionId);
    const versionB = await insertFeatureRow({
      submissionId,
      submissionUploadId: uploadB,
      featureTypeName: FEATURE_TYPE
    });
    await supersede(versionA, versionB);
    await rebuildClosure(uploadB);

    const uploadC = await createTestUpload(connection, submissionId);
    const versionC = await insertFeatureRow({
      submissionId,
      submissionUploadId: uploadC,
      featureTypeName: FEATURE_TYPE
    });
    await secureFeature(connection, versionC);
    await supersede(versionB, versionC);
    await rebuildClosure(uploadC);

    const holderId = await createOtherUser();
    const outsiderId = await createOtherUser();
    const { scopeId } = await setupFullAccess(
      connection,
      scopeRepo,
      `urn:${submissionId}:*:*`,
      holderId,
      `Bitmap Versions Team ${randomUUID()}`
    );
    expect(await bitmapHolds(scopeId, versionC), "fixture: the bitmap holds C's id").to.be.true;

    const olderVersions = [
      { name: 'A', featureId: versionA },
      { name: 'B', featureId: versionB }
    ];

    for (const { name, featureId } of olderVersions) {
      expect(await canOpen(holderId, featureId, submissionId), `${name}, scope holder, C in the bitmap`).to.be.true;
      expect(await canOpen(outsiderId, featureId, submissionId), `${name}, user in no team, C in the bitmap`).to.be
        .false;
      expect(await canOpen(null, featureId, submissionId), `${name}, anonymous, C in the bitmap`).to.be.false;
    }

    await takeOutOfBitmap(scopeId, versionC);

    for (const { name, featureId } of olderVersions) {
      expect(await canOpen(holderId, featureId, submissionId), `${name}, scope holder, C out of the bitmap`).to.be
        .false;
      expect(await canOpen(outsiderId, featureId, submissionId), `${name}, user in no team, C out of the bitmap`).to.be
        .false;
      expect(await canOpen(null, featureId, submissionId), `${name}, anonymous, C out of the bitmap`).to.be.false;
    }
  });
});
