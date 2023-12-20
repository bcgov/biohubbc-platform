import { faker } from '@faker-js/faker';
import { Knex } from 'knex';
import { insertDatasetRecord, insertSampleSiteRecord, insertSubmissionRecord } from './04_mock_test_data';
import { insertSecurityCategoryRecord, insertSecurityRuleRecord } from './05_security_test_data';

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

  // 3. submission (1) with children and SECURE (all submission features secure)
  await createSubmissionWithSecurity(knex, 'SECURE');

  // 4. submission (1) with children and PARTIALLY SECURE (some submission features secure)
  await createSubmissionWithSecurity(knex, 'PARTIALLY SECURE');

  // 5. submission (1) with children and UNSECURE (zero submission features secure)
  await createSubmissionWithSecurity(knex, 'UNSECURE');
}

const insertFeatureSecurity = async (knex: Knex, submission_feature_id: number, security_category_id: number) => {
  const security_rule_id = await insertSecurityRuleRecord(knex, security_category_id);
  await knex.raw(`
  INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, record_effective_date)
  VALUES($$${submission_feature_id}$$, $$${security_rule_id}$$, $$${faker.date.past().toISOString()}$$);`);
};

const createSubmissionWithSecurity = async (knex: Knex, securityLevel: 'PARTIALLY SECURE' | 'SECURE' | 'UNSECURE') => {
  const submission_id = await insertSubmissionRecord(knex, true);
  const parent_submission_feature_id = await insertDatasetRecord(knex, { submission_id });
  const submission_feature_id = await insertSampleSiteRecord(knex, {
    parent_submission_feature_id,
    submission_id
  });
  const categoryId = await insertSecurityCategoryRecord(knex);
  if (securityLevel === 'PARTIALLY SECURE') {
    await insertFeatureSecurity(knex, submission_feature_id, categoryId);
    return;
  }
  if (securityLevel === 'SECURE') {
    await insertFeatureSecurity(knex, parent_submission_feature_id, categoryId);
    await insertFeatureSecurity(knex, submission_feature_id, categoryId);
    return;
  }
};
