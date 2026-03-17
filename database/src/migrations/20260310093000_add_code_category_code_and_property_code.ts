import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- TABLES
    --------------------------------------------------------------------------------
    CREATE TABLE contributor_codeset (
      contributor_codeset_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      contributor_id INTEGER NOT NULL,
      key VARCHAR(128) NOT NULL,
      label VARCHAR(250) NOT NULL,
      description VARCHAR(1000),
      external_id VARCHAR(50),
      record_end_date TIMESTAMPTZ(6),
      create_date TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      create_user INTEGER NOT NULL,
      update_date TIMESTAMPTZ(6),
      update_user INTEGER,
      revision_count INTEGER NOT NULL DEFAULT 0,

      CONSTRAINT contributor_codeset_fk1 FOREIGN KEY (contributor_id) REFERENCES contributor(contributor_id)
    );

    CREATE TABLE contributor_codeset_code (
      contributor_codeset_code_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      contributor_codeset_id INTEGER NOT NULL,
      key VARCHAR(128) NOT NULL,
      label VARCHAR(250) NOT NULL,
      description VARCHAR(1000),
      external_id VARCHAR(50),
      record_end_date TIMESTAMPTZ(6),
      create_date TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      create_user INTEGER NOT NULL,
      update_date TIMESTAMPTZ(6),
      update_user INTEGER,
      revision_count INTEGER NOT NULL DEFAULT 0,

      CONSTRAINT contributor_codeset_code_fk1 FOREIGN KEY (contributor_codeset_id) REFERENCES contributor_codeset(contributor_codeset_id)
    );

    CREATE TABLE submission_feature_property_code (
      submission_feature_property_code_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      submission_feature_id INTEGER NOT NULL,
      feature_type_property_id INTEGER NOT NULL,
      contributor_codeset_code_id INTEGER NOT NULL,
      record_end_date TIMESTAMPTZ(6),
      create_date TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      create_user INTEGER NOT NULL,
      update_date TIMESTAMPTZ(6),
      update_user INTEGER,
      revision_count INTEGER NOT NULL DEFAULT 0,

      CONSTRAINT submission_feature_property_code_fk1 FOREIGN KEY (submission_feature_id) REFERENCES submission_feature(submission_feature_id),
      CONSTRAINT submission_feature_property_code_fk2 FOREIGN KEY (feature_type_property_id) REFERENCES feature_type_property(feature_type_property_id),
      CONSTRAINT submission_feature_property_code_fk3 FOREIGN KEY (contributor_codeset_code_id) REFERENCES contributor_codeset_code(contributor_codeset_code_id)
    );

    --------------------------------------------------------------------------------
    -- INDEXES
    --------------------------------------------------------------------------------

    CREATE INDEX contributor_codeset_idx1 ON contributor_codeset(contributor_id);
    CREATE UNIQUE INDEX contributor_codeset_nuk1 ON contributor_codeset(contributor_id, key, external_id) WHERE record_end_date IS NULL;
    CREATE INDEX contributor_codeset_idx2
      ON contributor_codeset(key)
      WHERE record_end_date IS NULL;

    CREATE INDEX contributor_codeset_code_idx1 ON contributor_codeset_code(contributor_codeset_id);
    CREATE UNIQUE INDEX contributor_codeset_code_nuk1 ON contributor_codeset_code(contributor_codeset_id, key, external_id) WHERE record_end_date IS NULL;
    CREATE INDEX contributor_codeset_code_idx2
      ON contributor_codeset_code(key)
      WHERE record_end_date IS NULL;

    CREATE INDEX submission_feature_property_code_idx1 ON submission_feature_property_code(submission_feature_id);
    CREATE INDEX submission_feature_property_code_idx2 ON submission_feature_property_code(feature_type_property_id);
    CREATE INDEX submission_feature_property_code_idx3 ON submission_feature_property_code(contributor_codeset_code_id);
    CREATE INDEX submission_feature_property_code_idx4 ON submission_feature_property_code(contributor_codeset_code_id, submission_feature_id);

    --------------------------------------------------------------------------------
    -- COMMENTS
    --------------------------------------------------------------------------------

    COMMENT ON TABLE contributor_codeset IS 'Controlled vocabulary code set with versioned definitions per contributor.';
    COMMENT ON COLUMN contributor_codeset.contributor_codeset_id IS 'Primary key.';
    COMMENT ON COLUMN contributor_codeset.contributor_id IS 'Foreign key to contributor that defines this code set.';
    COMMENT ON COLUMN contributor_codeset.key IS 'Machine-readable identifier for the code set.';
    COMMENT ON COLUMN contributor_codeset.label IS 'Human-readable code set label.';
    COMMENT ON COLUMN contributor_codeset.description IS 'Optional code set description.';
    COMMENT ON COLUMN contributor_codeset.external_id IS 'Code set definition external_id.';
    COMMENT ON COLUMN contributor_codeset.record_end_date IS 'Timestamp for soft delete; null when active.';
    COMMENT ON COLUMN contributor_codeset.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN contributor_codeset.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN contributor_codeset.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN contributor_codeset.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN contributor_codeset.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE contributor_codeset_code IS 'Versioned controlled vocabulary code belonging to a contributor code set.';
    COMMENT ON COLUMN contributor_codeset_code.contributor_codeset_code_id IS 'Primary key.';
    COMMENT ON COLUMN contributor_codeset_code.contributor_codeset_id IS 'Foreign key to contributor_codeset.';
    COMMENT ON COLUMN contributor_codeset_code.key IS 'Machine-readable code key, stored as text (varchar(128)).';
    COMMENT ON COLUMN contributor_codeset_code.label IS 'Human-readable code label.';
    COMMENT ON COLUMN contributor_codeset_code.description IS 'Optional code description.';
    COMMENT ON COLUMN contributor_codeset_code.external_id IS 'Code definition external_id.';
    COMMENT ON COLUMN contributor_codeset_code.record_end_date IS 'Timestamp for soft delete; null when active.';
    COMMENT ON COLUMN contributor_codeset_code.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN contributor_codeset_code.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN contributor_codeset_code.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN contributor_codeset_code.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN contributor_codeset_code.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE submission_feature_property_code IS 'Canonical typed coded property values linked to a feature and feature_type_property definition.';
    COMMENT ON COLUMN submission_feature_property_code.submission_feature_property_code_id IS 'Primary key.';
    COMMENT ON COLUMN submission_feature_property_code.submission_feature_id IS 'Foreign key to submission_feature.';
    COMMENT ON COLUMN submission_feature_property_code.feature_type_property_id IS 'Foreign key to feature_type_property.';
    COMMENT ON COLUMN submission_feature_property_code.contributor_codeset_code_id IS 'Foreign key to contributor_codeset_code.';
    COMMENT ON COLUMN submission_feature_property_code.record_end_date IS 'Timestamp for soft delete; null when active.';
    COMMENT ON COLUMN submission_feature_property_code.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_property_code.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN submission_feature_property_code.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN submission_feature_property_code.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN submission_feature_property_code.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_contributor_codeset
      BEFORE INSERT OR UPDATE OR DELETE ON contributor_codeset
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_contributor_codeset
      AFTER INSERT OR UPDATE OR DELETE ON contributor_codeset
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_contributor_codeset_code
      BEFORE INSERT OR UPDATE OR DELETE ON contributor_codeset_code
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_contributor_codeset_code
      AFTER INSERT OR UPDATE OR DELETE ON contributor_codeset_code
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_submission_feature_property_code
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature_property_code
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_submission_feature_property_code
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_property_code
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP TABLE IF EXISTS submission_feature_property_code CASCADE;
    DROP TABLE IF EXISTS contributor_codeset_code CASCADE;
    DROP TABLE IF EXISTS contributor_codeset CASCADE;
  `);
}
