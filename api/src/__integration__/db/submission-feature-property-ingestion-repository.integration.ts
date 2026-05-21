// Integration tests for SubmissionFeaturePropertyIngestionRepository — drives three methods that
// read ALREADY-RESOLVED candidate rows from the UNLOGGED staging table
// (submission_upload_staging_feature_candidate) directly, so each branch/gate is observable in
// isolation (no service, no populate/resolve step, no Phase 9 gate):
//
//   - recordFeaturePropertyResolutionErrorsBySubmissionUploadId — groups four error categories into
//     submission_feature_error: INVALID_FEATURE_REFERENCE_FORMAT, UNRESOLVED_FEATURE_REFERENCE,
//     INVALID_FEATURE_REFERENCE_TYPE, INVALID_FEATURE_REFERENCE_SELF.
//   - recordCircularFeatureReferenceErrorsBySubmissionUploadId — recursive-CTE cycle detection over
//     the property-feature edges, recording CIRCULAR_FEATURE_REFERENCE for edges in a cycle (length ≥ 2).
//   - insertFeaturePropertiesBySubmissionUploadId — gated INSERT…SELECT into
//     submission_feature_property_feature with ON CONFLICT DO NOTHING.
//
// Fixtures hand-populate the staging table directly: the candidate's submission_upload_id is just a
// filter key (the UNLOGGED staging table has no FK), so each test mints its own uuid. The canonical
// tables DO have FKs, so real submission_feature rows and a feature_type_property config row are
// created per test.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: docker compose exec api npx mocha --config .mocharc.integration.json \
//        'src/__integration__/db/submission-feature-property-ingestion-repository.integration.ts'
// Requires: database container running.

import { expect } from 'chai';
import crypto from 'crypto';
import { describe } from 'mocha';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SubmissionFeaturePropertyIngestionRepository } from '../../repositories/submission-feature-property-ingestion-repository';
import {
  createTestFeature,
  createTestSubmission,
  getOrCreateIntegrationTicketId
} from '../helpers/test-submission-helpers';

describe('SubmissionFeaturePropertyIngestionRepository (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let repo: SubmissionFeaturePropertyIngestionRepository;

  before(() => initDBPool(defaultPoolConfig));

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    repo = new SubmissionFeaturePropertyIngestionRepository(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  // --- local helpers -------------------------------------------------------

  /**
   * Create a real `submission_upload` row for a submission and return its `submission_upload_id` uuid.
   *
   * The error-recording method writes the candidate's `submission_upload_id` into
   * `submission_feature_error`, which has an FK to `submission_upload` — so those tests need a real
   * upload uuid (a bare random uuid violates the FK). The candidate's `submission_upload_id` itself is
   * just a filter key against the UNLOGGED staging table (no FK), so any uuid works there; using the
   * real one keeps both paths consistent.
   */
  async function createTestUpload(submissionId: number): Promise<string> {
    const systemUserId = connection.systemUserId();

    const uploadResult = await connection.sql(SQL`
      INSERT INTO upload (upload_status, record_end_date, create_user)
      VALUES ('completed', now(), ${systemUserId})
      RETURNING upload_id;
    `);
    const uploadId = uploadResult.rows[0].upload_id;

    const ticketId = await getOrCreateIntegrationTicketId(connection, submissionId, uploadId, systemUserId);

    const bridgeResult = await connection.sql(SQL`
      INSERT INTO submission_upload (submission_id, upload_id, ticket_id, create_user)
      VALUES (${submissionId}, ${uploadId}, ${ticketId}, ${systemUserId})
      RETURNING submission_upload_id;
    `);

    return bridgeResult.rows[0].submission_upload_id;
  }

  /** Resolve a seeded feature_type by name to its id. */
  async function featureTypeIdByName(name: string): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT feature_type_id FROM feature_type WHERE name = ${name} LIMIT 1;
    `);
    return result.rows[0].feature_type_id;
  }

  /**
   * Create a feature-typed feature_property + feature_type_property config row for a source feature
   * type. Mirrors insertCodeFeatureProperty but for the 'feature' property type.
   *
   * @param sourceFeatureTypeName Feature type the property is attached to (the referencing feature).
   * @param allowedTargetFeatureTypeName Allowed target feature type name, or null for "no permitted target".
   * @param allowMultiple Whether the property may carry multiple references.
   * @returns The new feature_type_property_id and the resolved allowedFeatureTypeId (or null).
   */
  async function createFeatureTypeProperty(
    sourceFeatureTypeName: string,
    allowedTargetFeatureTypeName: string | null,
    allowMultiple = false
  ): Promise<{ featureTypePropertyId: number; allowedFeatureTypeId: number | null }> {
    const systemUserId = connection.systemUserId();

    await connection.sql(SQL`
      INSERT INTO feature_property_type (name, record_effective_date, create_user)
      SELECT 'feature', now(), ${systemUserId}
      WHERE NOT EXISTS (SELECT 1 FROM feature_property_type WHERE name = 'feature');
    `);

    const fptResult = await connection.sql(SQL`
      SELECT feature_property_type_id FROM feature_property_type WHERE name = 'feature';
    `);
    const featurePropertyTypeId = fptResult.rows[0].feature_property_type_id;

    const uniqueSuffix = crypto.randomInt(0, 1_000_000_000);
    const fpResult = await connection.sql(SQL`
      INSERT INTO feature_property (feature_property_type_id, name, display_name, record_effective_date, create_user)
      VALUES (
        ${featurePropertyTypeId},
        ${'test_feature_ref_' + uniqueSuffix},
        ${'Test Feature Ref ' + uniqueSuffix},
        now(),
        ${systemUserId}
      )
      RETURNING feature_property_id;
    `);
    const featurePropertyId = fpResult.rows[0].feature_property_id;

    const allowedFeatureTypeId =
      allowedTargetFeatureTypeName === null ? null : await featureTypeIdByName(allowedTargetFeatureTypeName);

    const ftpResult = await connection.sql(SQL`
      INSERT INTO feature_type_property (
        feature_type_id,
        feature_property_id,
        allow_multiple,
        allowed_referenced_feature_type_id,
        record_effective_date,
        create_user
      )
      VALUES (
        (SELECT feature_type_id FROM feature_type WHERE name = ${sourceFeatureTypeName} LIMIT 1),
        ${featurePropertyId},
        ${allowMultiple},
        ${allowedFeatureTypeId},
        now(),
        ${systemUserId}
      )
      RETURNING feature_type_property_id;
    `);

    return { featureTypePropertyId: ftpResult.rows[0].feature_type_property_id, allowedFeatureTypeId };
  }

  /** Insert one row into the UNLOGGED staging candidate table. */
  async function insertCandidate(params: {
    uploadId: string;
    sourceFeatureId: number;
    featureTypePropertyId: number;
    propertyName: string;
    rawValue: string;
    isFormatValid: boolean;
    parsedSourceId: string | null;
    referencedFeatureId: number | null;
    referencedFeatureTypeId: number | null;
  }): Promise<void> {
    await connection.sql(SQL`
      INSERT INTO submission_upload_staging_feature_candidate (
        submission_upload_id,
        submission_feature_id,
        property_name,
        feature_type_property_id,
        raw_value,
        is_format_valid,
        parsed_source_id,
        referenced_submission_feature_id,
        referenced_feature_type_id
      )
      VALUES (
        ${params.uploadId}::uuid,
        ${params.sourceFeatureId},
        ${params.propertyName},
        ${params.featureTypePropertyId},
        ${JSON.stringify(params.rawValue)}::jsonb,
        ${params.isFormatValid},
        ${params.parsedSourceId},
        ${params.referencedFeatureId},
        ${params.referencedFeatureTypeId}
      );
    `);
  }

  /** Soft-delete a feature_type_property config row by ending its record. */
  async function softDeleteFeatureTypeProperty(featureTypePropertyId: number): Promise<void> {
    await connection.sql(SQL`
      UPDATE feature_type_property SET record_end_date = now() WHERE feature_type_property_id = ${featureTypePropertyId};
    `);
  }

  /** Fetch grouped error rows for an upload scope. */
  async function getErrors(uploadId: string): Promise<{ error_code: string; count: number }[]> {
    const result = await connection.sql(SQL`
      SELECT error_code, count
      FROM submission_feature_error
      WHERE submission_upload_id = ${uploadId}::uuid
      ORDER BY error_code;
    `);
    return result.rows;
  }

  /** Count canonical property-feature rows for a source feature. */
  async function getPropertyFeatureRows(
    sourceFeatureId: number
  ): Promise<{ referenced_submission_feature_id: number; feature_type_property_id: number }[]> {
    const result = await connection.sql(SQL`
      SELECT referenced_submission_feature_id, feature_type_property_id
      FROM submission_feature_property_feature
      WHERE submission_feature_id = ${sourceFeatureId};
    `);
    return result.rows;
  }

  // --- recordFeaturePropertyResolutionErrorsBySubmissionUploadId -----------

  describe('recordFeaturePropertyResolutionErrorsBySubmissionUploadId', () => {
    it('records INVALID_FEATURE_REFERENCE_FORMAT for malformed values', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      const sourceFeatureId = await createTestFeature(connection, submissionId, 'sample_period', {});
      const { featureTypePropertyId } = await createFeatureTypeProperty('sample_period', 'sample_site');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        propertyName: 'site_ref',
        rawValue: 'garbage-value',
        isFormatValid: false,
        parsedSourceId: null,
        referencedFeatureId: null,
        referencedFeatureTypeId: null
      });

      await repo.recordFeaturePropertyResolutionErrorsBySubmissionUploadId(uploadId);

      const errors = await getErrors(uploadId);
      expect(errors).to.have.lengthOf(1);
      expect(errors[0].error_code).to.equal('INVALID_FEATURE_REFERENCE_FORMAT');
    });

    it('records UNRESOLVED_FEATURE_REFERENCE when resolution misses', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      const sourceFeatureId = await createTestFeature(connection, submissionId, 'sample_period', {});
      const { featureTypePropertyId } = await createFeatureTypeProperty('sample_period', 'sample_site');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        propertyName: 'site_ref',
        rawValue: 'feature::nope',
        isFormatValid: true,
        parsedSourceId: 'nope',
        referencedFeatureId: null,
        referencedFeatureTypeId: null
      });

      await repo.recordFeaturePropertyResolutionErrorsBySubmissionUploadId(uploadId);

      const errors = await getErrors(uploadId);
      expect(errors).to.have.lengthOf(1);
      expect(errors[0].error_code).to.equal('UNRESOLVED_FEATURE_REFERENCE');
    });

    it('records INVALID_FEATURE_REFERENCE_TYPE when resolved type not allowed', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      const sourceFeatureId = await createTestFeature(connection, submissionId, 'sample_period', {});
      // Config allows sample_site, but the candidate resolved to a sample_technique feature.
      const { featureTypePropertyId } = await createFeatureTypeProperty('sample_period', 'sample_site');
      const wrongTypeFeatureId = await createTestFeature(connection, submissionId, 'sample_technique', {});
      const wrongTypeId = await featureTypeIdByName('sample_technique');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        propertyName: 'site_ref',
        rawValue: 'feature::tech1',
        isFormatValid: true,
        parsedSourceId: 'tech1',
        referencedFeatureId: wrongTypeFeatureId,
        referencedFeatureTypeId: wrongTypeId
      });

      await repo.recordFeaturePropertyResolutionErrorsBySubmissionUploadId(uploadId);

      const errors = await getErrors(uploadId);
      expect(errors).to.have.lengthOf(1);
      expect(errors[0].error_code).to.equal('INVALID_FEATURE_REFERENCE_TYPE');
    });

    it('records INVALID_FEATURE_REFERENCE_TYPE when property has no allowed target', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      const sourceFeatureId = await createTestFeature(connection, submissionId, 'sample_period', {});
      // Config allows NO target — every reference is rejected.
      const { featureTypePropertyId } = await createFeatureTypeProperty('sample_period', null);
      const targetFeatureId = await createTestFeature(connection, submissionId, 'sample_site', {});
      const targetTypeId = await featureTypeIdByName('sample_site');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        propertyName: 'site_ref',
        rawValue: 'feature::area1',
        isFormatValid: true,
        parsedSourceId: 'area1',
        referencedFeatureId: targetFeatureId,
        referencedFeatureTypeId: targetTypeId
      });

      await repo.recordFeaturePropertyResolutionErrorsBySubmissionUploadId(uploadId);

      const errors = await getErrors(uploadId);
      expect(errors).to.have.lengthOf(1);
      expect(errors[0].error_code).to.equal('INVALID_FEATURE_REFERENCE_TYPE');
    });

    it('records INVALID_FEATURE_REFERENCE_SELF (and no TYPE error) for a self-reference', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      // Source is a sample_site; config allows sample_site; candidate points at its own feature.
      const sourceFeatureId = await createTestFeature(connection, submissionId, 'sample_site', {});
      const { featureTypePropertyId } = await createFeatureTypeProperty('sample_site', 'sample_site');
      const sampleSiteTypeId = await featureTypeIdByName('sample_site');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        propertyName: 'site_ref',
        rawValue: 'feature::self',
        isFormatValid: true,
        parsedSourceId: 'self',
        referencedFeatureId: sourceFeatureId,
        referencedFeatureTypeId: sampleSiteTypeId
      });

      await repo.recordFeaturePropertyResolutionErrorsBySubmissionUploadId(uploadId);

      const errors = await getErrors(uploadId);
      expect(errors).to.have.lengthOf(1);
      expect(errors[0].error_code).to.equal('INVALID_FEATURE_REFERENCE_SELF');
      // A self-reference is reported once as SELF, never double-counted as TYPE.
      expect(errors.filter((e) => e.error_code === 'INVALID_FEATURE_REFERENCE_TYPE')).to.have.lengthOf(0);
    });

    it('ignores a soft-deleted feature_type_property config (type branch)', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      const sourceFeatureId = await createTestFeature(connection, submissionId, 'sample_period', {});
      const { featureTypePropertyId } = await createFeatureTypeProperty('sample_period', 'sample_site');
      await softDeleteFeatureTypeProperty(featureTypePropertyId);

      const wrongTypeFeatureId = await createTestFeature(connection, submissionId, 'sample_technique', {});
      const wrongTypeId = await featureTypeIdByName('sample_technique');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        propertyName: 'site_ref',
        rawValue: 'feature::tech1',
        isFormatValid: true,
        parsedSourceId: 'tech1',
        referencedFeatureId: wrongTypeFeatureId,
        referencedFeatureTypeId: wrongTypeId
      });

      await repo.recordFeaturePropertyResolutionErrorsBySubmissionUploadId(uploadId);

      const errors = await getErrors(uploadId);
      expect(errors).to.have.lengthOf(0);
    });

    it('aggregates duplicate errors into one grouped row with a count', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      const sourceFeatureId = await createTestFeature(connection, submissionId, 'sample_period', {});
      const { featureTypePropertyId } = await createFeatureTypeProperty('sample_period', 'sample_site');

      // Two malformed candidates sharing property_name + feature_type_property_id.
      for (let i = 0; i < 2; i++) {
        await insertCandidate({
          uploadId,
          sourceFeatureId,
          featureTypePropertyId,
          propertyName: 'site_ref',
          rawValue: 'garbage-' + i,
          isFormatValid: false,
          parsedSourceId: null,
          referencedFeatureId: null,
          referencedFeatureTypeId: null
        });
      }

      await repo.recordFeaturePropertyResolutionErrorsBySubmissionUploadId(uploadId);

      const errors = await getErrors(uploadId);
      expect(errors).to.have.lengthOf(1);
      expect(errors[0].error_code).to.equal('INVALID_FEATURE_REFERENCE_FORMAT');
      expect(errors[0].count).to.equal(2);
    });
  });

  // --- recordCircularFeatureReferenceErrorsBySubmissionUploadId ------------

  describe('recordCircularFeatureReferenceErrorsBySubmissionUploadId', () => {
    it('flags both edges of a 2-node cycle (A->B, B->A)', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      const featureA = await createTestFeature(connection, submissionId, 'sample_period', {});
      const featureB = await createTestFeature(connection, submissionId, 'sample_site', {});
      const typeA = await featureTypeIdByName('sample_period');
      const typeB = await featureTypeIdByName('sample_site');
      // Distinct configs so the two cyclic edges fall into separate grouped error rows.
      const { featureTypePropertyId: ftpA } = await createFeatureTypeProperty('sample_period', 'sample_site');
      const { featureTypePropertyId: ftpB } = await createFeatureTypeProperty('sample_site', 'sample_period');

      // A -> B
      await insertCandidate({
        uploadId,
        sourceFeatureId: featureA,
        featureTypePropertyId: ftpA,
        propertyName: 'a_to_b',
        rawValue: 'feature::b',
        isFormatValid: true,
        parsedSourceId: 'b',
        referencedFeatureId: featureB,
        referencedFeatureTypeId: typeB
      });
      // B -> A
      await insertCandidate({
        uploadId,
        sourceFeatureId: featureB,
        featureTypePropertyId: ftpB,
        propertyName: 'b_to_a',
        rawValue: 'feature::a',
        isFormatValid: true,
        parsedSourceId: 'a',
        referencedFeatureId: featureA,
        referencedFeatureTypeId: typeA
      });

      await repo.recordCircularFeatureReferenceErrorsBySubmissionUploadId(uploadId);

      const errors = await getErrors(uploadId);
      expect(errors).to.have.lengthOf(2);
      expect(errors.every((e) => e.error_code === 'CIRCULAR_FEATURE_REFERENCE')).to.equal(true);
    });

    it('flags all three edges of a 3-node cycle (A->B, B->C, C->A)', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      const featureA = await createTestFeature(connection, submissionId, 'sample_period', {});
      const featureB = await createTestFeature(connection, submissionId, 'sample_site', {});
      const featureC = await createTestFeature(connection, submissionId, 'sample_technique', {});
      const typeA = await featureTypeIdByName('sample_period');
      const typeB = await featureTypeIdByName('sample_site');
      const typeC = await featureTypeIdByName('sample_technique');
      const { featureTypePropertyId: ftpA } = await createFeatureTypeProperty('sample_period', 'sample_site');
      const { featureTypePropertyId: ftpB } = await createFeatureTypeProperty('sample_site', 'sample_technique');
      const { featureTypePropertyId: ftpC } = await createFeatureTypeProperty('sample_technique', 'sample_period');

      // A -> B
      await insertCandidate({
        uploadId,
        sourceFeatureId: featureA,
        featureTypePropertyId: ftpA,
        propertyName: 'a_to_b',
        rawValue: 'feature::b',
        isFormatValid: true,
        parsedSourceId: 'b',
        referencedFeatureId: featureB,
        referencedFeatureTypeId: typeB
      });
      // B -> C
      await insertCandidate({
        uploadId,
        sourceFeatureId: featureB,
        featureTypePropertyId: ftpB,
        propertyName: 'b_to_c',
        rawValue: 'feature::c',
        isFormatValid: true,
        parsedSourceId: 'c',
        referencedFeatureId: featureC,
        referencedFeatureTypeId: typeC
      });
      // C -> A
      await insertCandidate({
        uploadId,
        sourceFeatureId: featureC,
        featureTypePropertyId: ftpC,
        propertyName: 'c_to_a',
        rawValue: 'feature::a',
        isFormatValid: true,
        parsedSourceId: 'a',
        referencedFeatureId: featureA,
        referencedFeatureTypeId: typeA
      });

      await repo.recordCircularFeatureReferenceErrorsBySubmissionUploadId(uploadId);

      const errors = await getErrors(uploadId);
      expect(errors).to.have.lengthOf(3);
      expect(errors.every((e) => e.error_code === 'CIRCULAR_FEATURE_REFERENCE')).to.equal(true);
    });

    it('does NOT flag an acyclic chain (A->B, B->C)', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      const featureA = await createTestFeature(connection, submissionId, 'sample_period', {});
      const featureB = await createTestFeature(connection, submissionId, 'sample_site', {});
      const featureC = await createTestFeature(connection, submissionId, 'sample_technique', {});
      const typeB = await featureTypeIdByName('sample_site');
      const typeC = await featureTypeIdByName('sample_technique');
      const { featureTypePropertyId: ftpA } = await createFeatureTypeProperty('sample_period', 'sample_site');
      const { featureTypePropertyId: ftpB } = await createFeatureTypeProperty('sample_site', 'sample_technique');

      // A -> B
      await insertCandidate({
        uploadId,
        sourceFeatureId: featureA,
        featureTypePropertyId: ftpA,
        propertyName: 'a_to_b',
        rawValue: 'feature::b',
        isFormatValid: true,
        parsedSourceId: 'b',
        referencedFeatureId: featureB,
        referencedFeatureTypeId: typeB
      });
      // B -> C
      await insertCandidate({
        uploadId,
        sourceFeatureId: featureB,
        featureTypePropertyId: ftpB,
        propertyName: 'b_to_c',
        rawValue: 'feature::c',
        isFormatValid: true,
        parsedSourceId: 'c',
        referencedFeatureId: featureC,
        referencedFeatureTypeId: typeC
      });

      await repo.recordCircularFeatureReferenceErrorsBySubmissionUploadId(uploadId);

      expect(await getErrors(uploadId)).to.have.lengthOf(0);
    });

    it('does NOT flag a self-loop (A->A) — handled by the SELF rule, excluded from the edge set', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      const featureA = await createTestFeature(connection, submissionId, 'sample_site', {});
      const typeA = await featureTypeIdByName('sample_site');
      const { featureTypePropertyId: ftpA } = await createFeatureTypeProperty('sample_site', 'sample_site');

      // A -> A
      await insertCandidate({
        uploadId,
        sourceFeatureId: featureA,
        featureTypePropertyId: ftpA,
        propertyName: 'a_to_a',
        rawValue: 'feature::a',
        isFormatValid: true,
        parsedSourceId: 'a',
        referencedFeatureId: featureA,
        referencedFeatureTypeId: typeA
      });

      await repo.recordCircularFeatureReferenceErrorsBySubmissionUploadId(uploadId);

      expect(await getErrors(uploadId)).to.have.lengthOf(0);
    });

    it('does NOT flag a would-be 2-cycle when one edge is not format-valid', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      const featureA = await createTestFeature(connection, submissionId, 'sample_period', {});
      const featureB = await createTestFeature(connection, submissionId, 'sample_site', {});
      const typeA = await featureTypeIdByName('sample_period');
      const typeB = await featureTypeIdByName('sample_site');
      const { featureTypePropertyId: ftpA } = await createFeatureTypeProperty('sample_period', 'sample_site');
      const { featureTypePropertyId: ftpB } = await createFeatureTypeProperty('sample_site', 'sample_period');

      // A -> B (valid)
      await insertCandidate({
        uploadId,
        sourceFeatureId: featureA,
        featureTypePropertyId: ftpA,
        propertyName: 'a_to_b',
        rawValue: 'feature::b',
        isFormatValid: true,
        parsedSourceId: 'b',
        referencedFeatureId: featureB,
        referencedFeatureTypeId: typeB
      });
      // B -> A (NOT format-valid — breaks the would-be cycle; excluded from the edge graph)
      await insertCandidate({
        uploadId,
        sourceFeatureId: featureB,
        featureTypePropertyId: ftpB,
        propertyName: 'b_to_a',
        rawValue: 'garbage',
        isFormatValid: false,
        parsedSourceId: null,
        referencedFeatureId: featureA,
        referencedFeatureTypeId: typeA
      });

      await repo.recordCircularFeatureReferenceErrorsBySubmissionUploadId(uploadId);

      expect(await getErrors(uploadId)).to.have.lengthOf(0);
    });
  });

  // --- insertFeaturePropertiesBySubmissionUploadId -------------------------

  describe('insertFeaturePropertiesBySubmissionUploadId', () => {
    it('inserts one canonical row when all gates pass', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      const sourceFeatureId = await createTestFeature(connection, submissionId, 'sample_period', {});
      const { featureTypePropertyId } = await createFeatureTypeProperty('sample_period', 'sample_site');
      const targetFeatureId = await createTestFeature(connection, submissionId, 'sample_site', {});
      const targetTypeId = await featureTypeIdByName('sample_site');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        propertyName: 'site_ref',
        rawValue: 'feature::area1',
        isFormatValid: true,
        parsedSourceId: 'area1',
        referencedFeatureId: targetFeatureId,
        referencedFeatureTypeId: targetTypeId
      });

      await repo.insertFeaturePropertiesBySubmissionUploadId(uploadId);

      const rows = await getPropertyFeatureRows(sourceFeatureId);
      expect(rows).to.have.lengthOf(1);
      expect(rows[0].referenced_submission_feature_id).to.equal(targetFeatureId);
      expect(rows[0].feature_type_property_id).to.equal(featureTypePropertyId);
    });

    it('skips candidates with invalid format', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      const sourceFeatureId = await createTestFeature(connection, submissionId, 'sample_period', {});
      const { featureTypePropertyId } = await createFeatureTypeProperty('sample_period', 'sample_site');
      const targetFeatureId = await createTestFeature(connection, submissionId, 'sample_site', {});
      const targetTypeId = await featureTypeIdByName('sample_site');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        propertyName: 'site_ref',
        rawValue: 'garbage',
        isFormatValid: false,
        parsedSourceId: null,
        referencedFeatureId: targetFeatureId,
        referencedFeatureTypeId: targetTypeId
      });

      await repo.insertFeaturePropertiesBySubmissionUploadId(uploadId);

      expect(await getPropertyFeatureRows(sourceFeatureId)).to.have.lengthOf(0);
    });

    it('skips candidates with null resolution', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      const sourceFeatureId = await createTestFeature(connection, submissionId, 'sample_period', {});
      const { featureTypePropertyId } = await createFeatureTypeProperty('sample_period', 'sample_site');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        propertyName: 'site_ref',
        rawValue: 'feature::nope',
        isFormatValid: true,
        parsedSourceId: 'nope',
        referencedFeatureId: null,
        referencedFeatureTypeId: null
      });

      await repo.insertFeaturePropertiesBySubmissionUploadId(uploadId);

      expect(await getPropertyFeatureRows(sourceFeatureId)).to.have.lengthOf(0);
    });

    it('skips candidates whose resolved type is not allowed', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      const sourceFeatureId = await createTestFeature(connection, submissionId, 'sample_period', {});
      const { featureTypePropertyId } = await createFeatureTypeProperty('sample_period', 'sample_site');
      const wrongTypeFeatureId = await createTestFeature(connection, submissionId, 'sample_technique', {});
      const wrongTypeId = await featureTypeIdByName('sample_technique');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        propertyName: 'site_ref',
        rawValue: 'feature::tech1',
        isFormatValid: true,
        parsedSourceId: 'tech1',
        referencedFeatureId: wrongTypeFeatureId,
        referencedFeatureTypeId: wrongTypeId
      });

      await repo.insertFeaturePropertiesBySubmissionUploadId(uploadId);

      expect(await getPropertyFeatureRows(sourceFeatureId)).to.have.lengthOf(0);
    });

    it('excludes self-references', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      const sourceFeatureId = await createTestFeature(connection, submissionId, 'sample_site', {});
      const { featureTypePropertyId } = await createFeatureTypeProperty('sample_site', 'sample_site');
      const sampleSiteTypeId = await featureTypeIdByName('sample_site');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        propertyName: 'site_ref',
        rawValue: 'feature::self',
        isFormatValid: true,
        parsedSourceId: 'self',
        referencedFeatureId: sourceFeatureId,
        referencedFeatureTypeId: sampleSiteTypeId
      });

      await repo.insertFeaturePropertiesBySubmissionUploadId(uploadId);

      expect(await getPropertyFeatureRows(sourceFeatureId)).to.have.lengthOf(0);
    });

    it('dedups exact-duplicate references to one row', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      const sourceFeatureId = await createTestFeature(connection, submissionId, 'sample_period', {});
      const { featureTypePropertyId } = await createFeatureTypeProperty('sample_period', 'sample_site', true);
      const targetFeatureId = await createTestFeature(connection, submissionId, 'sample_site', {});
      const targetTypeId = await featureTypeIdByName('sample_site');

      // Two identical valid candidates (same source, config, referenced feature).
      for (let i = 0; i < 2; i++) {
        await insertCandidate({
          uploadId,
          sourceFeatureId,
          featureTypePropertyId,
          propertyName: 'site_ref',
          rawValue: 'feature::area1',
          isFormatValid: true,
          parsedSourceId: 'area1',
          referencedFeatureId: targetFeatureId,
          referencedFeatureTypeId: targetTypeId
        });
      }

      await repo.insertFeaturePropertiesBySubmissionUploadId(uploadId);

      expect(await getPropertyFeatureRows(sourceFeatureId)).to.have.lengthOf(1);
    });

    it('writes only submission_feature_property_feature, never submission_feature_feature', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      const sourceFeatureId = await createTestFeature(connection, submissionId, 'sample_period', {});
      const { featureTypePropertyId } = await createFeatureTypeProperty('sample_period', 'sample_site');
      const targetFeatureId = await createTestFeature(connection, submissionId, 'sample_site', {});
      const targetTypeId = await featureTypeIdByName('sample_site');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        propertyName: 'site_ref',
        rawValue: 'feature::area1',
        isFormatValid: true,
        parsedSourceId: 'area1',
        referencedFeatureId: targetFeatureId,
        referencedFeatureTypeId: targetTypeId
      });

      await repo.insertFeaturePropertiesBySubmissionUploadId(uploadId);

      expect(await getPropertyFeatureRows(sourceFeatureId)).to.have.lengthOf(1);

      const sffResult = await connection.sql(SQL`
        SELECT COUNT(*)::integer AS count
        FROM submission_feature_feature
        WHERE source_feature_id = ${sourceFeatureId};
      `);
      expect(sffResult.rows[0].count).to.equal(0);
    });

    it('ignores a soft-deleted feature_type_property config', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(submissionId);
      const sourceFeatureId = await createTestFeature(connection, submissionId, 'sample_period', {});
      const { featureTypePropertyId } = await createFeatureTypeProperty('sample_period', 'sample_site');
      const targetFeatureId = await createTestFeature(connection, submissionId, 'sample_site', {});
      const targetTypeId = await featureTypeIdByName('sample_site');
      await softDeleteFeatureTypeProperty(featureTypePropertyId);

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        propertyName: 'site_ref',
        rawValue: 'feature::area1',
        isFormatValid: true,
        parsedSourceId: 'area1',
        referencedFeatureId: targetFeatureId,
        referencedFeatureTypeId: targetTypeId
      });

      await repo.insertFeaturePropertiesBySubmissionUploadId(uploadId);

      expect(await getPropertyFeatureRows(sourceFeatureId)).to.have.lengthOf(0);
    });
  });
});
