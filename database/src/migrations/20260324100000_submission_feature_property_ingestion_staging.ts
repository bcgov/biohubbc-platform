import { Knex } from 'knex';

/**
 * Add upload-scoped staging table for set-based submission feature property ingestion.
 *
 * Note: ingestion diagnostics are session-scoped TEMP tables created at runtime.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE TABLE IF NOT EXISTS submission_feature_property_staging (
      submission_feature_property_staging_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      submission_feature_id integer NOT NULL,
      submission_upload_id uuid NOT NULL,
      property_name text NOT NULL,
      value jsonb NOT NULL,
      feature_type_property_id integer,
      create_date timestamptz(6) DEFAULT now() NOT NULL
    );

    COMMENT ON TABLE submission_feature_property_staging IS
      'Upload-scoped relational staging table for flattened submission_feature.data.properties values used by set-based ingestion phases.';
    COMMENT ON COLUMN submission_feature_property_staging.submission_feature_property_staging_id IS
      'Surrogate primary key for staging rows.';
    COMMENT ON COLUMN submission_feature_property_staging.submission_feature_id IS
      'Owning submission_feature row for this staged property value.';
    COMMENT ON COLUMN submission_feature_property_staging.submission_upload_id IS
      'Upload scope key used for idempotent cleanup and phase filtering.';
    COMMENT ON COLUMN submission_feature_property_staging.property_name IS
      'Raw property key extracted from submission_feature.data.properties.';
    COMMENT ON COLUMN submission_feature_property_staging.value IS
      'Raw JSONB property payload extracted from submission_feature.data.properties.';
    COMMENT ON COLUMN submission_feature_property_staging.feature_type_property_id IS
      'Optional resolved metadata reference for observability; hot-path execution derives metadata in temp working relations.';
    COMMENT ON COLUMN submission_feature_property_staging.create_date IS
      'Timestamp when the staging row was created.';

    -- Indexes aligned with access paterns during property indexing jobs
    CREATE INDEX IF NOT EXISTS submission_feature_property_staging_idx2
      ON submission_feature_property_staging (submission_upload_id, submission_feature_id);
    CREATE INDEX IF NOT EXISTS submission_feature_property_staging_idx3
      ON submission_feature_property_staging (submission_upload_id, property_name);

  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TABLE IF EXISTS submission_feature_property_staging;
  `);
}
