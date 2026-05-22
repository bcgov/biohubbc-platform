// Service-level integration tests for the feature-backed property indexing engine.
//
// Drives the FULL pipeline end-to-end via
// SubmissionFeaturePropertyIngestionService.indexSubmissionPropertiesBySubmissionUploadId, then
// asserts on the canonical table (submission_feature_property_feature) and the error accumulator
// (submission_feature_error). Unlike the repository-level suite (which hand-inserts staging
// candidates to observe each branch in isolation), these tests set up real submission_feature rows
// whose data.properties carry `feature::<source_id>` values, so the populate/parse/resolve phases
// run for real and the Phase 9 fail-fast gate is exercised: any error zeroes ALL canonical writes
// for the whole upload.
//
// Scope C — no production catalog is touched. Each test mints a SYNTHETIC `feature`-typed
// feature_property + feature_type_property (with allowed_referenced_feature_type_id) and uses
// pre-seeded feature types for the source/target features. The chosen types (mortality,
// observation_subcount, species_observation) carry NO required catalog properties, so the full
// pipeline reaches the canonical-insert phase without unrelated MISSING_REQUIRED_PROPERTY errors
// from the seeded type's other required fields.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: docker compose exec api npx mocha --config .mocharc.integration.json \
//        'src/__integration__/db/submission-feature-property-feature-ingestion.integration.ts'
// Requires: database container running with seed data.

import { expect } from 'chai';
import crypto from 'crypto';
import { describe } from 'mocha';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SubmissionFeaturePropertyIngestionRepository } from '../../repositories/submission-feature-property-ingestion-repository';
import { SubmissionFeaturePropertyIngestionService } from '../../services/ingestion/submission-feature-property-ingestion-service';
import { SubmissionUploadReviewService } from '../../services/upload/submission-upload-review-service';
import { createTestSubmission, getOrCreateIntegrationTicketId } from '../helpers/test-submission-helpers';

describe('SubmissionFeaturePropertyIngestionService — feature property indexing (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let service: SubmissionFeaturePropertyIngestionService;
  let repo: SubmissionFeaturePropertyIngestionRepository;

  before(() => initDBPool(defaultPoolConfig));

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new SubmissionFeaturePropertyIngestionService(connection);
    repo = new SubmissionFeaturePropertyIngestionRepository(connection);

    // The default-review request is the last step of a successful index run and is unrelated to the
    // feature-property engine under test. Stub it so the assertions target the engine's outputs.
    sinon.stub(SubmissionUploadReviewService.prototype, 'requestDefaultReviewsForUpload').resolves();
  });

  afterEach(async () => {
    sinon.restore();
    await connection.rollback();
    connection.release();
  });

  // --- local fixture helpers -----------------------------------------------

  /** Resolve a seeded feature_type by name to its id. */
  async function featureTypeIdByName(name: string): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT feature_type_id FROM feature_type WHERE name = ${name} LIMIT 1;
    `);
    return result.rows[0].feature_type_id;
  }

  /** Create a real submission_upload row for a submission and return its uuid. */
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

  /**
   * Create a synthetic `feature`-typed feature_property and assign it to a source feature type via
   * feature_type_property with an allowed target type. Mirrors download-parquet's
   * insertCodeFeatureProperty but for the 'feature' property type plus the allowed-target column.
   *
   * @returns The new feature_type_property_id and the feature_property.name to use as the
   *   data.properties key on source features.
   */
  async function createFeatureTypeProperty(params: {
    sourceFeatureTypeName: string;
    allowedTargetFeatureTypeName: string | null;
    allowMultiple?: boolean;
  }): Promise<{ featureTypePropertyId: number; propertyName: string }> {
    const systemUserId = connection.systemUserId();

    const fptResult = await connection.sql(SQL`
      SELECT feature_property_type_id FROM feature_property_type WHERE name = 'feature';
    `);
    const featurePropertyTypeId = fptResult.rows[0].feature_property_type_id;

    const propertyName = `test_feature_ref_${crypto.randomInt(0, 1_000_000_000)}`;
    const fpResult = await connection.sql(SQL`
      INSERT INTO feature_property (feature_property_type_id, name, display_name, record_effective_date, create_user)
      VALUES (${featurePropertyTypeId}, ${propertyName}, ${propertyName}, now(), ${systemUserId})
      RETURNING feature_property_id;
    `);
    const featurePropertyId = fpResult.rows[0].feature_property_id;

    const allowedFeatureTypeId =
      params.allowedTargetFeatureTypeName === null
        ? null
        : await featureTypeIdByName(params.allowedTargetFeatureTypeName);

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
        (SELECT feature_type_id FROM feature_type WHERE name = ${params.sourceFeatureTypeName} LIMIT 1),
        ${featurePropertyId},
        ${params.allowMultiple ?? false},
        ${allowedFeatureTypeId},
        now(),
        ${systemUserId}
      )
      RETURNING feature_type_property_id;
    `);

    return { featureTypePropertyId: ftpResult.rows[0].feature_type_property_id, propertyName };
  }

  /**
   * Insert one active submission_feature under a specific upload with an explicit source_id and data
   * JSON. Resolution joins on source_id, which createTestFeature does not set and which mints its own
   * upload — so this ticket inserts source + target features into ONE upload directly.
   *
   * @returns The new submission_feature_id.
   */
  async function insertFeature(params: {
    submissionId: number;
    submissionUploadId: string;
    featureTypeName: string;
    sourceId: string;
    data: Record<string, unknown>;
  }): Promise<number> {
    const systemUserId = connection.systemUserId();
    const dataJson = JSON.stringify(params.data);

    const result = await connection.sql(SQL`
      INSERT INTO submission_feature (
        submission_id,
        submission_upload_id,
        feature_type_id,
        source_id,
        data,
        data_byte_size,
        record_effective_date,
        create_user
      )
      VALUES (
        ${params.submissionId},
        ${params.submissionUploadId}::uuid,
        (SELECT feature_type_id FROM feature_type WHERE name = ${params.featureTypeName} LIMIT 1),
        ${params.sourceId},
        ${dataJson}::jsonb,
        octet_length(${dataJson}::jsonb::text) + 500,
        now(),
        ${systemUserId}
      )
      RETURNING submission_feature_id;
    `);

    return result.rows[0].submission_feature_id;
  }

  /**
   * Fetch grouped error rows for an upload, ordered by code.
   *
   * Filters to count > 0: the engine writes a benign count-0 `UNRESOLVED_PARENT` diagnostic row for
   * every feature, and the Phase 9 fail-fast gate keys off `SUM(count)`, so only count > 0 rows are
   * upload-blocking. Matching that semantics keeps assertions about "the errors" meaningful.
   */
  async function getErrors(uploadId: string): Promise<{ error_code: string; count: number }[]> {
    const result = await connection.sql(SQL`
      SELECT error_code, count
      FROM submission_feature_error
      WHERE submission_upload_id = ${uploadId}::uuid
        AND count > 0
      ORDER BY error_code;
    `);
    return result.rows;
  }

  /** Fetch canonical property-feature rows for a source feature. */
  async function getPropertyFeatureRows(
    sourceFeatureId: number
  ): Promise<{ referenced_submission_feature_id: number; feature_type_property_id: number }[]> {
    const result = await connection.sql(SQL`
      SELECT referenced_submission_feature_id, feature_type_property_id
      FROM submission_feature_property_feature
      WHERE submission_feature_id = ${sourceFeatureId}
      ORDER BY referenced_submission_feature_id;
    `);
    return result.rows;
  }

  /** Count all canonical property-feature rows written for an upload's features. */
  async function countPropertyFeatureRowsForUpload(uploadId: string): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT COUNT(*)::integer AS count
      FROM submission_feature_property_feature sfpf
      JOIN submission_feature sf ON sf.submission_feature_id = sfpf.submission_feature_id
      WHERE sf.submission_upload_id = ${uploadId}::uuid;
    `);
    return result.rows[0].count;
  }

  // --- scenarios -----------------------------------------------------------

  it('1: happy path — one canonical row, no errors', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(submissionId);
    const { featureTypePropertyId, propertyName } = await createFeatureTypeProperty({
      sourceFeatureTypeName: 'mortality',
      allowedTargetFeatureTypeName: 'observation_subcount'
    });

    const targetFeatureId = await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'observation_subcount',
      sourceId: 'area1',
      data: {}
    });
    const sourceFeatureId = await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'mortality',
      sourceId: 'period-1',
      data: { properties: { [propertyName]: 'feature::area1' } }
    });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('ok');

    expect(await getErrors(uploadId)).to.have.lengthOf(0);
    const rows = await getPropertyFeatureRows(sourceFeatureId);
    expect(rows).to.have.lengthOf(1);
    expect(rows[0].referenced_submission_feature_id).to.equal(targetFeatureId);
    expect(rows[0].feature_type_property_id).to.equal(featureTypePropertyId);
  });

  it('2: idempotent rerun — identical canonical row set, no duplicates/orphans', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(submissionId);
    const { featureTypePropertyId, propertyName } = await createFeatureTypeProperty({
      sourceFeatureTypeName: 'mortality',
      allowedTargetFeatureTypeName: 'observation_subcount'
    });

    const targetFeatureId = await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'observation_subcount',
      sourceId: 'area1',
      data: {}
    });
    const sourceFeatureId = await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'mortality',
      sourceId: 'period-1',
      data: { properties: { [propertyName]: 'feature::area1' } }
    });

    await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    const firstRun = await getPropertyFeatureRows(sourceFeatureId);

    await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    const secondRun = await getPropertyFeatureRows(sourceFeatureId);

    expect(firstRun).to.have.lengthOf(1);
    expect(secondRun).to.deep.equal(firstRun);
    expect(secondRun[0].referenced_submission_feature_id).to.equal(targetFeatureId);
    expect(secondRun[0].feature_type_property_id).to.equal(featureTypePropertyId);
  });

  it('3: unresolved reference (feature::nope) — one UNRESOLVED_FEATURE_REFERENCE, zero canonical rows', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(submissionId);
    const { propertyName } = await createFeatureTypeProperty({
      sourceFeatureTypeName: 'mortality',
      allowedTargetFeatureTypeName: 'observation_subcount'
    });

    await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'observation_subcount',
      sourceId: 'area1',
      data: {}
    });
    await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'mortality',
      sourceId: 'period-1',
      data: { properties: { [propertyName]: 'feature::nope' } }
    });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('invalid');

    const errors = await getErrors(uploadId);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].error_code).to.equal('UNRESOLVED_FEATURE_REFERENCE');
    expect(await countPropertyFeatureRowsForUpload(uploadId)).to.equal(0);
  });

  it('4: malformed reference (features::area1) — one INVALID_FEATURE_REFERENCE_FORMAT, zero canonical rows', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(submissionId);
    const { propertyName } = await createFeatureTypeProperty({
      sourceFeatureTypeName: 'mortality',
      allowedTargetFeatureTypeName: 'observation_subcount'
    });

    await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'observation_subcount',
      sourceId: 'area1',
      data: {}
    });
    await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'mortality',
      sourceId: 'period-1',
      data: { properties: { [propertyName]: 'features::area1' } }
    });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('invalid');

    const errors = await getErrors(uploadId);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].error_code).to.equal('INVALID_FEATURE_REFERENCE_FORMAT');
    expect(await countPropertyFeatureRowsForUpload(uploadId)).to.equal(0);
  });

  it('5: wrong-type resolution — one INVALID_FEATURE_REFERENCE_TYPE, zero canonical rows', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(submissionId);
    // Config allows sample_site, but the reference resolves to a sample_technique sibling.
    const { propertyName } = await createFeatureTypeProperty({
      sourceFeatureTypeName: 'mortality',
      allowedTargetFeatureTypeName: 'observation_subcount'
    });

    await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'species_observation',
      sourceId: 'tech1',
      data: {}
    });
    await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'mortality',
      sourceId: 'period-1',
      data: { properties: { [propertyName]: 'feature::tech1' } }
    });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('invalid');

    const errors = await getErrors(uploadId);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].error_code).to.equal('INVALID_FEATURE_REFERENCE_TYPE');
    expect(await countPropertyFeatureRowsForUpload(uploadId)).to.equal(0);
  });

  it('6: two valid + one invalid in the same upload — zero canonical rows for the WHOLE upload (Phase 9 gate)', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(submissionId);
    const { propertyName } = await createFeatureTypeProperty({
      sourceFeatureTypeName: 'mortality',
      allowedTargetFeatureTypeName: 'observation_subcount'
    });

    await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'observation_subcount',
      sourceId: 'area1',
      data: {}
    });
    await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'observation_subcount',
      sourceId: 'area2',
      data: {}
    });
    // Two valid references...
    await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'mortality',
      sourceId: 'period-1',
      data: { properties: { [propertyName]: 'feature::area1' } }
    });
    await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'mortality',
      sourceId: 'period-2',
      data: { properties: { [propertyName]: 'feature::area2' } }
    });
    // ...and one unresolved reference, which fails the whole upload.
    await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'mortality',
      sourceId: 'period-3',
      data: { properties: { [propertyName]: 'feature::nope' } }
    });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('invalid');

    const errors = await getErrors(uploadId);
    expect(errors.some((e) => e.error_code === 'UNRESOLVED_FEATURE_REFERENCE')).to.equal(true);
    // The valid siblings are NOT inserted — the whole upload is blocked.
    expect(await countPropertyFeatureRowsForUpload(uploadId)).to.equal(0);
  });

  it('7: multi-valued ["feature::s1","feature::s2"] both resolve & allowed — two canonical rows', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(submissionId);
    const { propertyName } = await createFeatureTypeProperty({
      sourceFeatureTypeName: 'mortality',
      allowedTargetFeatureTypeName: 'observation_subcount',
      allowMultiple: true
    });

    const targetA = await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'observation_subcount',
      sourceId: 's1',
      data: {}
    });
    const targetB = await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'observation_subcount',
      sourceId: 's2',
      data: {}
    });
    const sourceFeatureId = await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'mortality',
      sourceId: 'period-1',
      data: { properties: { [propertyName]: ['feature::s1', 'feature::s2'] } }
    });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('ok');

    expect(await getErrors(uploadId)).to.have.lengthOf(0);
    const rows = await getPropertyFeatureRows(sourceFeatureId);
    expect(rows).to.have.lengthOf(2);
    expect(rows.map((r) => r.referenced_submission_feature_id).sort((a, b) => a - b)).to.deep.equal(
      [targetA, targetB].sort((a, b) => a - b)
    );
  });

  it('8: multi-valued ["feature::s1","feature::s1"] exact duplicate — one canonical row (ON CONFLICT dedup)', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(submissionId);
    const { propertyName } = await createFeatureTypeProperty({
      sourceFeatureTypeName: 'mortality',
      allowedTargetFeatureTypeName: 'observation_subcount',
      allowMultiple: true
    });

    const targetA = await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'observation_subcount',
      sourceId: 's1',
      data: {}
    });
    const sourceFeatureId = await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'mortality',
      sourceId: 'period-1',
      data: { properties: { [propertyName]: ['feature::s1', 'feature::s1'] } }
    });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('ok');

    expect(await getErrors(uploadId)).to.have.lengthOf(0);
    const rows = await getPropertyFeatureRows(sourceFeatureId);
    expect(rows).to.have.lengthOf(1);
    expect(rows[0].referenced_submission_feature_id).to.equal(targetA);
  });

  it('9: single-valued prop given ["feature::s1"] array — MULTIPLE_VALUES_NOT_ALLOWED, zero canonical rows', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(submissionId);
    const { propertyName } = await createFeatureTypeProperty({
      sourceFeatureTypeName: 'mortality',
      allowedTargetFeatureTypeName: 'observation_subcount',
      allowMultiple: false
    });

    await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'observation_subcount',
      sourceId: 's1',
      data: {}
    });
    await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'mortality',
      sourceId: 'period-1',
      data: { properties: { [propertyName]: ['feature::s1'] } }
    });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('invalid');

    const errors = await getErrors(uploadId);
    expect(errors.some((e) => e.error_code === 'MULTIPLE_VALUES_NOT_ALLOWED')).to.equal(true);
    expect(await countPropertyFeatureRowsForUpload(uploadId)).to.equal(0);
  });

  it('10: self-reference — INVALID_FEATURE_REFERENCE_SELF, zero canonical rows (upload blocked)', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(submissionId);
    // Source is a sample_site; config allows sample_site; the property points at its own source_id.
    const { propertyName } = await createFeatureTypeProperty({
      sourceFeatureTypeName: 'observation_subcount',
      allowedTargetFeatureTypeName: 'observation_subcount'
    });

    const sourceFeatureId = await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'observation_subcount',
      sourceId: 'self-area',
      data: { properties: { [propertyName]: 'feature::self-area' } }
    });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('invalid');

    const errors = await getErrors(uploadId);
    expect(errors.some((e) => e.error_code === 'INVALID_FEATURE_REFERENCE_SELF')).to.equal(true);
    expect(await getPropertyFeatureRows(sourceFeatureId)).to.have.lengthOf(0);
    expect(await countPropertyFeatureRowsForUpload(uploadId)).to.equal(0);
  });

  it('11: channel separation — data.content lands in submission_feature_feature, prop in submission_feature_property_feature', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(submissionId);
    const { propertyName } = await createFeatureTypeProperty({
      sourceFeatureTypeName: 'mortality',
      allowedTargetFeatureTypeName: 'observation_subcount'
    });

    // propTarget: referenced by the feature-valued property.
    const propTargetId = await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'observation_subcount',
      sourceId: 'prop-target',
      data: {}
    });
    // contentTarget: referenced by data.content (a distinct relationship channel).
    const contentTargetId = await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'species_observation',
      sourceId: 'content-target',
      data: {}
    });
    // Source carries BOTH a data.content reference AND a feature-valued property.
    const sourceFeatureId = await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'mortality',
      sourceId: 'period-1',
      data: {
        content: ['content-target'],
        properties: { [propertyName]: 'feature::prop-target' }
      }
    });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('ok');

    // The property reference lands ONLY in submission_feature_property_feature.
    const propRows = await getPropertyFeatureRows(sourceFeatureId);
    expect(propRows).to.have.lengthOf(1);
    expect(propRows[0].referenced_submission_feature_id).to.equal(propTargetId);

    // The data.content reference lands ONLY in submission_feature_feature.
    const sffResult = await connection.sql(SQL`
      SELECT source_feature_id, target_feature_id
      FROM submission_feature_feature
      WHERE source_feature_id = ${sourceFeatureId};
    `);
    expect(sffResult.rows).to.have.lengthOf(1);
    expect(sffResult.rows[0].target_feature_id).to.equal(contentTargetId);

    // No cross-write: the property table never holds the content target,
    // and the relationship table never holds the property target.
    expect(propRows.some((r) => r.referenced_submission_feature_id === contentTargetId)).to.equal(false);
    expect(sffResult.rows.some((r) => r.target_feature_id === propTargetId)).to.equal(false);
  });

  it('12: whitespace (feature:: area1) — resolves to area1, one canonical row', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(submissionId);
    const { propertyName } = await createFeatureTypeProperty({
      sourceFeatureTypeName: 'mortality',
      allowedTargetFeatureTypeName: 'observation_subcount'
    });

    const targetFeatureId = await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'observation_subcount',
      sourceId: 'area1',
      data: {}
    });
    const sourceFeatureId = await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'mortality',
      sourceId: 'period-1',
      data: { properties: { [propertyName]: 'feature:: area1' } }
    });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('ok');

    expect(await getErrors(uploadId)).to.have.lengthOf(0);
    const rows = await getPropertyFeatureRows(sourceFeatureId);
    expect(rows).to.have.lengthOf(1);
    expect(rows[0].referenced_submission_feature_id).to.equal(targetFeatureId);
  });

  it('13: circular reference (A.prop -> B, B.prop -> A) — CIRCULAR_FEATURE_REFERENCE, zero canonical rows', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(submissionId);
    // A (sample_period) -> B (sample_site); B (sample_site) -> A (sample_period). Both types allowed.
    const { propertyName: propAtoB } = await createFeatureTypeProperty({
      sourceFeatureTypeName: 'mortality',
      allowedTargetFeatureTypeName: 'observation_subcount'
    });
    const { propertyName: propBtoA } = await createFeatureTypeProperty({
      sourceFeatureTypeName: 'observation_subcount',
      allowedTargetFeatureTypeName: 'mortality'
    });

    await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'mortality',
      sourceId: 'a',
      data: { properties: { [propAtoB]: 'feature::b' } }
    });
    await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'observation_subcount',
      sourceId: 'b',
      data: { properties: { [propBtoA]: 'feature::a' } }
    });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('invalid');

    const errors = await getErrors(uploadId);
    expect(errors.filter((e) => e.error_code === 'CIRCULAR_FEATURE_REFERENCE').length).to.be.greaterThan(0);
    expect(await countPropertyFeatureRowsForUpload(uploadId)).to.equal(0);
  });

  // AC-14: the new error codes surface through the existing aggregate-error reader, with no
  // feature-specific wiring — they are plain rows in submission_feature_error.
  it('14: new error codes surface via getIngestionErrorCountsByCode', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(submissionId);
    const { propertyName } = await createFeatureTypeProperty({
      sourceFeatureTypeName: 'mortality',
      allowedTargetFeatureTypeName: 'observation_subcount'
    });

    await insertFeature({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'mortality',
      sourceId: 'period-1',
      data: { properties: { [propertyName]: 'feature::nope' } }
    });

    await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);

    const counts = await repo.getIngestionErrorCountsByCode(uploadId);
    expect(counts.some((c) => c.error_code === 'UNRESOLVED_FEATURE_REFERENCE')).to.equal(true);
  });
});
