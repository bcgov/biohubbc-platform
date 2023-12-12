import { faker } from '@faker-js/faker';
import { Knex } from 'knex';

const ENABLE_MOCK_FEATURE_SEEDING = Boolean(process.env.ENABLE_MOCK_FEATURE_SEEDING === 'true' || false);
/**
 * Inserts mock submission/feature data, geared towards performance testing.
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

  for (let i = 0; i < 10; i++) {
    await insertSecurityRuleRecord(knex);
  }
}

export const insertSecurityRuleRecord = async (knex: Knex): Promise<number> => {
  const response = await knex.raw(insertSecurityRule());
  return response.rows[0].security_rule_id;
};

const insertSecurityRule = () =>
  `INSERT INTO security_rule (name, description, record_effective_date, record_end_date) VALUES ('${faker.person.jobTitle()}', '${faker.person.jobDescriptor()}', '${faker.date
    .past()
    .toISOString()}', null) RETURNING security_rule_id;`;
