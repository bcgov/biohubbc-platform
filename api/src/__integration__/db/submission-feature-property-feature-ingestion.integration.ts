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
// feature_property + feature_type_property (with allowed targets in feature_type_property_feature)
// and uses pre-seeded feature types for the source/target features. The chosen types (mortality,
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
import { describe } from 'mocha';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SubmissionFeaturePropertyIngestionRepository } from '../../repositories/submission-feature-property-ingestion-repository';
import { SubmissionFeaturePropertyIngestionService } from '../../services/ingestion/submission-feature-property-ingestion-service';
import { SubmissionUploadReviewService } from '../../services/upload/submission-upload-review-service';
import {
  createFeatureTypeProperty,
  createTestUpload,
  getPropertyFeatureRows as fetchPropertyFeatureRows,
  getSubmissionFeatureErrors
} from '../helpers/test-feature-property-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

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

  /**
   * Insert one active submission_feature under a specific upload with an explicit source_id and data
   * JSON. Resolution joins on source_id, which createTestFeature does not set and which mints its own
   * upload — so this ticket inserts source + target features into ONE upload directly.
   *
   * @returns The new submission_feature_id.
   */
  async function insertFeatureRow(params: {
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

  /** A submission + upload + one feature_type_property config, plus an upload-bound feature inserter. */
  interface FeatureScenario {
    submissionId: number;
    uploadId: string;
    featureTypePropertyId: number;
    propertyName: string;
    /** Insert a submission_feature into this scenario's submission + upload. */
    insertFeature: (featureTypeName: string, sourceId: string, data?: Record<string, unknown>) => Promise<number>;
  }

  /**
   * Stand up the common arrange block: a submission, a real upload, and one synthetic feature_type_property
   * config (defaulting to mortality → observation_subcount). The returned `insertFeature` is bound to the
   * scenario's submission + upload so tests only state the feature type, source_id, and data that vary.
   */
  async function seedFeatureScenario(config?: {
    sourceFeatureTypeName?: string;
    allowedTargetFeatureTypeName?: string | string[] | null;
    allowMultiple?: boolean;
  }): Promise<FeatureScenario> {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);
    const { featureTypePropertyId, propertyName } = await createFeatureTypeProperty(
      connection,
      config?.sourceFeatureTypeName ?? 'mortality',
      config?.allowedTargetFeatureTypeName === undefined ? 'observation_subcount' : config.allowedTargetFeatureTypeName,
      config?.allowMultiple
    );

    return {
      submissionId,
      uploadId,
      featureTypePropertyId,
      propertyName,
      insertFeature: (featureTypeName, sourceId, data = {}) =>
        insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName, sourceId, data })
    };
  }

  /** Grouped, upload-blocking error rows (count > 0) for an upload. */
  function getErrors(uploadId: string): Promise<{ error_code: string; count: number }[]> {
    return getSubmissionFeatureErrors(connection, uploadId, true);
  }

  /** Canonical property-feature rows for a source feature. */
  function getPropertyFeatureRows(
    sourceFeatureId: number
  ): Promise<{ referenced_submission_feature_id: number; feature_type_property_id: number }[]> {
    return fetchPropertyFeatureRows(connection, sourceFeatureId);
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
    const { submissionId, uploadId, featureTypePropertyId, propertyName, insertFeature } = await seedFeatureScenario();

    const targetFeatureId = await insertFeature('observation_subcount', 'area1');
    const sourceFeatureId = await insertFeature('mortality', 'period-1', {
      properties: { [propertyName]: 'feature::area1' }
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
    const { submissionId, uploadId, featureTypePropertyId, propertyName, insertFeature } = await seedFeatureScenario();

    const targetFeatureId = await insertFeature('observation_subcount', 'area1');
    const sourceFeatureId = await insertFeature('mortality', 'period-1', {
      properties: { [propertyName]: 'feature::area1' }
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
    const { submissionId, uploadId, propertyName, insertFeature } = await seedFeatureScenario();

    await insertFeature('observation_subcount', 'area1');
    await insertFeature('mortality', 'period-1', { properties: { [propertyName]: 'feature::nope' } });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('invalid');

    const errors = await getErrors(uploadId);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].error_code).to.equal('UNRESOLVED_FEATURE_REFERENCE');
    expect(await countPropertyFeatureRowsForUpload(uploadId)).to.equal(0);
  });

  it('4: malformed reference (features::area1) — one INVALID_FEATURE_REFERENCE_FORMAT, zero canonical rows', async () => {
    const { submissionId, uploadId, propertyName, insertFeature } = await seedFeatureScenario();

    await insertFeature('observation_subcount', 'area1');
    await insertFeature('mortality', 'period-1', { properties: { [propertyName]: 'features::area1' } });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('invalid');

    const errors = await getErrors(uploadId);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].error_code).to.equal('INVALID_FEATURE_REFERENCE_FORMAT');
    expect(await countPropertyFeatureRowsForUpload(uploadId)).to.equal(0);
  });

  it('5: wrong-type resolution — one INVALID_FEATURE_REFERENCE_TYPE, zero canonical rows', async () => {
    // Config allows observation_subcount, but the reference resolves to a species_observation sibling.
    const { submissionId, uploadId, propertyName, insertFeature } = await seedFeatureScenario();

    await insertFeature('species_observation', 'tech1');
    await insertFeature('mortality', 'period-1', { properties: { [propertyName]: 'feature::tech1' } });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('invalid');

    const errors = await getErrors(uploadId);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].error_code).to.equal('INVALID_FEATURE_REFERENCE_TYPE');
    expect(await countPropertyFeatureRowsForUpload(uploadId)).to.equal(0);
  });

  it('6: two valid + one invalid in the same upload — zero canonical rows for the WHOLE upload (Phase 9 gate)', async () => {
    const { submissionId, uploadId, propertyName, insertFeature } = await seedFeatureScenario();

    await insertFeature('observation_subcount', 'area1');
    await insertFeature('observation_subcount', 'area2');
    // Two valid references...
    await insertFeature('mortality', 'period-1', { properties: { [propertyName]: 'feature::area1' } });
    await insertFeature('mortality', 'period-2', { properties: { [propertyName]: 'feature::area2' } });
    // ...and one unresolved reference, which fails the whole upload.
    await insertFeature('mortality', 'period-3', { properties: { [propertyName]: 'feature::nope' } });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('invalid');

    const errors = await getErrors(uploadId);
    expect(errors.some((e) => e.error_code === 'UNRESOLVED_FEATURE_REFERENCE')).to.equal(true);
    // The valid siblings are NOT inserted — the whole upload is blocked.
    expect(await countPropertyFeatureRowsForUpload(uploadId)).to.equal(0);
  });

  it('7: multi-valued ["feature::s1","feature::s2"] both resolve & allowed — two canonical rows', async () => {
    const { submissionId, uploadId, propertyName, insertFeature } = await seedFeatureScenario({ allowMultiple: true });

    const targetA = await insertFeature('observation_subcount', 's1');
    const targetB = await insertFeature('observation_subcount', 's2');
    const sourceFeatureId = await insertFeature('mortality', 'period-1', {
      properties: { [propertyName]: ['feature::s1', 'feature::s2'] }
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
    const { submissionId, uploadId, propertyName, insertFeature } = await seedFeatureScenario({ allowMultiple: true });

    const targetA = await insertFeature('observation_subcount', 's1');
    const sourceFeatureId = await insertFeature('mortality', 'period-1', {
      properties: { [propertyName]: ['feature::s1', 'feature::s1'] }
    });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('ok');

    expect(await getErrors(uploadId)).to.have.lengthOf(0);
    const rows = await getPropertyFeatureRows(sourceFeatureId);
    expect(rows).to.have.lengthOf(1);
    expect(rows[0].referenced_submission_feature_id).to.equal(targetA);
  });

  it('9: single-valued prop given ["feature::s1"] array — MULTIPLE_VALUES_NOT_ALLOWED, zero canonical rows', async () => {
    const { submissionId, uploadId, propertyName, insertFeature } = await seedFeatureScenario({ allowMultiple: false });

    await insertFeature('observation_subcount', 's1');
    await insertFeature('mortality', 'period-1', { properties: { [propertyName]: ['feature::s1'] } });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('invalid');

    const errors = await getErrors(uploadId);
    expect(errors.some((e) => e.error_code === 'MULTIPLE_VALUES_NOT_ALLOWED')).to.equal(true);
    expect(await countPropertyFeatureRowsForUpload(uploadId)).to.equal(0);
  });

  it('10: self-reference — INVALID_FEATURE_REFERENCE_SELF, zero canonical rows (upload blocked)', async () => {
    // Source is an observation_subcount; config allows observation_subcount; the property points at its own source_id.
    const { submissionId, uploadId, propertyName, insertFeature } = await seedFeatureScenario({
      sourceFeatureTypeName: 'observation_subcount',
      allowedTargetFeatureTypeName: 'observation_subcount'
    });

    const sourceFeatureId = await insertFeature('observation_subcount', 'self-area', {
      properties: { [propertyName]: 'feature::self-area' }
    });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('invalid');

    const errors = await getErrors(uploadId);
    expect(errors.some((e) => e.error_code === 'INVALID_FEATURE_REFERENCE_SELF')).to.equal(true);
    expect(await getPropertyFeatureRows(sourceFeatureId)).to.have.lengthOf(0);
    expect(await countPropertyFeatureRowsForUpload(uploadId)).to.equal(0);
  });

  it('11: channel separation — data.content lands in submission_feature_feature, prop in submission_feature_property_feature', async () => {
    const { submissionId, uploadId, propertyName, insertFeature } = await seedFeatureScenario();

    // propTarget: referenced by the feature-valued property.
    const propTargetId = await insertFeature('observation_subcount', 'prop-target');
    // contentTarget: referenced by data.content (a distinct relationship channel).
    const contentTargetId = await insertFeature('species_observation', 'content-target');
    // Source carries BOTH a data.content reference AND a feature-valued property.
    const sourceFeatureId = await insertFeature('mortality', 'period-1', {
      content: ['content-target'],
      properties: { [propertyName]: 'feature::prop-target' }
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
    const { submissionId, uploadId, propertyName, insertFeature } = await seedFeatureScenario();

    const targetFeatureId = await insertFeature('observation_subcount', 'area1');
    const sourceFeatureId = await insertFeature('mortality', 'period-1', {
      properties: { [propertyName]: 'feature:: area1' }
    });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('ok');

    expect(await getErrors(uploadId)).to.have.lengthOf(0);
    const rows = await getPropertyFeatureRows(sourceFeatureId);
    expect(rows).to.have.lengthOf(1);
    expect(rows[0].referenced_submission_feature_id).to.equal(targetFeatureId);
  });

  it('13: circular reference (A.prop -> B, B.prop -> A) — CIRCULAR_FEATURE_REFERENCE, zero canonical rows', async () => {
    // A (mortality) -> B (observation_subcount); B (observation_subcount) -> A (mortality). Both types allowed.
    const { submissionId, uploadId, propertyName: propAtoB, insertFeature } = await seedFeatureScenario();
    const { propertyName: propBtoA } = await createFeatureTypeProperty(connection, 'observation_subcount', 'mortality');

    await insertFeature('mortality', 'a', { properties: { [propAtoB]: 'feature::b' } });
    await insertFeature('observation_subcount', 'b', { properties: { [propBtoA]: 'feature::a' } });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);
    expect(outcome.status).to.equal('invalid');

    const errors = await getErrors(uploadId);
    expect(errors.filter((e) => e.error_code === 'CIRCULAR_FEATURE_REFERENCE').length).to.be.greaterThan(0);
    expect(await countPropertyFeatureRowsForUpload(uploadId)).to.equal(0);
  });

  // AC-14: the new error codes surface through the existing aggregate-error reader, with no
  // feature-specific wiring — they are plain rows in submission_feature_error.
  it('14: new error codes surface via getIngestionErrorCountsByCode', async () => {
    const { submissionId, uploadId, propertyName, insertFeature } = await seedFeatureScenario();

    await insertFeature('mortality', 'period-1', { properties: { [propertyName]: 'feature::nope' } });

    await service.indexSubmissionPropertiesBySubmissionUploadId(submissionId, uploadId);

    const counts = await repo.getIngestionErrorCountsByCode(uploadId);
    expect(counts.some((c) => c.error_code === 'UNRESOLVED_FEATURE_REFERENCE')).to.equal(true);
  });
});
