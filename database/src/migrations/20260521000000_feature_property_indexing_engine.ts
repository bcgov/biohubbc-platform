import type { Knex } from 'knex';

/**
 * Schema support for the feature-reference property indexing engine:
 *
 * 1. Adds the `feature_type_property_feature` join table so feature-valued properties may declare
 *    one or more allowed target feature types. The `feature::<id>` reference syntax carries no
 *    type, so the allowed targets are read from this table.
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
    -- Allowed target feature types for feature-valued properties.
    --------------------------------------------------------------------------------
    CREATE TABLE feature_type_property_feature (
      feature_type_property_feature_id uuid DEFAULT gen_random_uuid() NOT NULL,
      feature_type_property_id integer NOT NULL,
      target_feature_type_id integer NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT feature_type_property_feature_pk PRIMARY KEY (feature_type_property_feature_id),
      CONSTRAINT feature_type_property_feature_fk1
        FOREIGN KEY (feature_type_property_id) REFERENCES feature_type_property(feature_type_property_id),
      CONSTRAINT feature_type_property_feature_fk2
        FOREIGN KEY (target_feature_type_id) REFERENCES feature_type(feature_type_id)
    );

    -- Disallow duplicate (property, target) rows while a record is active.
    CREATE UNIQUE INDEX feature_type_property_feature_nuk1
      ON feature_type_property_feature(feature_type_property_id, target_feature_type_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX feature_type_property_feature_idx1
      ON feature_type_property_feature(feature_type_property_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX feature_type_property_feature_idx2
      ON feature_type_property_feature(target_feature_type_id)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE  feature_type_property_feature IS 'For a feature-valued feature_type_property, the set of feature types a feature::<id> reference is allowed to resolve to. A property with no active rows here permits no targets.';
    COMMENT ON COLUMN feature_type_property_feature.feature_type_property_feature_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN feature_type_property_feature.feature_type_property_id IS 'Foreign key to the feature_type_property table — the feature-valued property whose allowed target type is being declared.';
    COMMENT ON COLUMN feature_type_property_feature.target_feature_type_id IS 'Foreign key to the feature_type table — a feature type that a feature::<id> reference is allowed to resolve to.';
    COMMENT ON COLUMN feature_type_property_feature.record_end_date IS 'Date/time when this allowed-target association was ended (soft delete).';
    COMMENT ON COLUMN feature_type_property_feature.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN feature_type_property_feature.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN feature_type_property_feature.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN feature_type_property_feature.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN feature_type_property_feature.revision_count IS 'Revision count used for concurrency control.';

    CREATE TRIGGER audit_feature_type_property_feature
      BEFORE INSERT OR UPDATE OR DELETE ON feature_type_property_feature
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_feature_type_property_feature
      AFTER INSERT OR UPDATE OR DELETE ON feature_type_property_feature
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

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
      'The resolved target feature type, used to validate against the property allowed target types.';
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
    -- Drop allowed-target feature type join table.
    --------------------------------------------------------------------------------
    DROP TABLE IF EXISTS feature_type_property_feature;
  `);
}
