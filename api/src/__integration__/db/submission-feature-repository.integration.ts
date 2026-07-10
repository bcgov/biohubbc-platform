// Integration test for SubmissionFeatureRepository.getSubmissionFeatureById — verifies the
// effectively-secured (`secured`) and `security_reasons` SQL against the real database.
//
// `secured` is isEffectivelySecured(...): an EXISTS over the closure ancestry for an active,
// non-end-dated security rule, PLUS a fail-closed `OR NOT EXISTS (self-loop (F, F))` branch that
// treats a feature with no closure rows as secured. `security_reasons` is the distinct set of active
// security_rule names across that same closure ancestry, alphabetical, `[]` when none. These
// scenarios exercise: direct security, inherited security via parent/grandparent ancestry, dedup,
// draft/end-dated security exclusion, multi-rule alphabetical ordering, and the fail-closed
// no-closure case.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: the queue/db containers that make test-db starts (database running with seed data)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SubmissionFeatureRepository } from '../../repositories/submission-feature-repository';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import { createTestUpload } from '../helpers/test-feature-property-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

describe('SubmissionFeatureRepository (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let repo: SubmissionFeatureRepository;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    repo = new SubmissionFeatureRepository(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  /**
   * Insert ONE active submission_feature bound to a SPECIFIC upload, resolving feature_type_id by name.
   *
   * record_effective_date = now() is MANDATORY — without it isSubmissionFeatureActive('sf') excludes the
   * row and getSubmissionFeatureById throws (rowCount !== 1). uuid/urn auto-fill via default/trigger.
   * Mirrors the insertFeatureRow helper in security-scope-search.integration.ts.
   *
   * @returns The new submission_feature_id.
   */
  async function insertFeatureRow(params: {
    submissionId: number;
    submissionUploadId: string;
    featureTypeName: string;
    parentFeatureId?: number;
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
        ${systemUserId}
      )
      RETURNING submission_feature_id;
    `);

    return result.rows[0].submission_feature_id;
  }

  /**
   * Insert one active-window security row on a feature, resolving security_rule_id by name.
   *
   * Unlike the shared secureFeature helper (which hardcodes rule 1), this resolves the rule by name so
   * the security_reasons assertions read real rule names. `status` defaults to 'active' and
   * `recordEndDate` to NULL — pass 'draft' / a past date to exercise the exclusion branches.
   */
  async function insertSecurity(
    submissionFeatureId: number,
    ruleName: string,
    options?: { status?: 'active' | 'draft'; recordEndDate?: string }
  ): Promise<void> {
    const systemUserId = connection.systemUserId();

    await connection.sql(SQL`
      INSERT INTO submission_feature_security (
        submission_feature_id,
        security_rule_id,
        create_user,
        status,
        record_end_date
      )
      VALUES (
        ${submissionFeatureId},
        (SELECT security_rule_id FROM security_rule WHERE name = ${ruleName} LIMIT 1),
        ${systemUserId},
        ${options?.status ?? 'active'},
        ${options?.recordEndDate ?? null}
      );
    `);
  }

  /** Build the upload-scoped closure (self-loops + ancestor edges) so the read-path fragments resolve. */
  async function buildClosure(uploadId: string): Promise<void> {
    await new SubmissionFeatureClosureService(connection).computeClosureForUpload(uploadId);
  }

  /** Create a single `dataset` feature under its own upload. */
  async function createFeature(): Promise<{ uploadId: string; featureId: number }> {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);
    const featureId = await insertFeatureRow({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'dataset'
    });
    return { uploadId, featureId };
  }

  /** Create a parent + child `dataset` feature co-located under one upload (child inherits via the closure). */
  async function createParentChild(): Promise<{ uploadId: string; parentId: number; childId: number }> {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);
    const parentId = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'dataset' });
    const childId = await insertFeatureRow({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'dataset',
      parentFeatureId: parentId
    });
    return { uploadId, parentId, childId };
  }

  // ── Scenarios ────────────────────────────────────────────────────────

  it('1. direct active security → secured, security_reasons = [rule]', async () => {
    const { uploadId, featureId } = await createFeature();
    await insertSecurity(featureId, 'Moose');
    await buildClosure(uploadId);

    const result = await repo.getSubmissionFeatureById(featureId);

    expect(result.secured).to.equal(true);
    expect(result.security_reasons).to.deep.equal(['Moose']);
  });

  it('2. security inherited from parent → child is secured with parent reason', async () => {
    const { uploadId, parentId, childId } = await createParentChild();
    await insertSecurity(parentId, 'Mineral Lick Locations');
    await buildClosure(uploadId);

    const result = await repo.getSubmissionFeatureById(childId);

    expect(result.secured).to.equal(true);
    expect(result.security_reasons).to.deep.equal(['Mineral Lick Locations']);
  });

  it('3. parent + child with no security → child is not secured, no reasons', async () => {
    const { uploadId, childId } = await createParentChild();
    await buildClosure(uploadId);

    const result = await repo.getSubmissionFeatureById(childId);

    expect(result.secured).to.equal(false);
    expect(result.security_reasons).to.deep.equal([]);
  });

  it('4. grandparent + parent both secured with same rule → child deduped to one reason', async () => {
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
      featureTypeName: 'dataset',
      parentFeatureId: grandparentId
    });
    const childId = await insertFeatureRow({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'dataset',
      parentFeatureId: parentId
    });
    await insertSecurity(grandparentId, 'Moose');
    await insertSecurity(parentId, 'Moose');
    await buildClosure(uploadId);

    const result = await repo.getSubmissionFeatureById(childId);

    expect(result.secured).to.equal(true);
    expect(result.security_reasons).to.deep.equal(['Moose']);
  });

  it('5a. draft security → not secured, no reasons', async () => {
    const { uploadId, featureId } = await createFeature();
    await insertSecurity(featureId, 'Moose', { status: 'draft' });
    await buildClosure(uploadId);

    const result = await repo.getSubmissionFeatureById(featureId);

    expect(result.secured).to.equal(false);
    expect(result.security_reasons).to.deep.equal([]);
  });

  it('5b. end-dated security → not secured, no reasons', async () => {
    const { uploadId, featureId } = await createFeature();
    await insertSecurity(featureId, 'Moose', { recordEndDate: '2020-01-01' });
    await buildClosure(uploadId);

    const result = await repo.getSubmissionFeatureById(featureId);

    expect(result.secured).to.equal(false);
    expect(result.security_reasons).to.deep.equal([]);
  });

  it('6. two active security rules → secured, reasons sorted alphabetically', async () => {
    const { uploadId, featureId } = await createFeature();
    await insertSecurity(featureId, 'Moose');
    await insertSecurity(featureId, 'Spotted Owl');
    await buildClosure(uploadId);

    const result = await repo.getSubmissionFeatureById(featureId);

    expect(result.secured).to.equal(true);
    expect(result.security_reasons).to.deep.equal(['Moose', 'Spotted Owl']);
  });

  it('7. no closure rows → fail-closed secured with no resolvable reasons', async () => {
    const { featureId } = await createFeature();
    // Intentionally skip buildClosure — the feature has zero closure rows (not even its self-loop),
    // so isEffectivelySecured hits the fail-closed OR NOT EXISTS branch.

    const result = await repo.getSubmissionFeatureById(featureId);

    expect(result.secured).to.equal(true);
    expect(result.security_reasons).to.deep.equal([]);
  });
});
