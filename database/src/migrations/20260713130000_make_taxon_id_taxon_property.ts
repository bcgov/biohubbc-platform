import { Knex } from 'knex';

/**
 * Temporarily make `taxon_id` a taxon-backed feature property.
 *
 * This supports testing the taxon ingestion path while older seed metadata still defines `taxon_id`
 * as a number-valued feature property.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    UPDATE feature_property fp
    SET feature_property_type_id = taxon_type.feature_property_type_id
    FROM feature_property_type taxon_type
    WHERE fp.name = 'taxon_id'
      AND fp.record_end_date IS NULL
      AND taxon_type.name = 'taxon'
      AND taxon_type.record_end_date IS NULL;
  `);
}

/**
 * Restore `taxon_id` to the legacy number-backed feature property type.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    UPDATE feature_property fp
    SET feature_property_type_id = number_type.feature_property_type_id
    FROM feature_property_type number_type
    WHERE fp.name = 'taxon_id'
      AND fp.record_end_date IS NULL
      AND number_type.name = 'number'
      AND number_type.record_end_date IS NULL;
  `);
}
