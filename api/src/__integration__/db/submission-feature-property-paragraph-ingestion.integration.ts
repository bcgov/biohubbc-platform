// Service-level integration tests for long text indexing: paragraph properties and the string length limit.
//
// Drives the full pipeline via SubmissionFeaturePropertyIngestionService.indexSubmissionPropertiesBySubmissionUploadId
// for features whose data.properties carry a value of a synthetic `paragraph`- or `string`-typed property, then
// asserts on the typed property tables and the error accumulator (submission_feature_error). Also covers the
// storage-type trigger that keeps paragraph values out of the string table and string values out of the paragraph
// table.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: database container running with seed data.

import { expect } from 'chai';
import { describe } from 'mocha';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { SubmissionFeaturePropertyIngestionService } from '../../services/ingestion/submission-feature-property-ingestion-service';
import {
  addPropertyValue,
  createAssignedFeatureProperty,
  createTestUpload,
  getSubmissionFeatureErrors
} from '../helpers/test-feature-property-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

/** Feature type the synthetic properties are assigned to. It carries no required catalog properties. */
const FEATURE_TYPE = 'mortality';

/** A paragraph value well beyond the 250-character string limit. */
const ABSTRACT = `Abstract. ${'Caribou were tracked across the northern range over three seasons. '.repeat(30)}End.`;

describe('SubmissionFeaturePropertyIngestionService — long text property indexing (integration)', function () {
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

  /** A submission and upload pinned to the default Blueprint, with one property of the given type assigned. */
  interface PropertyScenario {
    submissionId: number;
    uploadId: string;
    assignmentId: number;
    propertyName: string;
  }

  /**
   * Create a submission, an upload, and a synthetic property of the given type assigned to {@link FEATURE_TYPE}.
   *
   * @param {string} propertyTypeName Property type of the synthetic property.
   * @returns {Promise<PropertyScenario>} Scenario identifiers.
   */
  async function seedPropertyScenario(propertyTypeName: string): Promise<PropertyScenario> {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);
    const { featurePropertyId, assignments } = await createAssignedFeatureProperty(connection, propertyTypeName, [
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
        record_effective_date,
        create_user
      )
      VALUES (
        ${scenario.submissionId},
        ${scenario.uploadId}::uuid,
        (SELECT feature_type_id FROM feature_type WHERE name = ${FEATURE_TYPE} AND record_end_date IS NULL),
        ${dataJson}::jsonb,
        octet_length(${dataJson}::jsonb::text) + 500,
        now(),
        ${connection.systemUserId()}
      )
      RETURNING submission_feature_id;
    `);

    return result.rows[0].submission_feature_id;
  }

  /**
   * Read the stored values of one typed property table for a feature.
   *
   * @param {'string' | 'paragraph'} propertyType Typed table to read.
   * @param {number} featureId Owning feature.
   * @returns {Promise<{ blueprint_feature_type_property_id: number; value: string }[]>} Stored rows.
   */
  async function getStoredValues(
    propertyType: 'string' | 'paragraph',
    featureId: number
  ): Promise<{ blueprint_feature_type_property_id: number; value: string }[]> {
    const result = await connection.query(
      `SELECT blueprint_feature_type_property_id, value
       FROM submission_feature_property_${propertyType}
       WHERE submission_feature_id = $1
       ORDER BY submission_feature_property_${propertyType}_id`,
      [featureId]
    );

    return result.rows;
  }

  it('stores a paragraph value longer than the string limit', async () => {
    const scenario = await seedPropertyScenario('paragraph');
    const featureId = await insertFeature(scenario, { [scenario.propertyName]: ABSTRACT });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(
      scenario.submissionId,
      scenario.uploadId
    );

    expect(ABSTRACT.length).to.be.greaterThan(250);
    expect(outcome.status).to.equal('ok');
    expect(await getSubmissionFeatureErrors(connection, scenario.uploadId, true)).to.have.lengthOf(0);
    expect(await getStoredValues('paragraph', featureId)).to.eql([
      { blueprint_feature_type_property_id: scenario.assignmentId, value: ABSTRACT }
    ]);
    expect(await getStoredValues('string', featureId)).to.have.lengthOf(0);
  });

  it('replaces paragraph rows on re-index instead of duplicating them', async () => {
    const scenario = await seedPropertyScenario('paragraph');
    const featureId = await insertFeature(scenario, { [scenario.propertyName]: ABSTRACT });

    await service.indexSubmissionPropertiesBySubmissionUploadId(scenario.submissionId, scenario.uploadId);
    await service.indexSubmissionPropertiesBySubmissionUploadId(scenario.submissionId, scenario.uploadId);

    expect(await getStoredValues('paragraph', featureId)).to.have.lengthOf(1);
  });

  it('records TYPE_MISMATCH and stores nothing for a non-string paragraph value', async () => {
    const scenario = await seedPropertyScenario('paragraph');
    const featureId = await insertFeature(scenario, { [scenario.propertyName]: 42 });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(
      scenario.submissionId,
      scenario.uploadId
    );

    expect(outcome.status).to.equal('invalid');
    expect(await getSubmissionFeatureErrors(connection, scenario.uploadId, true)).to.deep.include({
      error_code: 'TYPE_MISMATCH',
      count: 1
    });
    expect(await getStoredValues('paragraph', featureId)).to.have.lengthOf(0);
  });

  it('stores a string value at the 250-character limit', async () => {
    const scenario = await seedPropertyScenario('string');
    const value = 'a'.repeat(250);
    const featureId = await insertFeature(scenario, { [scenario.propertyName]: value });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(
      scenario.submissionId,
      scenario.uploadId
    );

    expect(outcome.status).to.equal('ok');
    expect(await getStoredValues('string', featureId)).to.eql([
      { blueprint_feature_type_property_id: scenario.assignmentId, value }
    ]);
  });

  it('records STRING_TOO_LONG and stores nothing for a string value over the limit', async () => {
    const scenario = await seedPropertyScenario('string');
    const featureId = await insertFeature(scenario, { [scenario.propertyName]: 'a'.repeat(251) });

    const outcome = await service.indexSubmissionPropertiesBySubmissionUploadId(
      scenario.submissionId,
      scenario.uploadId
    );

    expect(outcome.status).to.equal('invalid');
    expect(await getSubmissionFeatureErrors(connection, scenario.uploadId, true)).to.eql([
      { error_code: 'STRING_TOO_LONG', count: 1 }
    ]);
    expect(await getStoredValues('string', featureId)).to.have.lengthOf(0);
  });

  it('rejects a paragraph row stored under a string-typed assignment', async () => {
    const scenario = await seedPropertyScenario('string');
    const featureId = await insertFeature(scenario, {});

    try {
      await addPropertyValue(connection, 'paragraph', featureId, scenario.assignmentId, ABSTRACT);
      expect.fail('Expected a paragraph row under a string assignment to be rejected');
    } catch (error) {
      expect(error).to.be.instanceOf(ApiExecuteSQLError);
      expect(JSON.stringify((error as ApiExecuteSQLError).errors)).to.include(
        'submission_feature_property_paragraph stores paragraph properties'
      );
    }
  });

  it('rejects a string row stored under a paragraph-typed assignment', async () => {
    const scenario = await seedPropertyScenario('paragraph');
    const featureId = await insertFeature(scenario, {});

    try {
      await addPropertyValue(connection, 'string', featureId, scenario.assignmentId, 'short');
      expect.fail('Expected a string row under a paragraph assignment to be rejected');
    } catch (error) {
      expect(error).to.be.instanceOf(ApiExecuteSQLError);
      expect(JSON.stringify((error as ApiExecuteSQLError).errors)).to.include(
        'submission_feature_property_string stores string properties'
      );
    }
  });
});
