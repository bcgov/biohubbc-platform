import { faker } from '@faker-js/faker';
import { Knex } from 'knex';

const ENABLE_MOCK_FEATURE_SEEDING = Boolean(process.env.ENABLE_MOCK_FEATURE_SEEDING === 'true' || false);

/**
 * Inserts mock security rule data using real security rule definitions
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
    SET SEARCH_PATH = 'biohub','public';`);

  const rulesExist = await knex.raw(`SELECT * FROM security_rule`);

  if (rulesExist.rows.length) {
    return knex.raw(`SELECT NULL;`); // skip if rules seeded already
  }

  const government_interest = await insertSecurityCategoryRecord(knex, { name: 'Government Interest' });
  const proprietary_information = await insertSecurityCategoryRecord(knex, { name: 'Proprietary Information' });
  const persecution_or_harm = await insertSecurityCategoryRecord(knex, { name: 'Persecution or Harm' });
  const private_property = await insertSecurityCategoryRecord(knex, { name: 'Private Property' });

  const security_rules = [
    {
      security_category_id: government_interest,
      name: 'Caribou location',
      description: 'Caribou locations are secured'
    },
    {
      security_category_id: proprietary_information,
      name: 'Proprietary',
      description: 'Proprietary information is secured'
    },
    {
      security_category_id: persecution_or_harm,
      name: 'Moose location',
      description: 'Moose locations are secured'
    },
    {
      security_category_id: private_property,
      name: 'Private property',
      description: 'Data and information colled on private property is secured'
    }
  ];

  for (let i = 0; i < security_rules.length; i++) {
    await insertSecurityRuleRecord(knex, security_rules[i]);
  }
}

export const insertSecurityCategoryRecord = async (knex: Knex, row: { name: string }): Promise<number> => {
  const effective_date = faker.date.past().toISOString();

  const res = await knex.raw(`
    INSERT INTO security_category (name, description, record_effective_date, record_end_date)
    VALUES ($$${row.name}$$, $$${row.name}$$, $$${effective_date}$$, null)
    RETURNING security_category_id;`);

  return res.rows[0].security_category_id;
};

export const insertSecurityRuleRecord = async (
  knex: Knex,
  row: { security_category_id: number; name: string; description: string }
): Promise<number> => {
  const { security_category_id, name, description } = row;
  const effective_date = faker.date.past().toISOString();

  const res = await knex.raw(`
    INSERT INTO security_rule (security_category_id, name, description, record_effective_date, record_end_date)
    VALUES (${security_category_id}, $$${name}$$, $$${description}$$, $$${effective_date}$$, null)
    RETURNING security_rule_id;`);

  return res.rows[0].security_rule_id;
};
