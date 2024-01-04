import { faker } from '@faker-js/faker';
import { Knex } from 'knex';
import { insertDatasetRecord, insertSampleSiteRecord, insertSubmissionRecord } from './04_mock_test_data';

/**
 * Inserts mock submission data
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SCHEMA 'biohub';
    SET SEARCH_PATH = 'biohub','public';
  `);

  // 1. submission (2) without children
  await insertSubmissionRecord(knex);
  await insertSubmissionRecord(knex);

  // 2. submission (1) without children but with security_review_timestamp
  await insertSubmissionRecord(knex, true);

  // 3. submission (1) without children but with security_review_timestamp and published_timestamp
  await insertSubmissionRecord(knex, true, true);

  // 4. submission (1) with children and SECURE (all submission features secure) and published_timestamp
  await createSubmissionWithSecurity(knex, 'SECURE');

  // 5. submission (1) with children and PARTIALLY SECURE (some submission features secure) and published_timestamp
  await createSubmissionWithSecurity(knex, 'PARTIALLY SECURE');

  // 6. submission (1) with children and UNSECURE (zero submission features secure) and published_timestamp
  await createSubmissionWithSecurity(knex, 'UNSECURE');

  // 7. submission (2) with children and UNSECURE (zero submission features secure)
  // and not published and not reviewed
  await createSubmissionWithSecurity(knex, 'UNSECURE', false);
  await createSubmissionWithSecurity(knex, 'UNSECURE', false);
}

const insertFeatureSecurity = async (knex: Knex, submission_feature_id: number, security_rule_id: number) => {
  await knex.raw(`
  INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, record_effective_date)
  VALUES($$${submission_feature_id}$$, $$${security_rule_id}$$, $$${faker.date.past().toISOString()}$$);`);
};

const createSubmissionWithSecurity = async (
  knex: Knex,
  securityLevel: 'PARTIALLY SECURE' | 'SECURE' | 'UNSECURE',
  reviewed = true
) => {
  const submission_id = await insertSubmissionRecord(knex, reviewed, reviewed);
  const parent_submission_feature_id = await insertDatasetRecord(knex, { submission_id });
  const submission_feature_id = await insertSampleSiteRecord(knex, {
    parent_submission_feature_id,
    submission_id
  });

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
