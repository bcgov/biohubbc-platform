import { faker } from '@faker-js/faker';
import { Knex } from 'knex';
import {
  insertDatasetRecord,
  insertSampleSiteRecord,
  insertSubmissionFeature,
  insertSubmissionRecord
} from './04_mock_test_data';

const ENABLE_MOCK_FEATURE_SEEDING = Boolean(process.env.ENABLE_MOCK_FEATURE_SEEDING === 'true' || false);

/**
 * Inserts mock submission data
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function seed(knex: Knex): Promise<void> {
  if (!ENABLE_MOCK_FEATURE_SEEDING) {
    return knex.raw(`SELECT null;`); // dummy query to appease knex
  }

  await knex.raw(`
    SET SCHEMA 'biohub';
    SET SEARCH_PATH = 'biohub','public';
  `);

  // 1. SECURE (all submission features secure) and published_timestamp
  await createSubmissionWithSecurity(knex, 'SECURE');

  // 2. PARTIALLY SECURE (some submission features secure) and published_timestamp
  await createSubmissionWithSecurity(knex, 'PARTIALLY SECURE');

  // 3. UNSECURE (zero submission features secure) and published_timestamp
  await createSubmissionWithSecurity(knex, 'UNSECURE');

  // 4. UNSECURE (zero submission features secure) and not published and not reviewed
  await createSubmissionWithSecurity(knex, 'UNSECURE', false);
  await createSubmissionWithSecurity(knex, 'UNSECURE', false);
}

const insertFeatureSecurity = async (knex: Knex, submission_feature_id: number, security_rule_id: number) => {
  await knex.raw(`
  INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, record_effective_date)
  VALUES($$${submission_feature_id}$$, $$${security_rule_id}$$, $$${faker.date.past().toISOString()}$$);`);
};

const insertArtifactRecord = async (
  knex: Knex,
  row: { submission_id: number; parent_submission_feature_id: number }
) => {
  const S3_KEY = 'dev-artifacts/artifact.txt';

  const sql = insertSubmissionFeature({
    submission_id: row.submission_id,
    parent_submission_feature_id: row.parent_submission_feature_id,
    feature_type: 'file',
    data: { file: S3_KEY }
  });

  const submission_feature = await knex.raw(sql);

  const submission_feature_id = submission_feature.rows[0].submission_feature_id;

  await knex.raw(`
    INSERT INTO search_string (submission_feature_id, feature_property_id, value)
    VALUES
    (
      ${submission_feature_id},
      (select feature_property_id from feature_property where name = 'artifact_key'),
      $$${S3_KEY}$$
    );`);
};

const createSubmissionWithSecurity = async (
  knex: Knex,
  securityLevel: 'PARTIALLY SECURE' | 'SECURE' | 'UNSECURE',
  reviewed = true
) => {
  const submission_id = await insertSubmissionRecord(knex, reviewed, reviewed);
  const parent_submission_feature_id = await insertDatasetRecord(knex, { submission_id });
  const submission_feature_id = await insertSampleSiteRecord(knex, { submission_id, parent_submission_feature_id });

  await insertArtifactRecord(knex, { submission_id, parent_submission_feature_id });

  if (securityLevel === 'PARTIALLY SECURE') {
    await insertFeatureSecurity(knex, submission_feature_id, 1);
    return;
  }

  if (securityLevel === 'SECURE') {
    await insertFeatureSecurity(knex, parent_submission_feature_id, 2);
    await insertFeatureSecurity(knex, submission_feature_id, 3);
    return;
  }
};
