// Integration tests for the bulk submission feature insert used by archive ingestion.
//
// The insert draws identifiers from the identity sequence and writes `urn` itself so the per-row
// `submission_feature_urn` trigger is skipped; these tests assert the stored rows match what the trigger
// would have produced, and that inserts which leave `urn` unset still get one from the trigger.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: database container running with seed data.

import { expect } from 'chai';
import { describe } from 'mocha';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { FeatureIngestionRepository } from '../../repositories/ingestion/feature-ingestion-repository';
import { createTestUpload } from '../helpers/test-feature-property-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

/** Feature type the inserted rows use. */
const FEATURE_TYPE = 'mortality';

describe('FeatureIngestionRepository — bulk feature insert (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let repository: FeatureIngestionRepository;

  before(() => initDBPool(defaultPoolConfig));

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    repository = new FeatureIngestionRepository(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  it('assigns distinct identifiers and writes the urn with each row', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);
    const featureType = await connection.sql(
      SQL`SELECT feature_type_id FROM feature_type WHERE name = ${FEATURE_TYPE} AND record_end_date IS NULL`
    );
    const featureTypeId: number = featureType.rows[0].feature_type_id;

    const records = ['feature-1', 'feature-2', 'feature-3'].map((sourceId, index) => {
      const dataJson = JSON.stringify({
        id: sourceId,
        type: FEATURE_TYPE,
        properties: {},
        content: [],
        parent: index === 0 ? null : 'feature-1'
      });

      return {
        submissionId,
        submissionUploadId: uploadId,
        sourceId,
        featureTypeId,
        featureTypeName: FEATURE_TYPE,
        dataJson,
        dataByteSize: Buffer.byteLength(dataJson),
        contentHash: 'a'.repeat(64),
        universalId: null
      };
    });

    const insertedCount = await repository.insertSubmissionFeatures(records);

    const rows = await connection.sql(SQL`
      SELECT submission_feature_id, source_id, urn, data->>'id' AS data_id
      FROM submission_feature
      WHERE submission_upload_id = ${uploadId}::uuid
      ORDER BY source_id
    `);

    expect(insertedCount).to.equal(3);
    expect(new Set(rows.rows.map((row) => row.submission_feature_id)).size).to.equal(3);
    rows.rows.forEach((row) => {
      expect(row.urn).to.equal(`urn:${submissionId}:${FEATURE_TYPE}:${row.submission_feature_id}`);
      expect(row.data_id).to.equal(row.source_id);
    });
  });

  it('resolves parents from data.parent within the upload', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);

    const inserted = await connection.sql(SQL`
      INSERT INTO submission_feature (submission_id, submission_upload_id, source_id, feature_type_id, data, data_byte_size)
      SELECT ${submissionId}, ${uploadId}::uuid, rows.source_id, ft.feature_type_id, rows.data, 2
      FROM feature_type ft
      CROSS JOIN (
        VALUES
          ('parent-1', '{"parent": null}'::jsonb),
          ('child-1', '{"parent": "parent-1"}'::jsonb)
      ) AS rows(source_id, data)
      WHERE ft.name = ${FEATURE_TYPE} AND ft.record_end_date IS NULL
      RETURNING submission_feature_id, source_id
    `);
    const idsBySourceId = new Map(inserted.rows.map((row) => [row.source_id, row.submission_feature_id]));

    await repository.updateSubmissionFeatureParentsBySubmissionUploadId(uploadId, submissionId);

    const child = await connection.sql(SQL`
      SELECT parent_submission_feature_id
      FROM submission_feature
      WHERE submission_feature_id = ${idsBySourceId.get('child-1')}
    `);
    expect(child.rows[0].parent_submission_feature_id).to.equal(idsBySourceId.get('parent-1'));
  });

  it('still sets the urn through the trigger for inserts that leave it unset', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);

    const inserted = await connection.sql(SQL`
      INSERT INTO submission_feature (submission_id, submission_upload_id, source_id, feature_type_id, data, data_byte_size)
      SELECT ${submissionId}, ${uploadId}::uuid, 'feature-1', feature_type_id, '{}'::jsonb, 2
      FROM feature_type
      WHERE name = ${FEATURE_TYPE} AND record_end_date IS NULL
      RETURNING submission_feature_id, urn
    `);

    const row = inserted.rows[0];
    expect(row.urn).to.equal(`urn:${submissionId}:${FEATURE_TYPE}:${row.submission_feature_id}`);
  });
});
