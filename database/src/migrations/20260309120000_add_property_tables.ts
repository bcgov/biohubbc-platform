import { Knex } from 'knex';

/**
 * Add canonical typed property tables:
 * - submission_feature_property_string
 * - submission_feature_property_number
 * - submission_feature_property_boolean
 * - submission_feature_property_timestamp
 * - submission_feature_property_code
 * - submission_feature_property_taxon
 * - submission_feature_property_geometry
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- Create tables
    ----------------------------------------------------------------------------------------

    CREATE TABLE submission_feature_property_string (
      submission_feature_property_string_id         integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id      integer           NOT NULL,
      feature_type_property_id   integer           NOT NULL,
      value                      varchar(250)      NOT NULL,
      create_date                timestamptz(6)    DEFAULT now() NOT NULL,
      create_user                integer           NOT NULL,
      update_date                timestamptz(6),
      update_user                integer,
      revision_count             integer           DEFAULT 0 NOT NULL,
      CONSTRAINT submission_feature_property_string_pk PRIMARY KEY (submission_feature_property_string_id)
    );

    CREATE TABLE submission_feature_property_number (
      submission_feature_property_number_id         integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id      integer           NOT NULL,
      feature_type_property_id   integer           NOT NULL,
      value                      numeric           NOT NULL,
      create_date                timestamptz(6)    DEFAULT now() NOT NULL,
      create_user                integer           NOT NULL,
      update_date                timestamptz(6),
      update_user                integer,
      revision_count             integer           DEFAULT 0 NOT NULL,
      CONSTRAINT submission_feature_property_number_pk PRIMARY KEY (submission_feature_property_number_id)
    );

    CREATE TABLE submission_feature_property_boolean (
      submission_feature_property_boolean_id        integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id      integer           NOT NULL,
      feature_type_property_id   integer           NOT NULL,
      value                      boolean           NOT NULL,
      create_date                timestamptz(6)    DEFAULT now() NOT NULL,
      create_user                integer           NOT NULL,
      update_date                timestamptz(6),
      update_user                integer,
      revision_count             integer           DEFAULT 0 NOT NULL,
      CONSTRAINT submission_feature_property_boolean_pk PRIMARY KEY (submission_feature_property_boolean_id)
    );

    CREATE TABLE submission_feature_property_timestamp (
      submission_feature_property_timestamp_id       integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id      integer           NOT NULL,
      feature_type_property_id   integer           NOT NULL,
      value                      timestamptz(6)    NOT NULL,
      create_date                timestamptz(6)    DEFAULT now() NOT NULL,
      create_user                integer           NOT NULL,
      update_date                timestamptz(6),
      update_user                integer,
      revision_count             integer           DEFAULT 0 NOT NULL,
      CONSTRAINT submission_feature_property_timestamp_pk PRIMARY KEY (submission_feature_property_timestamp_id)
    );

    CREATE TABLE submission_feature_property_code (
      submission_feature_property_code_id           integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id      integer           NOT NULL,
      feature_type_property_id   integer           NOT NULL,
      code_id                    integer           NOT NULL,
      create_date                timestamptz(6)    DEFAULT now() NOT NULL,
      create_user                integer           NOT NULL,
      update_date                timestamptz(6),
      update_user                integer,
      revision_count             integer           DEFAULT 0 NOT NULL,
      CONSTRAINT submission_feature_property_code_pk PRIMARY KEY (submission_feature_property_code_id)
    );

    CREATE TABLE submission_feature_property_taxon (
      submission_feature_property_taxon_id          integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id      integer           NOT NULL,
      feature_type_property_id   integer           NOT NULL,
      taxon_id                   integer           NOT NULL,
      create_date                timestamptz(6)    DEFAULT now() NOT NULL,
      create_user                integer           NOT NULL,
      update_date                timestamptz(6),
      update_user                integer,
      revision_count             integer           DEFAULT 0 NOT NULL,
      CONSTRAINT submission_feature_property_taxon_pk PRIMARY KEY (submission_feature_property_taxon_id)
    );

    CREATE TABLE submission_feature_property_geometry (
      submission_feature_property_geometry_id       integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id      integer           NOT NULL,
      feature_type_property_id   integer           NOT NULL,
      value                      geometry          NOT NULL,
      create_date                timestamptz(6)    DEFAULT now() NOT NULL,
      create_user                integer           NOT NULL,
      update_date                timestamptz(6),
      update_user                integer,
      revision_count             integer           DEFAULT 0 NOT NULL,
      CONSTRAINT submission_feature_property_geometry_pk PRIMARY KEY (submission_feature_property_geometry_id)
    );

    ----------------------------------------------------------------------------------------
    -- Create indexes and constraints
    ----------------------------------------------------------------------------------------

    -- submission_feature_property_string
    ALTER TABLE submission_feature_property_string ADD CONSTRAINT submission_feature_property_string_fk1
      FOREIGN KEY (submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    ALTER TABLE submission_feature_property_string ADD CONSTRAINT submission_feature_property_string_fk2
      FOREIGN KEY (feature_type_property_id)
      REFERENCES feature_type_property(feature_type_property_id);

    CREATE INDEX submission_feature_property_string_idx1 ON submission_feature_property_string(submission_feature_id);
    CREATE INDEX submission_feature_property_string_idx2 ON submission_feature_property_string(feature_type_property_id);
    CREATE INDEX submission_feature_property_string_idx3 ON submission_feature_property_string(value);

    -- submission_feature_property_number
    ALTER TABLE submission_feature_property_number ADD CONSTRAINT submission_feature_property_number_fk1
      FOREIGN KEY (submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    ALTER TABLE submission_feature_property_number ADD CONSTRAINT submission_feature_property_number_fk2
      FOREIGN KEY (feature_type_property_id)
      REFERENCES feature_type_property(feature_type_property_id);

    CREATE INDEX submission_feature_property_number_idx1 ON submission_feature_property_number(submission_feature_id);
    CREATE INDEX submission_feature_property_number_idx2 ON submission_feature_property_number(feature_type_property_id);
    CREATE INDEX submission_feature_property_number_idx3 ON submission_feature_property_number(value);

    -- submission_feature_property_boolean
    ALTER TABLE submission_feature_property_boolean ADD CONSTRAINT submission_feature_property_boolean_fk1
      FOREIGN KEY (submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    ALTER TABLE submission_feature_property_boolean ADD CONSTRAINT submission_feature_property_boolean_fk2
      FOREIGN KEY (feature_type_property_id)
      REFERENCES feature_type_property(feature_type_property_id);

    CREATE INDEX submission_feature_property_boolean_idx1 ON submission_feature_property_boolean(submission_feature_id);
    CREATE INDEX submission_feature_property_boolean_idx2 ON submission_feature_property_boolean(feature_type_property_id);
    CREATE INDEX submission_feature_property_boolean_idx3 ON submission_feature_property_boolean(value);

    -- submission_feature_property_timestamp
    ALTER TABLE submission_feature_property_timestamp ADD CONSTRAINT submission_feature_property_timestamp_fk1
      FOREIGN KEY (submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    ALTER TABLE submission_feature_property_timestamp ADD CONSTRAINT submission_feature_property_timestamp_fk2
      FOREIGN KEY (feature_type_property_id)
      REFERENCES feature_type_property(feature_type_property_id);

    CREATE INDEX submission_feature_property_timestamp_idx1 ON submission_feature_property_timestamp(submission_feature_id);
    CREATE INDEX submission_feature_property_timestamp_idx2 ON submission_feature_property_timestamp(feature_type_property_id);
    CREATE INDEX submission_feature_property_timestamp_idx3 ON submission_feature_property_timestamp(value);

    -- submission_feature_property_code
    ALTER TABLE submission_feature_property_code ADD CONSTRAINT submission_feature_property_code_fk1
      FOREIGN KEY (submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    ALTER TABLE submission_feature_property_code ADD CONSTRAINT submission_feature_property_code_fk2
      FOREIGN KEY (feature_type_property_id)
      REFERENCES feature_type_property(feature_type_property_id);

    CREATE INDEX submission_feature_property_code_idx1 ON submission_feature_property_code(submission_feature_id);
    CREATE INDEX submission_feature_property_code_idx2 ON submission_feature_property_code(feature_type_property_id);
    CREATE INDEX submission_feature_property_code_idx3 ON submission_feature_property_code(code_id);

    -- submission_feature_property_taxon
    ALTER TABLE submission_feature_property_taxon ADD CONSTRAINT submission_feature_property_taxon_fk1
      FOREIGN KEY (submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    ALTER TABLE submission_feature_property_taxon ADD CONSTRAINT submission_feature_property_taxon_fk2
      FOREIGN KEY (feature_type_property_id)
      REFERENCES feature_type_property(feature_type_property_id);

    ALTER TABLE submission_feature_property_taxon ADD CONSTRAINT submission_feature_property_taxon_fk3
      FOREIGN KEY (taxon_id)
      REFERENCES taxon(taxon_id);

    CREATE INDEX submission_feature_property_taxon_idx1 ON submission_feature_property_taxon(submission_feature_id);
    CREATE INDEX submission_feature_property_taxon_idx2 ON submission_feature_property_taxon(feature_type_property_id);
    CREATE INDEX submission_feature_property_taxon_idx3 ON submission_feature_property_taxon(taxon_id);

    -- submission_feature_property_geometry
    ALTER TABLE submission_feature_property_geometry ADD CONSTRAINT submission_feature_property_geometry_fk1
      FOREIGN KEY (submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    ALTER TABLE submission_feature_property_geometry ADD CONSTRAINT submission_feature_property_geometry_fk2
      FOREIGN KEY (feature_type_property_id)
      REFERENCES feature_type_property(feature_type_property_id);

    CREATE INDEX submission_feature_property_geometry_idx1 ON submission_feature_property_geometry(submission_feature_id);
    CREATE INDEX submission_feature_property_geometry_idx2 ON submission_feature_property_geometry(feature_type_property_id);
    CREATE INDEX submission_feature_property_geometry_idx3 ON submission_feature_property_geometry USING GIST(value);

    ----------------------------------------------------------------------------------------
    -- Table and column comments
    ----------------------------------------------------------------------------------------

    COMMENT ON TABLE submission_feature_property_string IS 'Canonical typed string property values.';
    COMMENT ON COLUMN submission_feature_property_string.submission_feature_property_string_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_feature_property_string.submission_feature_id IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN submission_feature_property_string.feature_type_property_id IS 'Foreign key to the feature_type_property table.';
    COMMENT ON COLUMN submission_feature_property_string.value IS 'The string property value.';
    COMMENT ON COLUMN submission_feature_property_string.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_property_string.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_property_string.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN submission_feature_property_string.update_user IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_property_string.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE submission_feature_property_number IS 'Canonical typed numeric property values.';
    COMMENT ON COLUMN submission_feature_property_number.submission_feature_property_number_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_feature_property_number.submission_feature_id IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN submission_feature_property_number.feature_type_property_id IS 'Foreign key to the feature_type_property table.';
    COMMENT ON COLUMN submission_feature_property_number.value IS 'The numeric property value.';
    COMMENT ON COLUMN submission_feature_property_number.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_property_number.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_property_number.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN submission_feature_property_number.update_user IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_property_number.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE submission_feature_property_boolean IS 'Canonical typed boolean property values.';
    COMMENT ON COLUMN submission_feature_property_boolean.submission_feature_property_boolean_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_feature_property_boolean.submission_feature_id IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN submission_feature_property_boolean.feature_type_property_id IS 'Foreign key to the feature_type_property table.';
    COMMENT ON COLUMN submission_feature_property_boolean.value IS 'The boolean property value.';
    COMMENT ON COLUMN submission_feature_property_boolean.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_property_boolean.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_property_boolean.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN submission_feature_property_boolean.update_user IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_property_boolean.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE submission_feature_property_timestamp IS 'Canonical typed timestamp with timezone property values.';
    COMMENT ON COLUMN submission_feature_property_timestamp.submission_feature_property_timestamp_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_feature_property_timestamp.submission_feature_id IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN submission_feature_property_timestamp.feature_type_property_id IS 'Foreign key to the feature_type_property table.';
    COMMENT ON COLUMN submission_feature_property_timestamp.value IS 'The timestamptz property value.';
    COMMENT ON COLUMN submission_feature_property_timestamp.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_property_timestamp.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_property_timestamp.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN submission_feature_property_timestamp.update_user IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_property_timestamp.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE submission_feature_property_code IS 'Canonical typed coded property values.';
    COMMENT ON COLUMN submission_feature_property_code.submission_feature_property_code_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_feature_property_code.submission_feature_id IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN submission_feature_property_code.feature_type_property_id IS 'Foreign key to the feature_type_property table.';
    COMMENT ON COLUMN submission_feature_property_code.code_id IS 'Resolved code identifier value; FK intentionally deferred to a later codes schema migration.';
    COMMENT ON COLUMN submission_feature_property_code.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_property_code.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_property_code.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN submission_feature_property_code.update_user IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_property_code.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE submission_feature_property_taxon IS 'Canonical typed taxon property values.';
    COMMENT ON COLUMN submission_feature_property_taxon.submission_feature_property_taxon_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_feature_property_taxon.submission_feature_id IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN submission_feature_property_taxon.feature_type_property_id IS 'Foreign key to the feature_type_property table.';
    COMMENT ON COLUMN submission_feature_property_taxon.taxon_id IS 'Foreign key to the taxon table.';
    COMMENT ON COLUMN submission_feature_property_taxon.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_property_taxon.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_property_taxon.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN submission_feature_property_taxon.update_user IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_property_taxon.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE submission_feature_property_geometry IS 'Canonical typed geometry property values.';
    COMMENT ON COLUMN submission_feature_property_geometry.submission_feature_property_geometry_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_feature_property_geometry.submission_feature_id IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN submission_feature_property_geometry.feature_type_property_id IS 'Foreign key to the feature_type_property table.';
    COMMENT ON COLUMN submission_feature_property_geometry.value IS 'The geometry property value.';
    COMMENT ON COLUMN submission_feature_property_geometry.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_property_geometry.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_property_geometry.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN submission_feature_property_geometry.update_user IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_property_geometry.revision_count IS 'Revision count used for concurrency control.';

    ----------------------------------------------------------------------------------------
    -- Create audit and journal triggers
    ----------------------------------------------------------------------------------------

    CREATE TRIGGER audit_submission_feature_property_string
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature_property_string
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_submission_feature_property_string
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_property_string
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    CREATE TRIGGER audit_submission_feature_property_number
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature_property_number
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_submission_feature_property_number
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_property_number
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    CREATE TRIGGER audit_submission_feature_property_boolean
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature_property_boolean
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_submission_feature_property_boolean
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_property_boolean
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    CREATE TRIGGER audit_submission_feature_property_timestamp
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature_property_timestamp
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_submission_feature_property_timestamp
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_property_timestamp
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    CREATE TRIGGER audit_submission_feature_property_code
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature_property_code
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_submission_feature_property_code
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_property_code
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    CREATE TRIGGER audit_submission_feature_property_taxon
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature_property_taxon
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_submission_feature_property_taxon
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_property_taxon
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    CREATE TRIGGER audit_submission_feature_property_geometry
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature_property_geometry
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_submission_feature_property_geometry
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_property_geometry
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS journal_submission_feature_property_geometry ON submission_feature_property_geometry;
    DROP TRIGGER IF EXISTS audit_submission_feature_property_geometry ON submission_feature_property_geometry;
    DROP TRIGGER IF EXISTS journal_submission_feature_property_taxon ON submission_feature_property_taxon;
    DROP TRIGGER IF EXISTS audit_submission_feature_property_taxon ON submission_feature_property_taxon;
    DROP TRIGGER IF EXISTS journal_submission_feature_property_code ON submission_feature_property_code;
    DROP TRIGGER IF EXISTS audit_submission_feature_property_code ON submission_feature_property_code;
    DROP TRIGGER IF EXISTS journal_submission_feature_property_timestamp ON submission_feature_property_timestamp;
    DROP TRIGGER IF EXISTS audit_submission_feature_property_timestamp ON submission_feature_property_timestamp;
    DROP TRIGGER IF EXISTS journal_submission_feature_property_boolean ON submission_feature_property_boolean;
    DROP TRIGGER IF EXISTS audit_submission_feature_property_boolean ON submission_feature_property_boolean;
    DROP TRIGGER IF EXISTS journal_submission_feature_property_number ON submission_feature_property_number;
    DROP TRIGGER IF EXISTS audit_submission_feature_property_number ON submission_feature_property_number;
    DROP TRIGGER IF EXISTS journal_submission_feature_property_string ON submission_feature_property_string;
    DROP TRIGGER IF EXISTS audit_submission_feature_property_string ON submission_feature_property_string;

    DROP TABLE IF EXISTS submission_feature_property_geometry;
    DROP TABLE IF EXISTS submission_feature_property_taxon;
    DROP TABLE IF EXISTS submission_feature_property_code;
    DROP TABLE IF EXISTS submission_feature_property_timestamp;
    DROP TABLE IF EXISTS submission_feature_property_boolean;
    DROP TABLE IF EXISTS submission_feature_property_number;
    DROP TABLE IF EXISTS submission_feature_property_string;
  `);
}
