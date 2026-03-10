import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- TABLES
    --------------------------------------------------------------------------------
    CREATE TABLE code_category (
      code_category_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      contributor_id INTEGER NOT NULL,
      value VARCHAR(128) NOT NULL,
      label VARCHAR(250) NOT NULL,
      description VARCHAR(1000),
      version VARCHAR(50),
      record_end_date TIMESTAMPTZ(6),
      create_date TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      create_user INTEGER NOT NULL,
      update_date TIMESTAMPTZ(6),
      update_user INTEGER,
      revision_count INTEGER NOT NULL DEFAULT 0,

      CONSTRAINT code_category_fk1 FOREIGN KEY (contributor_id) REFERENCES contributor(contributor_id)
    );

    CREATE TABLE code (
      code_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code_category_id INTEGER NOT NULL,
      value VARCHAR(128) NOT NULL,
      label VARCHAR(250) NOT NULL,
      description VARCHAR(1000),
      version VARCHAR(50),
      record_end_date TIMESTAMPTZ(6),
      create_date TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      create_user INTEGER NOT NULL,
      update_date TIMESTAMPTZ(6),
      update_user INTEGER,
      revision_count INTEGER NOT NULL DEFAULT 0,

      CONSTRAINT code_fk1 FOREIGN KEY (code_category_id) REFERENCES code_category(code_category_id)
    );

    CREATE TABLE submission_feature_property_code (
      submission_feature_property_code_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      submission_feature_id INTEGER NOT NULL,
      feature_type_property_id INTEGER NOT NULL,
      code_id INTEGER NOT NULL,
      record_end_date TIMESTAMPTZ(6),
      create_date TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      create_user INTEGER NOT NULL,
      update_date TIMESTAMPTZ(6),
      update_user INTEGER,
      revision_count INTEGER NOT NULL DEFAULT 0,

      CONSTRAINT submission_feature_property_code_fk1 FOREIGN KEY (submission_feature_id) REFERENCES submission_feature(submission_feature_id),
      CONSTRAINT submission_feature_property_code_fk2 FOREIGN KEY (feature_type_property_id) REFERENCES feature_type_property(feature_type_property_id),
      CONSTRAINT submission_feature_property_code_fk3 FOREIGN KEY (code_id) REFERENCES code(code_id)
    );

    --------------------------------------------------------------------------------
    -- INDEXES
    --------------------------------------------------------------------------------

    CREATE INDEX code_category_idx1 ON code_category(contributor_id);
    CREATE UNIQUE INDEX code_category_nuk1
      ON code_category(contributor_id, value, version)
      WHERE record_end_date IS NULL;
    CREATE INDEX code_category_idx2
      ON code_category(value, version)
      WHERE record_end_date IS NULL;

    CREATE INDEX code_idx1 ON code(code_category_id);
    CREATE UNIQUE INDEX code_nuk1
      ON code(code_category_id, value, version)
      WHERE record_end_date IS NULL;
    CREATE INDEX code_idx2
      ON code(value, version)
      WHERE record_end_date IS NULL;

    CREATE INDEX submission_feature_property_code_idx1 ON submission_feature_property_code(submission_feature_id);
    CREATE INDEX submission_feature_property_code_idx2 ON submission_feature_property_code(feature_type_property_id);
    CREATE INDEX submission_feature_property_code_idx3 ON submission_feature_property_code(code_id);
    CREATE INDEX submission_feature_property_code_idx4 ON submission_feature_property_code(code_id, submission_feature_id);

    --------------------------------------------------------------------------------
    -- COMMENTS
    --------------------------------------------------------------------------------

    COMMENT ON TABLE code_category IS 'Controlled vocabulary category (code set) with versioned definitions.';
    COMMENT ON COLUMN code_category.code_category_id IS 'Primary key.';
    COMMENT ON COLUMN code_category.contributor_id IS 'Foreign key to contributor that defines this code category.';
    COMMENT ON COLUMN code_category.value IS 'Machine-readable identifier for the category.';
    COMMENT ON COLUMN code_category.label IS 'Human-readable category label.';
    COMMENT ON COLUMN code_category.description IS 'Optional category description.';
    COMMENT ON COLUMN code_category.version IS 'Optional category definition version.';
    COMMENT ON COLUMN code_category.record_end_date IS 'Timestamp for soft delete; null when active.';
    COMMENT ON COLUMN code_category.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN code_category.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN code_category.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN code_category.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN code_category.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE code IS 'Versioned controlled vocabulary code belonging to a code category.';
    COMMENT ON COLUMN code.code_id IS 'Primary key.';
    COMMENT ON COLUMN code.code_category_id IS 'Foreign key to code_category.';
    COMMENT ON COLUMN code.value IS 'Machine-readable code value, stored as text (varchar(128)).';
    COMMENT ON COLUMN code.label IS 'Human-readable code label.';
    COMMENT ON COLUMN code.description IS 'Optional code description.';
    COMMENT ON COLUMN code.version IS 'Optional code definition version.';
    COMMENT ON COLUMN code.record_end_date IS 'Timestamp for soft delete; null when active.';
    COMMENT ON COLUMN code.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN code.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN code.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN code.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN code.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE submission_feature_property_code IS 'Canonical typed coded property values linked to a feature and feature_type_property definition.';
    COMMENT ON COLUMN submission_feature_property_code.submission_feature_property_code_id IS 'Primary key.';
    COMMENT ON COLUMN submission_feature_property_code.submission_feature_id IS 'Foreign key to submission_feature.';
    COMMENT ON COLUMN submission_feature_property_code.feature_type_property_id IS 'Foreign key to feature_type_property.';
    COMMENT ON COLUMN submission_feature_property_code.code_id IS 'Foreign key to code.';
    COMMENT ON COLUMN submission_feature_property_code.record_end_date IS 'Timestamp for soft delete; null when active.';
    COMMENT ON COLUMN submission_feature_property_code.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_property_code.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN submission_feature_property_code.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN submission_feature_property_code.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN submission_feature_property_code.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_code_category
      BEFORE INSERT OR UPDATE OR DELETE ON code_category
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_code_category
      AFTER INSERT OR UPDATE OR DELETE ON code_category
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_code
      BEFORE INSERT OR UPDATE OR DELETE ON code
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_code
      AFTER INSERT OR UPDATE OR DELETE ON code
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
    DROP TABLE IF EXISTS code CASCADE;
    DROP TABLE IF EXISTS code_category CASCADE;
  `);
}
