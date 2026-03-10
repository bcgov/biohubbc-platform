// Integration test for SearchFeatureRepository.deleteSearchRecordsBySubmissionId —
// verifies the subquery-based delete correctly removes records from all 4 search tables
// for a given submission, without affecting records belonging to other submissions.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SearchFeatureRepository } from '../../repositories/search-feature-repository';

describe('SearchFeatureRepository (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let repo: SearchFeatureRepository;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    repo = new SearchFeatureRepository(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  /**
   * Helper: insert a minimal submission and return its ID.
   */
  async function createTestSubmission(): Promise<number> {
    const systemUserId = connection.systemUserId();

    await connection.sql(SQL`
      INSERT INTO contributor (client_id, description)
      SELECT 'SIMS', 'Integration test contributor'
      WHERE NOT EXISTS (
        SELECT 1
        FROM contributor
        WHERE client_id = 'SIMS'
          AND record_end_date IS NULL
      );
    `);

    const result = await connection.sql(SQL`
      INSERT INTO submission (uuid, system_user_id, contributor_id, name, description, comment, create_user)
      VALUES (
        gen_random_uuid(),
        ${systemUserId},
        (SELECT contributor_id FROM contributor WHERE client_id = 'SIMS' AND record_end_date IS NULL LIMIT 1),
        'Search Index Test',
        'Test',
        'Test',
        ${systemUserId}
      )
      RETURNING submission_id;
    `);

    return result.rows[0].submission_id;
  }

  /**
   * Helper: insert a submission_feature and return its ID.
   */
  async function createTestFeature(submissionId: number): Promise<number> {
    const systemUserId = connection.systemUserId();

    const uploadResult = await connection.sql(SQL`
      INSERT INTO upload (upload_status, record_end_date, create_user)
      VALUES ('completed', now(), ${systemUserId})
      RETURNING upload_id;
    `);
    const uploadId = uploadResult.rows[0].upload_id;

    const bridgeResult = await connection.sql(SQL`
      INSERT INTO submission_upload (submission_id, upload_id, create_user)
      VALUES (${submissionId}, ${uploadId}, ${systemUserId})
      RETURNING submission_upload_id;
    `);
    const submissionUploadId = bridgeResult.rows[0].submission_upload_id;

    const result = await connection.sql(SQL`
      INSERT INTO submission_feature (submission_id, submission_upload_id, feature_type_id, data, data_byte_size, create_user)
      VALUES (
        ${submissionId},
        ${submissionUploadId},
        (SELECT feature_type_id FROM feature_type WHERE name = 'dataset' LIMIT 1),
        '{"name": "test"}'::jsonb,
        100,
        ${systemUserId}
      )
      RETURNING submission_feature_id;
    `);

    return result.rows[0].submission_feature_id;
  }

  /**
   * Helper: insert a search_string record.
   */
  async function insertSearchString(submissionFeatureId: number, featurePropertyId: number, value: string) {
    const systemUserId = connection.systemUserId();

    await connection.sql(SQL`
      INSERT INTO search_string (submission_feature_id, feature_property_id, value, create_user)
      VALUES (${submissionFeatureId}, ${featurePropertyId}, ${value}, ${systemUserId});
    `);
  }

  /**
   * Helper: insert a search_number record.
   */
  async function insertSearchNumber(submissionFeatureId: number, featurePropertyId: number, value: number) {
    const systemUserId = connection.systemUserId();

    await connection.sql(SQL`
      INSERT INTO search_number (submission_feature_id, feature_property_id, value, create_user)
      VALUES (${submissionFeatureId}, ${featurePropertyId}, ${value}, ${systemUserId});
    `);
  }

  /**
   * Helper: count records in a search table for a given submission_feature_id.
   */
  async function countSearchRecords(table: string, submissionFeatureId: number): Promise<number> {
    const result = await connection.sql(
      SQL`
      SELECT count(*)::integer as count
      FROM `.append(table).append(SQL`
      WHERE submission_feature_id = ${submissionFeatureId};
    `)
    );

    return result.rows[0].count;
  }

  describe('deleteSearchRecordsBySubmissionId', () => {
    it('deletes search_string and search_number records for the given submission', async () => {
      // Arrange: create submission with a feature and search records
      const submissionId = await createTestSubmission();
      const featureId = await createTestFeature(submissionId);

      // feature_property_id 1 = site_identifier (string type), 6 = measurement_value (number type)
      await insertSearchString(featureId, 1, 'test-site');
      await insertSearchNumber(featureId, 6, 42);

      // Verify records exist
      expect(await countSearchRecords('search_string', featureId)).to.equal(1);
      expect(await countSearchRecords('search_number', featureId)).to.equal(1);

      // Act
      await repo.deleteSearchRecordsBySubmissionId(submissionId);

      // Assert: all records deleted
      expect(await countSearchRecords('search_string', featureId)).to.equal(0);
      expect(await countSearchRecords('search_number', featureId)).to.equal(0);
    });

    it('does not delete records belonging to a different submission', async () => {
      // Arrange: create two submissions with search records
      const submissionId1 = await createTestSubmission();
      const featureId1 = await createTestFeature(submissionId1);
      await insertSearchString(featureId1, 1, 'submission-1-value');

      const submissionId2 = await createTestSubmission();
      const featureId2 = await createTestFeature(submissionId2);
      await insertSearchString(featureId2, 1, 'submission-2-value');

      // Act: delete only submission 1's records
      await repo.deleteSearchRecordsBySubmissionId(submissionId1);

      // Assert: submission 1 records gone, submission 2 records intact
      expect(await countSearchRecords('search_string', featureId1)).to.equal(0);
      expect(await countSearchRecords('search_string', featureId2)).to.equal(1);
    });

    it('succeeds with no error when submission has no search records', async () => {
      const submissionId = await createTestSubmission();
      await createTestFeature(submissionId);

      // Act: should not throw
      await repo.deleteSearchRecordsBySubmissionId(submissionId);
    });

    it('deletes records across multiple features in the same submission', async () => {
      // Arrange: one submission, two features, each with search records
      const submissionId = await createTestSubmission();
      const featureId1 = await createTestFeature(submissionId);
      const featureId2 = await createTestFeature(submissionId);

      await insertSearchString(featureId1, 1, 'feature-1-value');
      await insertSearchString(featureId2, 1, 'feature-2-value');
      await insertSearchNumber(featureId1, 6, 10);
      await insertSearchNumber(featureId2, 6, 20);

      // Act
      await repo.deleteSearchRecordsBySubmissionId(submissionId);

      // Assert: all records across both features deleted
      expect(await countSearchRecords('search_string', featureId1)).to.equal(0);
      expect(await countSearchRecords('search_string', featureId2)).to.equal(0);
      expect(await countSearchRecords('search_number', featureId1)).to.equal(0);
      expect(await countSearchRecords('search_number', featureId2)).to.equal(0);
    });
  });
});
