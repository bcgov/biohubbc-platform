import { Knex } from 'knex';

/**
 * Sets allow_multiple = true on every feature_type_property row whose backing
 * feature_property is of type 'array'.
 *
 * This covers properties such as collected_data, focal_species,
 * site_select_strategy, associated_species, and attractant without hardcoding
 * individual names.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    UPDATE feature_type_property ftp
    SET allow_multiple = true
    FROM feature_property fp
    JOIN feature_property_type fpt
      ON fpt.feature_property_type_id = fp.feature_property_type_id
    WHERE ftp.feature_property_id = fp.feature_property_id
      AND fpt.name = 'array';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    UPDATE feature_type_property ftp
    SET allow_multiple = false
    FROM feature_property fp
    JOIN feature_property_type fpt
      ON fpt.feature_property_type_id = fp.feature_property_type_id
    WHERE ftp.feature_property_id = fp.feature_property_id
      AND fpt.name = 'array';
  `);
}
