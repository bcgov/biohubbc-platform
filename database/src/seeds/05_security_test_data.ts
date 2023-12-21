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
  for (let i = 0; i < 2; i++) {
    const categoryId = await insertSecurityCategoryRecord(knex);
    for (let j = 0; j < 10; j++) {
      await insertSecurityRuleRecord(knex, categoryId);
    }
  }
}

export const insertSecurityRuleRecord = async (knex: Knex, category_id: number): Promise<number> => {
  const response = await knex.raw(insertSecurityRule(category_id));
  return response.rows[0].security_rule_id;
};

export const insertSecurityCategoryRecord = async (knex: Knex): Promise<number> => {
  const response = await knex.raw(insertSecurityCategory());
  return response.rows[0].security_category_id;
};

const insertSecurityRule = (category_id: number) =>
  `INSERT INTO security_rule (security_category_id, name, description, record_effective_date, record_end_date) VALUES (${category_id}, $$${faker.commerce.productName()}$$, $$${faker.commerce.productDescription()}$$, '${faker.date
    .past()
    .toISOString()}', null) RETURNING security_rule_id;`;

const insertSecurityCategory = () =>
  `INSERT INTO security_category (name, description, record_effective_date, record_end_date) VALUES ($$${faker.company.name()}$$, $$${faker.commerce.productDescription()}$$, '${faker.date
    .past()
    .toISOString()}', null) RETURNING security_category_id;`;
