import type { Knex } from 'knex';

/**
 * Adds the canonical typed-property table `submission_feature_property_feature` and its
 * `feature` lookup row, mirroring the sibling property-table pattern. Distinct from
 * `submission_feature_feature`, which models content relationships rather than typed
 * properties.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- Ensure feature_property_type = feature exists (idempotent)
    ----------------------------------------------------------------------------------------

    -- Idempotent: skipped if a feature_property_type row named 'feature' already exists.
    INSERT INTO feature_property_type (name, description)
    SELECT 'feature', 'A reference to another submitted feature'
    WHERE NOT EXISTS (
      SELECT 1
      FROM feature_property_type
      WHERE name = 'feature'
        AND record_end_date IS NULL
    );

    ----------------------------------------------------------------------------------------
    -- Create table
    ----------------------------------------------------------------------------------------

    CREATE TABLE submission_feature_property_feature (
      submission_feature_property_feature_id  integer        GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id                   integer        NOT NULL,
      feature_type_property_id                integer        NOT NULL,
      referenced_submission_feature_id        integer        NOT NULL,
      create_date                             timestamptz(6) DEFAULT now() NOT NULL,
      create_user                             integer        NOT NULL,
      update_date                             timestamptz(6),
      update_user                             integer,
      revision_count                          integer        DEFAULT 0 NOT NULL,
      CONSTRAINT submission_feature_property_feature_pk PRIMARY KEY (submission_feature_property_feature_id)
    );

    ----------------------------------------------------------------------------------------
    -- Create indexes and constraints
    ----------------------------------------------------------------------------------------

    -- Plain FKs (no ON DELETE clause) match the sibling submission_feature_property_* tables. Cleanup of dependent property rows is the application's responsibility, not the schema's.
    ALTER TABLE submission_feature_property_feature ADD CONSTRAINT submission_feature_property_feature_fk1
      FOREIGN KEY (submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    ALTER TABLE submission_feature_property_feature ADD CONSTRAINT submission_feature_property_feature_fk2
      FOREIGN KEY (feature_type_property_id)
      REFERENCES feature_type_property(feature_type_property_id);

    ALTER TABLE submission_feature_property_feature ADD CONSTRAINT submission_feature_property_feature_fk3
      FOREIGN KEY (referenced_submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    CREATE INDEX submission_feature_property_feature_idx1
      ON submission_feature_property_feature (submission_feature_id, feature_type_property_id);

    CREATE INDEX submission_feature_property_feature_idx2
      ON submission_feature_property_feature (feature_type_property_id, referenced_submission_feature_id, submission_feature_id);

    CREATE INDEX submission_feature_property_feature_idx3
      ON submission_feature_property_feature (referenced_submission_feature_id);

    ----------------------------------------------------------------------------------------
    -- Table and column comments
    ----------------------------------------------------------------------------------------

    COMMENT ON TABLE submission_feature_property_feature IS 'Canonical typed feature-reference property values. Each row records that one submission_feature has a typed property whose value resolves to another submission_feature. Distinct from submission_feature_feature, which models content (data.content) relationships.';
    COMMENT ON COLUMN submission_feature_property_feature.submission_feature_property_feature_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_feature_property_feature.submission_feature_id IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN submission_feature_property_feature.feature_type_property_id IS 'Foreign key to the feature_type_property table.';
    COMMENT ON COLUMN submission_feature_property_feature.referenced_submission_feature_id IS 'Foreign key to the submission_feature row referenced by this property. May reference a feature in a different submission (cross-submission references via URN are supported at the schema level).';
    COMMENT ON COLUMN submission_feature_property_feature.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_property_feature.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_property_feature.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN submission_feature_property_feature.update_user IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_property_feature.revision_count IS 'Revision count used for concurrency control.';

    ----------------------------------------------------------------------------------------
    -- Create audit and journal triggers
    ----------------------------------------------------------------------------------------

    CREATE TRIGGER audit_submission_feature_property_feature
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature_property_feature
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_submission_feature_property_feature
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_property_feature
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- Drop triggers
    ----------------------------------------------------------------------------------------

    DROP TRIGGER IF EXISTS journal_submission_feature_property_feature ON submission_feature_property_feature;
    DROP TRIGGER IF EXISTS audit_submission_feature_property_feature ON submission_feature_property_feature;

    ----------------------------------------------------------------------------------------
    -- Drop tables
    ----------------------------------------------------------------------------------------

    DROP TABLE IF EXISTS submission_feature_property_feature;

    ----------------------------------------------------------------------------------------
    -- Revert lookup row
    ----------------------------------------------------------------------------------------

    DELETE FROM feature_property_type WHERE name = 'feature';
  `);
}
