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

    --------------------------------------------------------------------------------
    -- RENAME CODE_ID -> CONTRIBUTOR_CODESET_CODE_ID AS FOREIGN KEY
    --------------------------------------------------------------------------------

    -- 1. Rename the column
    ALTER TABLE submission_feature_property_code
      RENAME COLUMN code_id TO contributor_codeset_code_id;

    -- 2. Add foreign key constraint
    ALTER TABLE submission_feature_property_code
      ADD CONSTRAINT submission_feature_property_code_fk3
      FOREIGN KEY (contributor_codeset_code_id)
      REFERENCES contributor_codeset_code(contributor_codeset_code_id);

    -- 3. Drop old index (if it exists)
    DROP INDEX IF EXISTS submission_feature_property_code_idx3;

    -- 4. Create new index on the renamed column
    CREATE INDEX submission_feature_property_code_idx3
      ON submission_feature_property_code(contributor_codeset_code_id);

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
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- TRIGGERS
    --------------------------------------------------------------------------------

    DROP TRIGGER IF EXISTS audit_contributor_codeset_code ON contributor_codeset_code;
    DROP TRIGGER IF EXISTS journal_contributor_codeset_code ON contributor_codeset_code;

    DROP TRIGGER IF EXISTS audit_contributor_codeset ON contributor_codeset;
    DROP TRIGGER IF EXISTS journal_contributor_codeset ON contributor_codeset;

    
    --------------------------------------------------------------------------------
    -- REVERT submission_feature_property_code CHANGES
    --------------------------------------------------------------------------------

    -- Drop FK constraint
    ALTER TABLE submission_feature_property_code
      DROP CONSTRAINT IF EXISTS submission_feature_property_code_fk3;

    -- Drop index on new column
    DROP INDEX IF EXISTS submission_feature_property_code_idx3;

    -- Rename column back
    ALTER TABLE submission_feature_property_code
      RENAME COLUMN contributor_codeset_code_id TO code_id;

    -- Recreate original index
    CREATE INDEX submission_feature_property_code_idx3
      ON submission_feature_property_code(code_id);
      
    --------------------------------------------------------------------------------
    -- TABLES
    --------------------------------------------------------------------------------

    DROP TABLE IF EXISTS contributor_codeset_code;
    DROP TABLE IF EXISTS contributor_codeset;
  `);
}
