// Integration test for cart submission feature security — verifies the read-paths-only security swap:
// "is this feature secured / accessible" is resolved via the precomputed submission_feature_closure
// (the `isEffectivelySecuredViaClosure` / `isAccessibleToUser` SQL fragments), NOT a live recursive
// parent walk. The cart insert reads that closure to gate secured features, computes the `secured`
// flag on read, and counts all features regardless of security status.
//
// CLOSURE SEEDING CONTRACT (the load-bearing detail these tests pin):
//   The closure is UPLOAD-SCOPED and built by SubmissionFeatureClosureService.computeClosureForUpload.
//   It MUST be populated BEFORE the cart insert, or the fragment finds nothing and every feature reads
//   as unsecured.
//     - A feature's "directly secured" check relies on its closure SELF-LOOP (source = target), which is
//       only created for ACTIVE features (record_end_date IS NULL).
//     - Inherited security relies on parent -> ancestor closure edges, which only exist when parent and
//       child share ONE submission_upload_id (both endpoints must be active features of the same upload).
//   createTestFeature mints a NEW upload per call, so parent/child land in different uploads and the
//   closure cannot link them. The security tests therefore seed features directly under a SHARED upload
//   via createTestUpload + insertFeatureRow, then rebuild the closure AFTER seeding + securing and BEFORE
//   the cart insert (mirrors expression-evaluation.integration.ts, Phase 2).
//
// RISK 1 REGRESSION (the active-guard proof): the cart repo's w_valid_features CTE has a
//   `JOIN submission_feature ... record_end_date IS NULL` guard. A soft-deleted feature has NO closure
//   row (no self-loop), so without the guard the empty closure would read it as unsecured and ADD it.
//   The two "inactive-secured id excluded" tests below secure a feature, soft-delete it, rebuild the
//   closure (now no self-loop for it), and assert the id is NOT added — proving the guard.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: docker compose exec api npm run test:mocha -- --no-config --extension ts \
//        'src/__integration__/db/cart-submission-feature-service.integration.ts'
// Requires: database container running with seed data.

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import { CartRepository } from '../../repositories/cart-repository';
import { CartSubmissionFeatureService } from '../../services/cart-submission-feature-service';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import { createTestUpload } from '../helpers/test-feature-property-helpers';
import { secureFeature, setupFullAccess } from '../helpers/test-rbac-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

describe('Cart submission feature security (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let cartRepo: CartRepository;
  let scopeRepo: SecurityScopeRepository;
  let cartFeatureService: CartSubmissionFeatureService;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    cartRepo = new CartRepository(connection);
    scopeRepo = new SecurityScopeRepository(connection);
    cartFeatureService = new CartSubmissionFeatureService(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  async function createActiveCart(systemUserId: number | null): Promise<string> {
    const cart = await cartRepo.createCart(systemUserId);
    return cart.cart_id;
  }

  let _userSeq = 0;
  /**
   * Create a separate system_user for testing scope access without the API connection user.
   * Note: "system_user" must be quoted — it is a PostgreSQL reserved keyword.
   */
  async function createOtherUser(): Promise<number> {
    const apiUserId = connection.systemUserId();
    const guid = `test-cart-sec-${Date.now()}-${++_userSeq}`;
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
   * Insert ONE submission_feature bound to a SPECIFIC upload, resolving feature_type_id by name.
   *
   * The closure recompute is upload-scoped and only links a parent and child when both share one
   * submission_upload_id (both endpoints must be active features of the same upload). createTestFeature
   * mints its OWN upload per call and cannot place a parent + child under one upload, so the closure-driven
   * cart-security fixtures insert features directly here. `recordEndDate: true` soft-deletes the feature
   * (drops it from the closure's active universe — no self-loop, no edges).
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

  /** Recompute the upload-scoped closure (self-loops + ancestry/property edges) for the given upload. */
  async function rebuildClosure(uploadId: string): Promise<void> {
    await new SubmissionFeatureClosureService(connection).computeClosureForUpload(uploadId);
  }

  /** Soft-delete a feature so it drops out of the closure's active universe. */
  async function softDeleteFeature(submissionFeatureId: number): Promise<void> {
    await connection.sql(SQL`
      UPDATE submission_feature SET record_end_date = now() WHERE submission_feature_id = ${submissionFeatureId};
    `);
  }

  /**
   * Get features currently in a cart via raw SQL (bypasses the service under test).
   */
  async function getCartFeatureIds(cartId: string): Promise<number[]> {
    const result = await connection.sql(SQL`
      SELECT submission_feature_id
      FROM cart_submission_feature
      WHERE cart_id = ${cartId}
      ORDER BY submission_feature_id;
    `);
    return result.rows.map((r: { submission_feature_id: number }) => r.submission_feature_id);
  }

  /**
   * Create a submission with one unsecured and one secured feature under a SHARED upload, rebuild the
   * closure, grant scope access to a new user, add both features to a cart, and return all IDs.
   */
  async function setupSecuredCart(teamName: string): Promise<{
    cartId: string;
    userId: number;
    unsecuredId: number;
    securedId: number;
  }> {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);
    const unsecuredId = await insertFeatureRow({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'dataset'
    });
    const securedId = await insertFeatureRow({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'dataset'
    });
    await secureFeature(connection, securedId);

    await rebuildClosure(uploadId);

    const userId = await createOtherUser();
    await setupFullAccess(connection, scopeRepo, `urn:${submissionId}:*:*`, userId, teamName);

    const cartId = await createActiveCart(userId);
    await cartFeatureService.createCartSubmissionFeatures(cartId, [unsecuredId, securedId], userId);

    return { cartId, userId, unsecuredId, securedId };
  }

  // ── createCartSubmissionFeatures — anonymous ──────────────────────────

  describe('createCartSubmissionFeatures — anonymous', () => {
    it('should add an unsecured feature to cart', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const featureId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'dataset'
      });

      await rebuildClosure(uploadId);

      const cartId = await createActiveCart(null);
      await cartFeatureService.createCartSubmissionFeatures(cartId, [featureId], null);

      const ids = await getCartFeatureIds(cartId);
      expect(ids).to.deep.equal([featureId]);
    });

    it('should exclude a directly secured feature', async () => {
      // Directly secured feature under a shared upload: rebuild the closure so the feature's SELF-LOOP
      // exists, then isEffectivelySecuredViaClosure resolves its own security rule and excludes it.
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const featureId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'dataset'
      });
      await secureFeature(connection, featureId);

      await rebuildClosure(uploadId);

      const cartId = await createActiveCart(null);
      await cartFeatureService.createCartSubmissionFeatures(cartId, [featureId], null);

      const ids = await getCartFeatureIds(cartId);
      expect(ids).to.deep.equal([]);
    });

    it('should exclude a feature with inherited security from a secured parent', async () => {
      // Parent + child share ONE upload so the closure stores the child -> parent ancestor edge;
      // securing the parent then makes the child read as effectively secured (inherited).
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const parentId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'dataset'
      });
      const childId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'species_observation',
        parentFeatureId: parentId
      });
      await secureFeature(connection, parentId);

      await rebuildClosure(uploadId);

      const cartId = await createActiveCart(null);
      await cartFeatureService.createCartSubmissionFeatures(cartId, [childId], null);

      const ids = await getCartFeatureIds(cartId);
      expect(ids).to.deep.equal([]);
    });

    it('should exclude an inactive (soft-deleted) secured id — anonymous (Risk 1 active-guard)', async () => {
      // RISK 1 GUARD. Secure the feature, then soft-delete it. The closure rebuild now writes NO self-loop
      // for it (inactive features are excluded from the active universe), so isEffectivelySecuredViaClosure
      // finds nothing and would read it as UNSECURED. The cart repo's `JOIN submission_feature ...
      // record_end_date IS NULL` active-guard is what excludes the id here — without that guard the empty
      // closure would let the soft-deleted secured id slip into the cart.
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const featureId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'dataset'
      });
      await secureFeature(connection, featureId);
      await softDeleteFeature(featureId);

      await rebuildClosure(uploadId);

      const cartId = await createActiveCart(null);
      await cartFeatureService.createCartSubmissionFeatures(cartId, [featureId], null);

      const ids = await getCartFeatureIds(cartId);
      expect(ids).to.deep.equal([]);
    });

    it('should exclude a 3-level inherited-secured leaf (grandparent secured)', async () => {
      // 3-level chain under ONE upload: grandparent <- parent <- leaf. Secure ONLY the grandparent. The
      // closure stores the transitive leaf -> grandparent ancestor edge (2 hops), so the leaf reads as
      // effectively secured — this is the multi-hop closure ancestry replacing the old recursive walk.
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const grandparentId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'dataset'
      });
      const parentId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'animal',
        parentFeatureId: grandparentId
      });
      const leafId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'capture',
        parentFeatureId: parentId
      });
      await secureFeature(connection, grandparentId);

      await rebuildClosure(uploadId);

      const cartId = await createActiveCart(null);
      await cartFeatureService.createCartSubmissionFeatures(cartId, [leafId], null);

      const ids = await getCartFeatureIds(cartId);
      expect(ids).to.deep.equal([]);
    });
  });

  // ── createCartSubmissionFeatures — authenticated ─────────────────────

  describe('createCartSubmissionFeatures — authenticated', () => {
    it('should add a secured feature when user has scope access', async () => {
      // Closure rebuilt so isAccessibleToUser Branch 2 can resolve the anchor via closure ancestry
      // (the feature's own self-loop is the anchor's closure source here).
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const featureId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'dataset'
      });
      await secureFeature(connection, featureId);

      await rebuildClosure(uploadId);

      const userId = await createOtherUser();
      await setupFullAccess(connection, scopeRepo, `urn:${submissionId}:*:*`, userId, 'scope-access-team');

      const cartId = await createActiveCart(userId);
      await cartFeatureService.createCartSubmissionFeatures(cartId, [featureId], userId);

      const ids = await getCartFeatureIds(cartId);
      expect(ids).to.deep.equal([featureId]);
    });

    it('should exclude a secured feature when user has NO scope access', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const featureId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'dataset'
      });
      await secureFeature(connection, featureId);

      await rebuildClosure(uploadId);

      // User exists but is not a member of any team with scope access
      const userId = await createOtherUser();

      const cartId = await createActiveCart(userId);
      await cartFeatureService.createCartSubmissionFeatures(cartId, [featureId], userId);

      const ids = await getCartFeatureIds(cartId);
      expect(ids).to.deep.equal([]);
    });

    it('should add an unsecured feature with secured: false', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const featureId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'dataset'
      });

      await rebuildClosure(uploadId);

      const userId = await createOtherUser();
      const cartId = await createActiveCart(userId);
      await cartFeatureService.createCartSubmissionFeatures(cartId, [featureId], userId);

      const features = await cartFeatureService.getCartSubmissionFeatures(cartId);
      expect(features).to.have.length(1);
      expect(features[0].submission_feature_id).to.equal(featureId);
      expect(features[0].secured).to.equal(false);
    });

    it('should exclude an inactive (soft-deleted) secured id — authenticated (Risk 1 active-guard)', async () => {
      // RISK 1 GUARD (authenticated path, createCartSubmissionFeaturesWithScopeCheck). Same as the anonymous
      // variant: secure + soft-delete, rebuild the closure (no self-loop for the inactive id). With an empty
      // closure isAccessibleToUser Branch 1 (NOT secured) would be TRUE and ADD the id — the active-guard
      // JOIN on record_end_date IS NULL is what keeps the soft-deleted id out.
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const featureId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'dataset'
      });
      await secureFeature(connection, featureId);
      await softDeleteFeature(featureId);

      await rebuildClosure(uploadId);

      const userId = await createOtherUser();
      const cartId = await createActiveCart(userId);
      await cartFeatureService.createCartSubmissionFeatures(cartId, [featureId], userId);

      const ids = await getCartFeatureIds(cartId);
      expect(ids).to.deep.equal([]);
    });

    it('should add only authorized features from a mixed batch', async () => {
      // All features share ONE upload so the closure links the inherited child to its secured parent and
      // anchors each secured feature for the scope grant. Wildcard URN covers the whole submission.
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);

      // Unsecured feature — always allowed
      const unsecuredId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'dataset'
      });

      // Directly secured feature — user has scope access
      const securedId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'dataset'
      });
      await secureFeature(connection, securedId);

      // Inherited security — parent secured, child has no direct rule (resolved via closure ancestry)
      const securedParentId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'dataset'
      });
      const inheritedChildId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'species_observation',
        parentFeatureId: securedParentId
      });
      await secureFeature(connection, securedParentId);

      await rebuildClosure(uploadId);

      const userId = await createOtherUser();
      // Wildcard URN covers the whole submission — all secured features accessible
      await setupFullAccess(connection, scopeRepo, `urn:${submissionId}:*:*`, userId, 'mixed-batch-team');

      const cartId = await createActiveCart(userId);
      await cartFeatureService.createCartSubmissionFeatures(cartId, [unsecuredId, securedId, inheritedChildId], userId);

      const ids = await getCartFeatureIds(cartId);
      // All three should be added: unsecured passes through, secured + inherited pass via scope access
      expect(ids).to.include.members([unsecuredId, securedId, inheritedChildId]);
      expect(ids).to.have.length(3);
    });

    it('should add only features from the scoped submission when user has partial authorization across submissions', async () => {
      // Each submission gets its OWN shared upload + closure rebuild so each secured feature's self-loop
      // (and any ancestry) exists. The scope grant covers submission A only.
      const submissionA = await createTestSubmission(connection);
      const uploadA = await createTestUpload(connection, submissionA);
      const securedA = await insertFeatureRow({
        submissionId: submissionA,
        submissionUploadId: uploadA,
        featureTypeName: 'dataset'
      });
      await secureFeature(connection, securedA);
      await rebuildClosure(uploadA);

      // Submission B — user has NO scope access
      const submissionB = await createTestSubmission(connection);
      const uploadB = await createTestUpload(connection, submissionB);
      const securedB = await insertFeatureRow({
        submissionId: submissionB,
        submissionUploadId: uploadB,
        featureTypeName: 'dataset'
      });
      await secureFeature(connection, securedB);
      await rebuildClosure(uploadB);

      const userId = await createOtherUser();
      // Grant scope only for submission A
      await setupFullAccess(connection, scopeRepo, `urn:${submissionA}:*:*`, userId, 'partial-auth-team');

      const cartId = await createActiveCart(userId);
      await cartFeatureService.createCartSubmissionFeatures(cartId, [securedA, securedB], userId);

      const ids = await getCartFeatureIds(cartId);
      // Only the feature from the scoped submission should be added
      expect(ids).to.deep.equal([securedA]);
    });
  });

  // ── getCartSubmissionFeatures — secured flag ───────────────────────

  describe('getCartSubmissionFeatures — secured flag', () => {
    it('should return secured: true for secured features and secured: false for unsecured', async () => {
      const { cartId, unsecuredId, securedId } = await setupSecuredCart('secured-flag-team');

      const features = await cartFeatureService.getCartSubmissionFeatures(cartId);
      expect(features).to.have.length(2);

      const unsecuredFeature = features.find((f) => f.submission_feature_id === unsecuredId);
      const securedFeature = features.find((f) => f.submission_feature_id === securedId);

      expect(unsecuredFeature?.secured).to.equal(false);
      expect(securedFeature?.secured).to.equal(true);
    });

    it('should reflect security changes after feature was added to cart', async () => {
      // The read-side `secured` column uses isEffectivelySecuredViaClosure, so the closure must carry the
      // feature's self-loop for the rule to be seen. The closure is rebuilt up front (the feature is active
      // throughout); only the security ROW is added after the cart insert.
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const featureId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'dataset'
      });

      await rebuildClosure(uploadId);

      // Add while unsecured (anonymous can add it)
      const cartId = await createActiveCart(null);
      await cartFeatureService.createCartSubmissionFeatures(cartId, [featureId], null);

      // Verify initially unsecured
      let features = await cartFeatureService.getCartSubmissionFeatures(cartId);
      expect(features[0].secured).to.equal(false);

      // Apply security after the feature is already in the cart (no structural change — closure self-loop
      // already exists, so no rebuild is needed for the read-side fragment to see the new rule).
      await secureFeature(connection, featureId);

      // Read-side fragment should now compute secured: true via the closure self-loop
      features = await cartFeatureService.getCartSubmissionFeatures(cartId);
      expect(features[0].secured).to.equal(true);
    });

    it('should filter by submissionFeatureId when provided', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const featureA = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'dataset'
      });
      const featureB = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'dataset'
      });

      await rebuildClosure(uploadId);

      const cartId = await createActiveCart(null);
      await cartFeatureService.createCartSubmissionFeatures(cartId, [featureA, featureB], null);

      const filtered = await cartFeatureService.getCartSubmissionFeatures(cartId, undefined, featureA);
      expect(filtered).to.have.length(1);
      expect(filtered[0].submission_feature_id).to.equal(featureA);
    });
  });

  // ── getCartSubmissionFeatureCount ──────────────────────────────────

  describe('getCartSubmissionFeatureCount', () => {
    it('should count all features including secured ones', async () => {
      const { cartId } = await setupSecuredCart('count-team');

      const count = await cartFeatureService.getCartSubmissionFeatureCount(cartId);
      expect(count).to.equal(2);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle idempotent add (same feature twice) without error', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const featureId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'dataset'
      });

      await rebuildClosure(uploadId);

      const cartId = await createActiveCart(null);
      await cartFeatureService.createCartSubmissionFeatures(cartId, [featureId], null);
      await cartFeatureService.createCartSubmissionFeatures(cartId, [featureId], null);

      const ids = await getCartFeatureIds(cartId);
      expect(ids).to.deep.equal([featureId]);
    });

    it('should not add features to an inactive (checked-out) cart', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const featureId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'dataset'
      });

      await rebuildClosure(uploadId);

      const cartId = await createActiveCart(null);

      // Mark the cart as checked_out
      await connection.sql(SQL`
        UPDATE cart SET cart_status = 'checked_out' WHERE cart_id = ${cartId};
      `);

      await cartFeatureService.createCartSubmissionFeatures(cartId, [featureId], null);

      const ids = await getCartFeatureIds(cartId);
      expect(ids).to.deep.equal([]);
    });
  });
});
