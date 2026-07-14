// Integration tests for SubmissionFeaturePropertyIngestionRepository — drives several error-recording
// and property-insertion methods so each branch/gate is observable in isolation (no service, no
// populate/resolve step, no Phase 9 gate). The first three read ALREADY-RESOLVED candidate rows from
// the UNLOGGED staging table (submission_upload_staging_feature_candidate) directly:
//
//   - recordFeaturePropertyResolutionErrorsBySubmissionUploadId — groups four error categories into
//     submission_feature_error: INVALID_FEATURE_REFERENCE_FORMAT, UNRESOLVED_FEATURE_REFERENCE,
//     INVALID_FEATURE_REFERENCE_TYPE, INVALID_FEATURE_REFERENCE_SELF.
//   - recordCircularFeatureReferenceErrorsBySubmissionUploadId — recursive-CTE cycle detection over
//     the property-feature edges, recording CIRCULAR_FEATURE_REFERENCE for edges in a cycle (length ≥ 2).
//   - insertFeaturePropertiesBySubmissionUploadId — gated INSERT…SELECT into
//     submission_feature_property_feature with ON CONFLICT DO NOTHING.
//
// The last method instead reads canonical submission_feature rows directly (not the staging table):
//
//   - recordDuplicateFeatureSourceIdErrorsBySubmissionUploadId — flags source_id collisions within an
//     upload, recording one DUPLICATE_FEATURE_SOURCE_ID row per duplicated source_id.
//
// Fixtures for the staging-driven methods hand-populate the staging table directly: the candidate's submission_upload_id is just a
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
import { describe } from 'mocha';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SubmissionFeaturePropertyIngestionRepository } from '../../repositories/submission-feature-property-ingestion-repository';
import {
  createFeatureTypeProperty,
  createTestUpload,
  featureTypeIdByName,
  getPropertyFeatureRows as fetchPropertyFeatureRows,
  getSubmissionFeatureErrors
} from '../helpers/test-feature-property-helpers';
import {
  createTestFeature,
  createTestSubmission,
  createTestUploadWithFeatures
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
   * Insert one row into the UNLOGGED staging candidate table.
   *
   * Fields beyond the three identifiers default to a format-valid, resolved `feature::area1`
   * candidate; each test overrides only the field(s) whose branch it exercises.
   */
  async function insertCandidate(params: {
    uploadId: string;
    sourceFeatureId: number;
    featureTypePropertyId: number;
    propertyName?: string;
    rawValue?: string;
    isFormatValid?: boolean;
    parsedSourceId?: string | null;
    referencedFeatureId?: number | null;
    referencedFeatureTypeId?: number | null;
  }): Promise<void> {
    const {
      uploadId,
      sourceFeatureId,
      featureTypePropertyId,
      propertyName = 'site_ref',
      rawValue = 'feature::area1',
      isFormatValid = true,
      parsedSourceId = 'area1',
      referencedFeatureId = null,
      referencedFeatureTypeId = null
    } = params;

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
        ${uploadId}::uuid,
        ${sourceFeatureId},
        ${propertyName},
        ${featureTypePropertyId},
        ${JSON.stringify(rawValue)}::jsonb,
        ${isFormatValid},
        ${parsedSourceId},
        ${referencedFeatureId},
        ${referencedFeatureTypeId}
      );
    `);
  }

  /** Soft-delete a feature_type_property config row by ending its record. */
  async function softDeleteFeatureTypeProperty(featureTypePropertyId: number): Promise<void> {
    await connection.sql(SQL`
      UPDATE feature_type_property SET record_end_date = now() WHERE feature_type_property_id = ${featureTypePropertyId};
    `);
  }

  /** Create a submission + a real upload for it. */
  async function seedUpload(): Promise<{ submissionId: number; uploadId: string }> {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);
    return { submissionId, uploadId };
  }

  /**
   * Stand up the common single-source arrange block: a submission, a real upload, one source feature,
   * and one feature_type_property config (defaulting to sample_period → sample_site).
   */
  async function seedSourceAndConfig(
    sourceType = 'sample_period',
    allowedTargetType: string | string[] | null = 'sample_site',
    allowMultiple = false
  ): Promise<{
    submissionId: number;
    uploadId: string;
    sourceFeatureId: number;
    featureTypePropertyId: number;
    allowedFeatureTypeIds: number[];
  }> {
    const { submissionId, uploadId } = await seedUpload();
    const sourceFeatureId = await createTestFeature(connection, submissionId, sourceType, {});
    const { featureTypePropertyId, allowedFeatureTypeIds } = await createFeatureTypeProperty(
      connection,
      sourceType,
      allowedTargetType,
      allowMultiple
    );
    return { submissionId, uploadId, sourceFeatureId, featureTypePropertyId, allowedFeatureTypeIds };
  }

  /** All grouped error rows for an upload scope. */
  function getErrors(uploadId: string): Promise<{ error_code: string; count: number }[]> {
    return getSubmissionFeatureErrors(connection, uploadId);
  }

  /** Canonical property-feature rows for a source feature. */
  function getPropertyFeatureRows(
    sourceFeatureId: number
  ): Promise<{ referenced_submission_feature_id: number; feature_type_property_id: number }[]> {
    return fetchPropertyFeatureRows(connection, sourceFeatureId);
  }

  /**
   * Read back DUPLICATE_FEATURE_SOURCE_ID rows for an upload, ordered by source_id
   * for deterministic assertion order.
   */
  async function getDuplicateErrors(submissionUploadId: string): Promise<
    Array<{
      count: number;
      property_name: string | null;
      feature_type_property_id: number | null;
      source_id: string | null;
    }>
  > {
    const result = await connection.sql<{
      count: number;
      property_name: string | null;
      feature_type_property_id: number | null;
      source_id: string | null;
    }>(SQL`
      SELECT
        count,
        property_name,
        feature_type_property_id,
        details->>'source_id' AS source_id
      FROM submission_feature_error
      WHERE submission_upload_id = ${submissionUploadId}::uuid
        AND error_code = 'DUPLICATE_FEATURE_SOURCE_ID'
      ORDER BY details->>'source_id';
    `);
    return result.rows;
  }

  // --- recordFeaturePropertyResolutionErrorsBySubmissionUploadId -----------

  describe('recordFeaturePropertyResolutionErrorsBySubmissionUploadId', () => {
    it('records INVALID_FEATURE_REFERENCE_FORMAT for malformed values', async () => {
      const { uploadId, sourceFeatureId, featureTypePropertyId } = await seedSourceAndConfig();

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        rawValue: 'garbage-value',
        isFormatValid: false,
        parsedSourceId: null
      });

      await repo.recordFeaturePropertyResolutionErrorsBySubmissionUploadId(uploadId);

      const errors = await getErrors(uploadId);
      // Exclusivity: a malformed value fires ONLY the FORMAT branch — never also the
      // UNRESOLVED / TYPE / SELF branches. The four error categories are mutually exclusive,
      // so the exact set of recorded codes must be just this one.
      expect(errors.map((e) => e.error_code)).to.deep.equal(['INVALID_FEATURE_REFERENCE_FORMAT']);
    });

    it('records UNRESOLVED_FEATURE_REFERENCE when resolution misses', async () => {
      const { uploadId, sourceFeatureId, featureTypePropertyId } = await seedSourceAndConfig();

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        rawValue: 'feature::nope',
        parsedSourceId: 'nope'
      });

      await repo.recordFeaturePropertyResolutionErrorsBySubmissionUploadId(uploadId);

      const errors = await getErrors(uploadId);
      expect(errors).to.have.lengthOf(1);
      expect(errors[0].error_code).to.equal('UNRESOLVED_FEATURE_REFERENCE');
    });

    it('records INVALID_FEATURE_REFERENCE_TYPE when resolved type not allowed', async () => {
      // Config allows sample_site, but the candidate resolved to a sample_technique feature.
      const { submissionId, uploadId, sourceFeatureId, featureTypePropertyId } = await seedSourceAndConfig();
      const wrongTypeFeatureId = await createTestFeature(connection, submissionId, 'sample_technique', {});
      const wrongTypeId = await featureTypeIdByName(connection, 'sample_technique');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        rawValue: 'feature::tech1',
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
      // Config allows NO target — every reference is rejected.
      const { submissionId, uploadId, sourceFeatureId, featureTypePropertyId } = await seedSourceAndConfig(
        'sample_period',
        null
      );
      const targetFeatureId = await createTestFeature(connection, submissionId, 'sample_site', {});
      const targetTypeId = await featureTypeIdByName(connection, 'sample_site');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        referencedFeatureId: targetFeatureId,
        referencedFeatureTypeId: targetTypeId
      });

      await repo.recordFeaturePropertyResolutionErrorsBySubmissionUploadId(uploadId);

      const errors = await getErrors(uploadId);
      expect(errors).to.have.lengthOf(1);
      expect(errors[0].error_code).to.equal('INVALID_FEATURE_REFERENCE_TYPE');
    });

    it('records INVALID_FEATURE_REFERENCE_SELF (and no TYPE error) for a self-reference', async () => {
      // Source is a sample_site; config allows sample_site; candidate points at its own feature.
      const { uploadId, sourceFeatureId, featureTypePropertyId } = await seedSourceAndConfig(
        'sample_site',
        'sample_site'
      );
      const sampleSiteTypeId = await featureTypeIdByName(connection, 'sample_site');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        rawValue: 'feature::self',
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
      const { submissionId, uploadId, sourceFeatureId, featureTypePropertyId } = await seedSourceAndConfig();
      await softDeleteFeatureTypeProperty(featureTypePropertyId);

      const wrongTypeFeatureId = await createTestFeature(connection, submissionId, 'sample_technique', {});
      const wrongTypeId = await featureTypeIdByName(connection, 'sample_technique');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        rawValue: 'feature::tech1',
        parsedSourceId: 'tech1',
        referencedFeatureId: wrongTypeFeatureId,
        referencedFeatureTypeId: wrongTypeId
      });

      await repo.recordFeaturePropertyResolutionErrorsBySubmissionUploadId(uploadId);

      const errors = await getErrors(uploadId);
      expect(errors).to.have.lengthOf(0);
    });

    it('aggregates duplicate errors into one grouped row with a count', async () => {
      const { uploadId, sourceFeatureId, featureTypePropertyId } = await seedSourceAndConfig();

      // Two malformed candidates sharing property_name + feature_type_property_id.
      for (let i = 0; i < 2; i++) {
        await insertCandidate({
          uploadId,
          sourceFeatureId,
          featureTypePropertyId,
          rawValue: 'garbage-' + i,
          isFormatValid: false,
          parsedSourceId: null
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
      const { submissionId, uploadId } = await seedUpload();
      const featureA = await createTestFeature(connection, submissionId, 'sample_period', {});
      const featureB = await createTestFeature(connection, submissionId, 'sample_site', {});
      const typeA = await featureTypeIdByName(connection, 'sample_period');
      const typeB = await featureTypeIdByName(connection, 'sample_site');
      // Distinct configs so the two cyclic edges fall into separate grouped error rows.
      const { featureTypePropertyId: ftpA } = await createFeatureTypeProperty(
        connection,
        'sample_period',
        'sample_site'
      );
      const { featureTypePropertyId: ftpB } = await createFeatureTypeProperty(
        connection,
        'sample_site',
        'sample_period'
      );

      await insertCandidate({
        uploadId,
        sourceFeatureId: featureA,
        featureTypePropertyId: ftpA,
        propertyName: 'a_to_b',
        rawValue: 'feature::b',
        parsedSourceId: 'b',
        referencedFeatureId: featureB,
        referencedFeatureTypeId: typeB
      });
      await insertCandidate({
        uploadId,
        sourceFeatureId: featureB,
        featureTypePropertyId: ftpB,
        propertyName: 'b_to_a',
        rawValue: 'feature::a',
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
      const { submissionId, uploadId } = await seedUpload();
      const featureA = await createTestFeature(connection, submissionId, 'sample_period', {});
      const featureB = await createTestFeature(connection, submissionId, 'sample_site', {});
      const featureC = await createTestFeature(connection, submissionId, 'sample_technique', {});
      const typeA = await featureTypeIdByName(connection, 'sample_period');
      const typeB = await featureTypeIdByName(connection, 'sample_site');
      const typeC = await featureTypeIdByName(connection, 'sample_technique');
      const { featureTypePropertyId: ftpA } = await createFeatureTypeProperty(
        connection,
        'sample_period',
        'sample_site'
      );
      const { featureTypePropertyId: ftpB } = await createFeatureTypeProperty(
        connection,
        'sample_site',
        'sample_technique'
      );
      const { featureTypePropertyId: ftpC } = await createFeatureTypeProperty(
        connection,
        'sample_technique',
        'sample_period'
      );

      await insertCandidate({
        uploadId,
        sourceFeatureId: featureA,
        featureTypePropertyId: ftpA,
        propertyName: 'a_to_b',
        rawValue: 'feature::b',
        parsedSourceId: 'b',
        referencedFeatureId: featureB,
        referencedFeatureTypeId: typeB
      });
      await insertCandidate({
        uploadId,
        sourceFeatureId: featureB,
        featureTypePropertyId: ftpB,
        propertyName: 'b_to_c',
        rawValue: 'feature::c',
        parsedSourceId: 'c',
        referencedFeatureId: featureC,
        referencedFeatureTypeId: typeC
      });
      await insertCandidate({
        uploadId,
        sourceFeatureId: featureC,
        featureTypePropertyId: ftpC,
        propertyName: 'c_to_a',
        rawValue: 'feature::a',
        parsedSourceId: 'a',
        referencedFeatureId: featureA,
        referencedFeatureTypeId: typeA
      });

      await repo.recordCircularFeatureReferenceErrorsBySubmissionUploadId(uploadId);

      const errors = await getErrors(uploadId);
      expect(errors).to.have.lengthOf(3);
      expect(errors.every((e) => e.error_code === 'CIRCULAR_FEATURE_REFERENCE')).to.equal(true);
    });

    it('flags every edge of a long cycle whose back-path exceeds the old depth bound (regression)', async () => {
      // Regression for the depth-capped walk that silently accepted cycles longer than ~50 hops:
      // closing any edge of an N-node ring requires walking the other N-1 edges, so with N-1 > 50 the
      // old `r.depth < 50` guard never materialised the closing path and recorded ZERO errors. The
      // transitive-closure detector has no depth bound, so all N edges are flagged.
      const { submissionId, uploadId } = await seedUpload();
      const type = await featureTypeIdByName(connection, 'sample_site');
      // Feature type / config are irrelevant to cycle detection (it reads only the edge endpoints), so
      // reuse one feature type and one config for the whole ring; distinct property names keep each
      // cyclic edge in its own grouped error row.
      const { featureTypePropertyId: ftp } = await createFeatureTypeProperty(connection, 'sample_site', 'sample_site');

      const N = 55; // > old cap of 50
      const features: number[] = [];
      for (let i = 0; i < N; i++) {
        features.push(await createTestFeature(connection, submissionId, 'sample_site', {}));
      }
      // Ring: f0 -> f1 -> ... -> f(N-1) -> f0
      for (let i = 0; i < N; i++) {
        await insertCandidate({
          uploadId,
          sourceFeatureId: features[i],
          featureTypePropertyId: ftp,
          propertyName: `edge_${i}`,
          rawValue: `feature::f${(i + 1) % N}`,
          parsedSourceId: `f${(i + 1) % N}`,
          referencedFeatureId: features[(i + 1) % N],
          referencedFeatureTypeId: type
        });
      }

      await repo.recordCircularFeatureReferenceErrorsBySubmissionUploadId(uploadId);

      const errors = await getErrors(uploadId);
      expect(errors).to.have.lengthOf(N);
      expect(errors.every((e) => e.error_code === 'CIRCULAR_FEATURE_REFERENCE')).to.equal(true);
    });

    it('does NOT flag an acyclic chain (A->B, B->C)', async () => {
      const { submissionId, uploadId } = await seedUpload();
      const featureA = await createTestFeature(connection, submissionId, 'sample_period', {});
      const featureB = await createTestFeature(connection, submissionId, 'sample_site', {});
      const featureC = await createTestFeature(connection, submissionId, 'sample_technique', {});
      const typeB = await featureTypeIdByName(connection, 'sample_site');
      const typeC = await featureTypeIdByName(connection, 'sample_technique');
      const { featureTypePropertyId: ftpA } = await createFeatureTypeProperty(
        connection,
        'sample_period',
        'sample_site'
      );
      const { featureTypePropertyId: ftpB } = await createFeatureTypeProperty(
        connection,
        'sample_site',
        'sample_technique'
      );

      await insertCandidate({
        uploadId,
        sourceFeatureId: featureA,
        featureTypePropertyId: ftpA,
        propertyName: 'a_to_b',
        rawValue: 'feature::b',
        parsedSourceId: 'b',
        referencedFeatureId: featureB,
        referencedFeatureTypeId: typeB
      });
      await insertCandidate({
        uploadId,
        sourceFeatureId: featureB,
        featureTypePropertyId: ftpB,
        propertyName: 'b_to_c',
        rawValue: 'feature::c',
        parsedSourceId: 'c',
        referencedFeatureId: featureC,
        referencedFeatureTypeId: typeC
      });

      await repo.recordCircularFeatureReferenceErrorsBySubmissionUploadId(uploadId);

      expect(await getErrors(uploadId)).to.have.lengthOf(0);
    });

    it('does NOT flag a self-loop (A->A) — handled by the SELF rule, excluded from the edge set', async () => {
      const { submissionId, uploadId } = await seedUpload();
      const featureA = await createTestFeature(connection, submissionId, 'sample_site', {});
      const typeA = await featureTypeIdByName(connection, 'sample_site');
      const { featureTypePropertyId: ftpA } = await createFeatureTypeProperty(connection, 'sample_site', 'sample_site');

      await insertCandidate({
        uploadId,
        sourceFeatureId: featureA,
        featureTypePropertyId: ftpA,
        propertyName: 'a_to_a',
        rawValue: 'feature::a',
        parsedSourceId: 'a',
        referencedFeatureId: featureA,
        referencedFeatureTypeId: typeA
      });

      await repo.recordCircularFeatureReferenceErrorsBySubmissionUploadId(uploadId);

      expect(await getErrors(uploadId)).to.have.lengthOf(0);
    });

    it('does NOT flag a would-be 2-cycle when one edge is not format-valid', async () => {
      const { submissionId, uploadId } = await seedUpload();
      const featureA = await createTestFeature(connection, submissionId, 'sample_period', {});
      const featureB = await createTestFeature(connection, submissionId, 'sample_site', {});
      const typeA = await featureTypeIdByName(connection, 'sample_period');
      const typeB = await featureTypeIdByName(connection, 'sample_site');
      const { featureTypePropertyId: ftpA } = await createFeatureTypeProperty(
        connection,
        'sample_period',
        'sample_site'
      );
      const { featureTypePropertyId: ftpB } = await createFeatureTypeProperty(
        connection,
        'sample_site',
        'sample_period'
      );

      // A -> B (valid)
      await insertCandidate({
        uploadId,
        sourceFeatureId: featureA,
        featureTypePropertyId: ftpA,
        propertyName: 'a_to_b',
        rawValue: 'feature::b',
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
      const { submissionId, uploadId, sourceFeatureId, featureTypePropertyId } = await seedSourceAndConfig();
      const targetFeatureId = await createTestFeature(connection, submissionId, 'sample_site', {});
      const targetTypeId = await featureTypeIdByName(connection, 'sample_site');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
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
      const { submissionId, uploadId, sourceFeatureId, featureTypePropertyId } = await seedSourceAndConfig();
      const targetFeatureId = await createTestFeature(connection, submissionId, 'sample_site', {});
      const targetTypeId = await featureTypeIdByName(connection, 'sample_site');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
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
      const { uploadId, sourceFeatureId, featureTypePropertyId } = await seedSourceAndConfig();

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        rawValue: 'feature::nope',
        parsedSourceId: 'nope'
      });

      await repo.insertFeaturePropertiesBySubmissionUploadId(uploadId);

      expect(await getPropertyFeatureRows(sourceFeatureId)).to.have.lengthOf(0);
    });

    it('skips candidates whose resolved type is not allowed', async () => {
      const { submissionId, uploadId, sourceFeatureId, featureTypePropertyId } = await seedSourceAndConfig();
      const wrongTypeFeatureId = await createTestFeature(connection, submissionId, 'sample_technique', {});
      const wrongTypeId = await featureTypeIdByName(connection, 'sample_technique');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        rawValue: 'feature::tech1',
        parsedSourceId: 'tech1',
        referencedFeatureId: wrongTypeFeatureId,
        referencedFeatureTypeId: wrongTypeId
      });

      await repo.insertFeaturePropertiesBySubmissionUploadId(uploadId);

      expect(await getPropertyFeatureRows(sourceFeatureId)).to.have.lengthOf(0);
    });

    it('excludes self-references', async () => {
      const { uploadId, sourceFeatureId, featureTypePropertyId } = await seedSourceAndConfig(
        'sample_site',
        'sample_site'
      );
      const sampleSiteTypeId = await featureTypeIdByName(connection, 'sample_site');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        rawValue: 'feature::self',
        parsedSourceId: 'self',
        referencedFeatureId: sourceFeatureId,
        referencedFeatureTypeId: sampleSiteTypeId
      });

      await repo.insertFeaturePropertiesBySubmissionUploadId(uploadId);

      expect(await getPropertyFeatureRows(sourceFeatureId)).to.have.lengthOf(0);
    });

    it('skips candidates whose source or target feature was soft-deleted after staging (resolve-once staleness guard)', async () => {
      const { submissionId, uploadId } = await seedUpload();
      const targetTypeId = await featureTypeIdByName(connection, 'sample_site');
      const { featureTypePropertyId } = await createFeatureTypeProperty(connection, 'sample_period', 'sample_site');

      // Helper: soft-delete a feature (the concurrent mutation the guard defends against).
      const softDelete = (featureId: number) =>
        connection.sql(SQL`
          UPDATE submission_feature SET record_end_date = now() WHERE submission_feature_id = ${featureId};
        `);

      // 1) Valid candidate — both endpoints active → inserts.
      const liveSource = await createTestFeature(connection, submissionId, 'sample_period', {});
      const liveTarget = await createTestFeature(connection, submissionId, 'sample_site', {});
      // 2) Candidate whose TARGET is soft-deleted after staging → must be skipped.
      const sourceForDeadTarget = await createTestFeature(connection, submissionId, 'sample_period', {});
      const deadTarget = await createTestFeature(connection, submissionId, 'sample_site', {});
      // 3) Candidate whose SOURCE is soft-deleted after staging → must be skipped.
      const deadSource = await createTestFeature(connection, submissionId, 'sample_period', {});
      const targetForDeadSource = await createTestFeature(connection, submissionId, 'sample_site', {});

      for (const [source, target] of [
        [liveSource, liveTarget],
        [sourceForDeadTarget, deadTarget],
        [deadSource, targetForDeadSource]
      ]) {
        await insertCandidate({
          uploadId,
          sourceFeatureId: source,
          featureTypePropertyId,
          referencedFeatureId: target,
          referencedFeatureTypeId: targetTypeId
        });
      }

      // Stale the two endpoints AFTER candidates are staged.
      await softDelete(deadTarget);
      await softDelete(deadSource);

      await repo.insertFeaturePropertiesBySubmissionUploadId(uploadId);

      // Only the all-active candidate inserts; the soft-deleted source and target are excluded.
      expect(await getPropertyFeatureRows(liveSource)).to.have.lengthOf(1);
      expect(await getPropertyFeatureRows(sourceForDeadTarget)).to.have.lengthOf(0);
      expect(await getPropertyFeatureRows(deadSource)).to.have.lengthOf(0);
    });

    it('dedups exact-duplicate references to one row', async () => {
      const { submissionId, uploadId, sourceFeatureId, featureTypePropertyId } = await seedSourceAndConfig(
        'sample_period',
        'sample_site',
        true
      );
      const targetFeatureId = await createTestFeature(connection, submissionId, 'sample_site', {});
      const targetTypeId = await featureTypeIdByName(connection, 'sample_site');

      // Two identical valid candidates (same source, config, referenced feature).
      for (let i = 0; i < 2; i++) {
        await insertCandidate({
          uploadId,
          sourceFeatureId,
          featureTypePropertyId,
          referencedFeatureId: targetFeatureId,
          referencedFeatureTypeId: targetTypeId
        });
      }

      await repo.insertFeaturePropertiesBySubmissionUploadId(uploadId);

      expect(await getPropertyFeatureRows(sourceFeatureId)).to.have.lengthOf(1);
    });

    it('writes only submission_feature_property_feature, never submission_feature_feature', async () => {
      const { submissionId, uploadId, sourceFeatureId, featureTypePropertyId } = await seedSourceAndConfig();
      const targetFeatureId = await createTestFeature(connection, submissionId, 'sample_site', {});
      const targetTypeId = await featureTypeIdByName(connection, 'sample_site');

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
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
      const { submissionId, uploadId, sourceFeatureId, featureTypePropertyId } = await seedSourceAndConfig();
      const targetFeatureId = await createTestFeature(connection, submissionId, 'sample_site', {});
      const targetTypeId = await featureTypeIdByName(connection, 'sample_site');
      await softDeleteFeatureTypeProperty(featureTypePropertyId);

      await insertCandidate({
        uploadId,
        sourceFeatureId,
        featureTypePropertyId,
        referencedFeatureId: targetFeatureId,
        referencedFeatureTypeId: targetTypeId
      });

      await repo.insertFeaturePropertiesBySubmissionUploadId(uploadId);

      expect(await getPropertyFeatureRows(sourceFeatureId)).to.have.lengthOf(0);
    });
  });

  // --- recordDuplicateFeatureSourceIdErrorsBySubmissionUploadId ------------

  describe('recordDuplicateFeatureSourceIdErrorsBySubmissionUploadId', () => {
    it('records one error row with count=3 when three active rows share one source_id', async () => {
      const submissionId = await createTestSubmission(connection);
      const submissionUploadId = await createTestUploadWithFeatures(connection, submissionId, 'survey', [
        { source_id: 'A' },
        { source_id: 'A' },
        { source_id: 'A' }
      ]);

      await repo.recordDuplicateFeatureSourceIdErrorsBySubmissionUploadId(submissionUploadId);

      const errors = await getDuplicateErrors(submissionUploadId);
      expect(errors).to.have.length(1);
      expect(errors[0].count).to.equal(3);
      expect(errors[0].source_id).to.equal('A');
      expect(errors[0].property_name).to.equal(null);
      expect(errors[0].feature_type_property_id).to.equal(null);
    });

    it('records one row per distinct duplicated source_id with correct counts', async () => {
      const submissionId = await createTestSubmission(connection);
      const submissionUploadId = await createTestUploadWithFeatures(connection, submissionId, 'survey', [
        { source_id: 'A' },
        { source_id: 'A' },
        { source_id: 'B' },
        { source_id: 'B' },
        { source_id: 'B' }
      ]);

      await repo.recordDuplicateFeatureSourceIdErrorsBySubmissionUploadId(submissionUploadId);

      const errors = await getDuplicateErrors(submissionUploadId);
      expect(errors).to.have.length(2);

      expect(errors[0].source_id).to.equal('A');
      expect(errors[0].count).to.equal(2);
      expect(errors[0].property_name).to.equal(null);
      expect(errors[0].feature_type_property_id).to.equal(null);

      expect(errors[1].source_id).to.equal('B');
      expect(errors[1].count).to.equal(3);
      expect(errors[1].property_name).to.equal(null);
      expect(errors[1].feature_type_property_id).to.equal(null);
    });

    it('records zero rows when every source_id is unique', async () => {
      const submissionId = await createTestSubmission(connection);
      const submissionUploadId = await createTestUploadWithFeatures(connection, submissionId, 'survey', [
        { source_id: 'A' },
        { source_id: 'B' },
        { source_id: 'C' }
      ]);

      await repo.recordDuplicateFeatureSourceIdErrorsBySubmissionUploadId(submissionUploadId);

      const errors = await getDuplicateErrors(submissionUploadId);
      expect(errors).to.have.length(0);
    });

    it('treats NULL source_ids as non-duplicates and records no error rows', async () => {
      const submissionId = await createTestSubmission(connection);
      const submissionUploadId = await createTestUploadWithFeatures(connection, submissionId, 'survey', [
        { source_id: null },
        { source_id: null }
      ]);

      await repo.recordDuplicateFeatureSourceIdErrorsBySubmissionUploadId(submissionUploadId);

      const errors = await getDuplicateErrors(submissionUploadId);
      expect(errors).to.have.length(0);
    });

    it('ignores soft-deleted rows when checking for duplicates', async () => {
      const submissionId = await createTestSubmission(connection);
      const submissionUploadId = await createTestUploadWithFeatures(connection, submissionId, 'survey', [
        { source_id: 'A' },
        { source_id: 'A', record_end_date: '2026-01-01' }
      ]);

      await repo.recordDuplicateFeatureSourceIdErrorsBySubmissionUploadId(submissionUploadId);

      const errors = await getDuplicateErrors(submissionUploadId);
      expect(errors).to.have.length(0);
    });

    it('records zero rows and does not throw for an empty upload', async () => {
      const submissionId = await createTestSubmission(connection);
      const submissionUploadId = await createTestUploadWithFeatures(connection, submissionId, 'survey', []);

      await repo.recordDuplicateFeatureSourceIdErrorsBySubmissionUploadId(submissionUploadId);

      const errors = await getDuplicateErrors(submissionUploadId);
      expect(errors).to.have.length(0);
    });
  });
});
