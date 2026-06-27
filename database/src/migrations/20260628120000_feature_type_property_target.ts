import type { Knex } from 'knex';

/**
 * Add a compatibility pointer for retired feature-type properties.
 *
 * `target_feature_type_property_id` is a feature-type-scoped forward alias used only during
 * ingestion. The selected Blueprint still decides which property is valid/indexed; ingestion walks
 * this pointer only until it finds a feature-type property assigned by that Blueprint.
 *
 * @param {Knex} knex - Knex database client.
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE feature_type_property
      ADD COLUMN target_feature_type_property_id integer;

    COMMENT ON COLUMN feature_type_property.target_feature_type_property_id IS
      'Optional successor feature_type_property for retired assignment ingestion aliases. Blueprints still decide the indexed property.';

    ALTER TABLE feature_type_property
      ADD CONSTRAINT feature_type_property_fk3
      FOREIGN KEY (target_feature_type_property_id)
      REFERENCES feature_type_property(feature_type_property_id);

    ALTER TABLE feature_type_property
      ADD CONSTRAINT feature_type_property_target_requires_retired_ck
      CHECK (target_feature_type_property_id IS NULL OR record_end_date IS NOT NULL);

    ALTER TABLE feature_type_property
      ADD CONSTRAINT feature_type_property_target_not_self_ck
      CHECK (target_feature_type_property_id IS NULL OR target_feature_type_property_id <> feature_type_property_id);

    CREATE INDEX feature_type_property_idx3
      ON feature_type_property(target_feature_type_property_id);

    CREATE INDEX feature_type_property_idx4
      ON feature_type_property(feature_type_id, target_feature_type_property_id);

    CREATE INDEX feature_property_idx2
      ON feature_property(name);
  `);
}

/**
 * Remove the retired feature-type-property compatibility pointer.
 *
 * @param {Knex} knex - Knex database client.
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS feature_property_idx2;

    DROP INDEX IF EXISTS feature_type_property_idx4;

    DROP INDEX IF EXISTS feature_type_property_idx3;

    ALTER TABLE feature_type_property
      DROP CONSTRAINT IF EXISTS feature_type_property_target_not_self_ck;

    ALTER TABLE feature_type_property
      DROP CONSTRAINT IF EXISTS feature_type_property_target_requires_retired_ck;

    ALTER TABLE feature_type_property
      DROP CONSTRAINT IF EXISTS feature_type_property_fk3;

    ALTER TABLE feature_type_property
      DROP COLUMN IF EXISTS target_feature_type_property_id;
  `);
}
