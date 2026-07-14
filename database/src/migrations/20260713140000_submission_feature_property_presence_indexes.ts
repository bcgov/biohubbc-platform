import type { Knex } from 'knex';

/**
 * Add covering indexes for property-presence queries keyed by matching feature id.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE INDEX submission_feature_property_string_presence_idx
      ON submission_feature_property_string (submission_feature_id, feature_type_property_id);

    CREATE INDEX submission_feature_property_number_presence_idx
      ON submission_feature_property_number (submission_feature_id, feature_type_property_id);

    CREATE INDEX submission_feature_property_boolean_presence_idx
      ON submission_feature_property_boolean (submission_feature_id, feature_type_property_id);

    CREATE INDEX submission_feature_property_timestamp_presence_idx
      ON submission_feature_property_timestamp (submission_feature_id, feature_type_property_id);

    CREATE INDEX submission_feature_property_geometry_presence_idx
      ON submission_feature_property_geometry (submission_feature_id, feature_type_property_id);

    CREATE INDEX submission_feature_property_code_presence_idx
      ON submission_feature_property_code (submission_feature_id, feature_type_property_id);

    CREATE INDEX submission_feature_property_taxon_presence_idx
      ON submission_feature_property_taxon (submission_feature_id, feature_type_property_id);
  `);
}

/**
 * Remove the property-presence covering indexes.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS submission_feature_property_string_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_number_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_boolean_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_geometry_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_code_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_taxon_presence_idx;
  `);
}
