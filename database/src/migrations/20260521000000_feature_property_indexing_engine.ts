import type { Knex } from 'knex';

/**
 * Schema support for the feature-reference property indexing engine:
 *
 * 1. Adds `feature_type_property.allowed_referenced_feature_type_id` so feature-valued
 *    properties declare the single feature type their `feature::<id>` references may resolve to.
 * 2. Adds a uniqueness guarantee on the canonical `submission_feature_property_feature` table.
 * 3. Adds the UNLOGGED upload-scoped `submission_upload_staging_feature_candidate` staging table
 *    mirroring the sibling code/taxon candidate tables.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Allowed-target type for feature-valued properties.
    --------------------------------------------------------------------------------
    ALTER TABLE feature_type_property
      ADD COLUMN allowed_referenced_feature_type_id integer;

    ALTER TABLE feature_type_property
      ADD CONSTRAINT feature_type_property_fk3
      FOREIGN KEY (allowed_referenced_feature_type_id)
      REFERENCES feature_type(feature_type_id);

    COMMENT ON COLUMN feature_type_property.allowed_referenced_feature_type_id IS
      'For feature-valued properties, the single feature type a reference is allowed to resolve to. The feature::<id> reference syntax carries no type, so the allowed target type is read from here. Null for non-feature properties.';

    --------------------------------------------------------------------------------
    -- Uniqueness on canonical feature-reference property values (table is empty).
    --------------------------------------------------------------------------------
    ALTER TABLE submission_feature_property_feature
      ADD CONSTRAINT submission_feature_property_feature_uk1
      UNIQUE (submission_feature_id, feature_type_property_id, referenced_submission_feature_id);

    --------------------------------------------------------------------------------
    -- UNLOGGED upload-scoped feature-reference candidate staging.
    --------------------------------------------------------------------------------
    CREATE UNLOGGED TABLE IF NOT EXISTS submission_upload_staging_feature_candidate (
      submission_upload_id uuid NOT NULL,
      submission_feature_id integer NOT NULL,
      property_name text NOT NULL,
      feature_type_property_id integer NOT NULL,
      raw_value jsonb NOT NULL,
      is_format_valid boolean NOT NULL,
      parsed_source_id text,
      referenced_submission_feature_id integer,
      referenced_feature_type_id integer
    );

    CREATE INDEX IF NOT EXISTS sf_feature_candidate_work_idx1
      ON submission_upload_staging_feature_candidate (submission_upload_id, is_format_valid);
    CREATE INDEX IF NOT EXISTS sf_feature_candidate_work_idx2
      ON submission_upload_staging_feature_candidate (submission_upload_id, feature_type_property_id);

    COMMENT ON TABLE submission_upload_staging_feature_candidate IS
      'UNLOGGED upload-scoped parsed feature-reference candidates and within-upload resolution outputs.';
    COMMENT ON COLUMN submission_upload_staging_feature_candidate.submission_upload_id IS
      'Upload scope this feature-reference candidate belongs to.';
    COMMENT ON COLUMN submission_upload_staging_feature_candidate.submission_feature_id IS
      'Source submission feature carrying the feature-valued property.';
    COMMENT ON COLUMN submission_upload_staging_feature_candidate.property_name IS
      'Property name as submitted, retained for error grouping.';
    COMMENT ON COLUMN submission_upload_staging_feature_candidate.feature_type_property_id IS
      'Resolved feature_type_property definition for the source feature type.';
    COMMENT ON COLUMN submission_upload_staging_feature_candidate.raw_value IS
      'Original jsonb property value before parsing.';
    COMMENT ON COLUMN submission_upload_staging_feature_candidate.is_format_valid IS
      'True when the value parsed as a strict feature::<source_id> reference.';
    COMMENT ON COLUMN submission_upload_staging_feature_candidate.parsed_source_id IS
      'The <source_id> extracted from a well-formed reference; null when malformed.';
    COMMENT ON COLUMN submission_upload_staging_feature_candidate.referenced_submission_feature_id IS
      'The within-upload feature the source_id resolved to; null when unresolved. Resolution is intentionally upload-scoped — cross-upload references are not resolved even though the canonical FK permits them.';
    COMMENT ON COLUMN submission_upload_staging_feature_candidate.referenced_feature_type_id IS
      'The resolved target feature type, used to validate against the property allowed target type.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Drop UNLOGGED feature-reference candidate staging.
    --------------------------------------------------------------------------------
    DROP TABLE IF EXISTS submission_upload_staging_feature_candidate;

    --------------------------------------------------------------------------------
    -- Drop uniqueness on canonical feature-reference property values.
    --------------------------------------------------------------------------------
    ALTER TABLE submission_feature_property_feature
      DROP CONSTRAINT IF EXISTS submission_feature_property_feature_uk1;

    --------------------------------------------------------------------------------
    -- Drop allowed-target type for feature-valued properties.
    --------------------------------------------------------------------------------
    ALTER TABLE feature_type_property
      DROP CONSTRAINT IF EXISTS feature_type_property_fk3,
      DROP COLUMN IF EXISTS allowed_referenced_feature_type_id;
  `);
}
