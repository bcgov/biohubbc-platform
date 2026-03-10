import { Knex } from 'knex';

/**
 * Add taxon feature property type.
 *
 * Ensures metadata can represent taxon-valued feature properties with
 * feature_property_type.name = 'taxon'.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    INSERT INTO feature_property_type (name, description)
    SELECT 'taxon', 'A taxon reference type'
    WHERE NOT EXISTS (
      SELECT 1
      FROM feature_property_type
      WHERE name = 'taxon'
      AND record_end_date IS NULL
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DELETE FROM feature_property_type
    WHERE name = 'taxon'
    AND record_end_date IS NULL;
  `);
}
