// Service-level integration tests for matching tarball property keys to feature property names.
//
// Property names are stored trimmed and lowercase, so a key matches its property whatever case or padding the
// tarball uses. Drives the full pipeline via SubmissionFeaturePropertyIngestionService
// .indexSubmissionPropertiesBySubmissionUploadId and asserts on the string property table and the error accumulator
// (submission_feature_error).
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: database container running with seed data.

import { expect } from 'chai';
import { describe } from 'mocha';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SubmissionFeaturePropertyIngestionService } from '../../services/ingestion/submission-feature-property-ingestion-service';
import {
  createAssignedFeatureProperty,
  createTestUpload,
  getSubmissionFeatureErrors
} from '../helpers/test-feature-property-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

/** Feature type the synthetic property is assigned to. It carries no required catalog properties. */
const FEATURE_TYPE = 'mortality';

describe('SubmissionFeaturePropertyIngestionService — property key case (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let service: SubmissionFeaturePropertyIngestionService;

  before(() => initDBPool(defaultPoolConfig));

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new SubmissionFeaturePropertyIngestionService(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  /** A submission and upload pinned to the default Blueprint, with one string property assigned. */
  interface PropertyScenario {
    submissionId: number;
    uploadId: string;
    assignmentId: number;
    propertyName: string;
  }

  /**
   * Create a submission, an upload, and a synthetic string property assigned to {@link FEATURE_TYPE}.
   *
   * @returns {Promise<PropertyScenario>} Scenario identifiers.
   */
  async function seedPropertyScenario(): Promise<PropertyScenario> {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);
    const { featurePropertyId, assignments } = await createAssignedFeatureProperty(connection, 'string', [
      FEATURE_TYPE
    ]);
    const property = await connection.sql(
      SQL`SELECT name FROM feature_property WHERE feature_property_id = ${featurePropertyId}`
    );

    return { submissionId, uploadId, assignmentId: assignments[FEATURE_TYPE], propertyName: property.rows[0].name };
  }

  /**
   * Insert an active feature into the scenario's upload with the given properties.
   *
   * @param {PropertyScenario} scenario Owning scenario.
   * @param {Record<string, unknown>} properties The feature's `data.properties`.
   * @returns {Promise<number>} The new submission_feature_id.
   */
  async function insertFeature(scenario: PropertyScenario, properties: Record<string, unknown>): Promise<number> {
    const dataJson = JSON.stringify({ properties });
    const result = await connection.sql(SQL`
      INSERT INTO submission_feature (
        submission_id,
        submission_upload_id,
        feature_type_id,
        data,
        data_byte_size,
        record_effective_date
      )
      VALUES (
        ${scenario.submissionId},
        ${scenario.uploadId}::uuid,
        (SELECT feature_type_id FROM feature_type WHERE name = ${FEATURE_TYPE} AND record_end_date IS NULL),
        ${dataJson}::jsonb,
        octet_length(${dataJson}::jsonb::text) + 500,
        now()
      )
      RETURNING submission_feature_id;
    `);

    return result.rows[0].submission_feature_id;
  }

  /**
   * Read the stored string values for a feature.
   *
   * @param {number} featureId Owning feature.
   * @returns {Promise<{ blueprint_feature_type_property_id: number; value: string }[]>} Stored rows.
   */
  async function getStoredValues(
    featureId: number
  ): Promise<{ blueprint_feature_type_property_id: number; value: string }[]> {
    const result = await connection.sql(SQL`
      SELECT blueprint_feature_type_property_id, value
      FROM submission_feature_property_string
      WHERE submission_feature_id = ${featureId}
      ORDER BY submission_feature_property_string_id
    `);

    return result.rows;
  }

  it('stores a value supplied under a key that differs from the property name by case and padding', async () => {
    const scenario = await seedPropertyScenario();
    const featureId = await insertFeature(scenario, { [` ${scenario.propertyName.toUpperCase()} `]: 'North fence' });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(
      scenario.submissionId,
      scenario.uploadId
    );

    expect(outcome.status).to.equal('ok');
    expect(await getSubmissionFeatureErrors(connection, scenario.uploadId, true)).to.have.lengthOf(0);
    expect(await getStoredValues(featureId)).to.eql([
      { blueprint_feature_type_property_id: scenario.assignmentId, value: 'North fence' }
    ]);
  });

  it('records MULTIPLE_VALUES_NOT_ALLOWED and stores nothing when keys differing only by case supply one property', async () => {
    const scenario = await seedPropertyScenario();
    await connection.sql(SQL`
      UPDATE blueprint_feature_type_property
      SET allow_multiple = false
      WHERE blueprint_feature_type_property_id = ${scenario.assignmentId}
    `);
    const featureId = await insertFeature(scenario, {
      [scenario.propertyName]: 'North fence',
      [scenario.propertyName.toUpperCase()]: 'South fence'
    });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(
      scenario.submissionId,
      scenario.uploadId
    );

    expect(outcome.status).to.equal('invalid');
    // One error row per submitted key, since errors are grouped by the key as submitted.
    expect(await getSubmissionFeatureErrors(connection, scenario.uploadId, true)).to.eql([
      { error_code: 'MULTIPLE_VALUES_NOT_ALLOWED', count: 1 },
      { error_code: 'MULTIPLE_VALUES_NOT_ALLOWED', count: 1 }
    ]);
    expect(await getStoredValues(featureId)).to.have.lengthOf(0);
  });
});
