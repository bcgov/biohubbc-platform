import type { Knex } from 'knex';

/**
 * Carry Blueprint property-assignment provenance through upload-scoped property indexing staging.
 *
 * Durable `submission_feature_property_*` provenance columns are introduced by SIMSBIOHUB-1046.
 * Retired-property forwarding resolves the winning Blueprint assignment earlier, so staging needs
 * to carry that exact `blueprint_feature_type_property_id` to the final inserts instead of
 * re-deriving it later from the upload Blueprint.
 *
 * @param {Knex} knex - Knex database client.
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission_upload_staging_resolved_property
      ADD COLUMN blueprint_feature_type_property_id integer;

    ALTER TABLE submission_upload_staging_typed_property_value
      ADD COLUMN blueprint_feature_type_property_id integer NOT NULL;

    ALTER TABLE submission_upload_staging_datetime_candidate
      ADD COLUMN blueprint_feature_type_property_id integer NOT NULL;

    ALTER TABLE submission_upload_staging_spatial_candidate
      ADD COLUMN blueprint_feature_type_property_id integer NOT NULL;

    ALTER TABLE submission_upload_staging_code_candidate
      ADD COLUMN blueprint_feature_type_property_id integer NOT NULL;

    ALTER TABLE submission_upload_staging_taxon_candidate
      ADD COLUMN blueprint_feature_type_property_id integer NOT NULL;

    ALTER TABLE submission_upload_staging_artifact_candidate
      ADD COLUMN blueprint_feature_type_property_id integer NOT NULL;

    ALTER TABLE submission_upload_staging_feature_candidate
      ADD COLUMN blueprint_feature_type_property_id integer NOT NULL;

    CREATE INDEX sf_resolved_work_idx5
      ON submission_upload_staging_resolved_property (submission_upload_id, blueprint_feature_type_property_id);

    CREATE INDEX sf_property_value_work_idx5
      ON submission_upload_staging_typed_property_value (submission_upload_id, blueprint_feature_type_property_id);

    CREATE INDEX sf_datetime_candidate_work_idx3
      ON submission_upload_staging_datetime_candidate (submission_upload_id, blueprint_feature_type_property_id);

    CREATE INDEX sf_spatial_candidate_work_idx3
      ON submission_upload_staging_spatial_candidate (submission_upload_id, blueprint_feature_type_property_id);

    CREATE INDEX sf_code_candidate_work_idx3
      ON submission_upload_staging_code_candidate (submission_upload_id, blueprint_feature_type_property_id);

    CREATE INDEX sf_taxon_candidate_work_idx3
      ON submission_upload_staging_taxon_candidate (submission_upload_id, blueprint_feature_type_property_id);

    CREATE INDEX sf_artifact_candidate_work_idx3
      ON submission_upload_staging_artifact_candidate (submission_upload_id, blueprint_feature_type_property_id);

    CREATE INDEX sf_feature_candidate_work_idx3
      ON submission_upload_staging_feature_candidate (submission_upload_id, blueprint_feature_type_property_id);

    COMMENT ON COLUMN submission_upload_staging_resolved_property.blueprint_feature_type_property_id IS
      'Blueprint assignment selected during property-name and retired-property forwarding resolution. Null only for unresolved/non-indexable raw properties.';
    COMMENT ON COLUMN submission_upload_staging_typed_property_value.blueprint_feature_type_property_id IS
      'Blueprint assignment selected during resolved-property staging and carried to durable property insertion.';
    COMMENT ON COLUMN submission_upload_staging_datetime_candidate.blueprint_feature_type_property_id IS
      'Blueprint assignment selected during resolved-property staging and carried to timestamp property insertion.';
    COMMENT ON COLUMN submission_upload_staging_spatial_candidate.blueprint_feature_type_property_id IS
      'Blueprint assignment selected during resolved-property staging and carried to geometry property insertion.';
    COMMENT ON COLUMN submission_upload_staging_code_candidate.blueprint_feature_type_property_id IS
      'Blueprint assignment selected during resolved-property staging and carried to code property insertion.';
    COMMENT ON COLUMN submission_upload_staging_taxon_candidate.blueprint_feature_type_property_id IS
      'Blueprint assignment selected during resolved-property staging and carried to taxon property insertion.';
    COMMENT ON COLUMN submission_upload_staging_artifact_candidate.blueprint_feature_type_property_id IS
      'Blueprint assignment selected during resolved-property staging and retained with artifact-key property candidates.';
    COMMENT ON COLUMN submission_upload_staging_feature_candidate.blueprint_feature_type_property_id IS
      'Blueprint assignment selected during resolved-property staging and carried to feature-reference property insertion.';
  `);
}

/**
 * Remove Blueprint assignment provenance from property indexing staging.
 *
 * @param {Knex} knex - Knex database client.
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS sf_feature_candidate_work_idx3;
    DROP INDEX IF EXISTS sf_artifact_candidate_work_idx3;
    DROP INDEX IF EXISTS sf_taxon_candidate_work_idx3;
    DROP INDEX IF EXISTS sf_code_candidate_work_idx3;
    DROP INDEX IF EXISTS sf_spatial_candidate_work_idx3;
    DROP INDEX IF EXISTS sf_datetime_candidate_work_idx3;
    DROP INDEX IF EXISTS sf_property_value_work_idx5;
    DROP INDEX IF EXISTS sf_resolved_work_idx5;

    ALTER TABLE submission_upload_staging_feature_candidate
      DROP COLUMN IF EXISTS blueprint_feature_type_property_id;

    ALTER TABLE submission_upload_staging_artifact_candidate
      DROP COLUMN IF EXISTS blueprint_feature_type_property_id;

    ALTER TABLE submission_upload_staging_taxon_candidate
      DROP COLUMN IF EXISTS blueprint_feature_type_property_id;

    ALTER TABLE submission_upload_staging_code_candidate
      DROP COLUMN IF EXISTS blueprint_feature_type_property_id;

    ALTER TABLE submission_upload_staging_spatial_candidate
      DROP COLUMN IF EXISTS blueprint_feature_type_property_id;

    ALTER TABLE submission_upload_staging_datetime_candidate
      DROP COLUMN IF EXISTS blueprint_feature_type_property_id;

    ALTER TABLE submission_upload_staging_typed_property_value
      DROP COLUMN IF EXISTS blueprint_feature_type_property_id;

    ALTER TABLE submission_upload_staging_resolved_property
      DROP COLUMN IF EXISTS blueprint_feature_type_property_id;
  `);
}
