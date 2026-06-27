import type { Knex } from 'knex';

/**
 * Add a compatibility pointer for retired feature properties.
 *
 * `target_feature_property_id` is a global forward alias used only during ingestion. The selected
 * Blueprint still decides which property is valid/indexed; ingestion walks this pointer only until it
 * finds a property assigned by that Blueprint.
 *
 * @param {Knex} knex - Knex database client.
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE feature_property
      ADD COLUMN target_feature_property_id integer;

    COMMENT ON COLUMN feature_property.target_feature_property_id IS
      'Optional successor feature_property for retired-property ingestion aliases. Blueprints still decide the indexed property.';

    ALTER TABLE feature_property
      ADD CONSTRAINT feature_property_fk2
      FOREIGN KEY (target_feature_property_id)
      REFERENCES feature_property(feature_property_id);

    ALTER TABLE feature_property
      ADD CONSTRAINT feature_property_target_requires_retired_ck
      CHECK (target_feature_property_id IS NULL OR record_end_date IS NOT NULL);

    ALTER TABLE feature_property
      ADD CONSTRAINT feature_property_target_not_self_ck
      CHECK (target_feature_property_id IS NULL OR target_feature_property_id <> feature_property_id);

    CREATE INDEX feature_property_idx2
      ON feature_property(target_feature_property_id);

    CREATE INDEX feature_property_idx3
      ON feature_property(name);
  `);
}

/**
 * Remove the retired-property compatibility pointer.
 *
 * @param {Knex} knex - Knex database client.
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS feature_property_idx3;

    DROP INDEX IF EXISTS feature_property_idx2;

    ALTER TABLE feature_property
      DROP CONSTRAINT IF EXISTS feature_property_target_not_self_ck;

    ALTER TABLE feature_property
      DROP CONSTRAINT IF EXISTS feature_property_target_requires_retired_ck;

    ALTER TABLE feature_property
      DROP CONSTRAINT IF EXISTS feature_property_fk2;

    ALTER TABLE feature_property
      DROP COLUMN IF EXISTS target_feature_property_id;
  `);
}
