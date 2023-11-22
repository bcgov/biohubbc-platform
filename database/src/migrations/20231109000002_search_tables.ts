import { Knex } from 'knex';

/**
 * Add tables:
 * - search_string
 * - search_string
 * - search_number
 * - search_datetime
 * - search_spatial
 * - search_taxonomy
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ----------------------------------------------------------------------------------------
    -- Create tables
    ----------------------------------------------------------------------------------------
    set search_path=biohub,public;

    CREATE TABLE search_string(
      search_string_id         integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id    integer           NOT NULL,
      feature_property_id      integer           NOT NULL,
      value                    varchar(250)      NOT NULL,
      create_date              timestamptz(6)    DEFAULT now() NOT NULL,
      create_user              integer           NOT NULL,
      update_date              timestamptz(6),
      update_user              integer,
      revision_count           integer           DEFAULT 0 NOT NULL,
      CONSTRAINT search_string_pk PRIMARY KEY (search_string_id)
    );

    COMMENT ON COLUMN search_string.search_string_id       IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN search_string.submission_feature_id  IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN search_string.feature_property_id    IS 'Foreign key to the feature_property table.';
    COMMENT ON COLUMN search_string.value                  IS 'The search value of the record.';
    COMMENT ON COLUMN search_string.create_date            IS 'The datetime the record was created.';
    COMMENT ON COLUMN search_string.create_user            IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN search_string.update_date            IS 'The datetime the record was updated.';
    COMMENT ON COLUMN search_string.update_user            IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN search_string.revision_count         IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  search_string                        IS 'String search values';

    ----------------------------------------------------------------------------------------

    CREATE TABLE search_number(
      search_number_id         integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id    integer           NOT NULL,
      feature_property_id      integer           NOT NULL,
      value                    numeric           NOT NULL,
      create_date              timestamptz(6)    DEFAULT now() NOT NULL,
      create_user              integer           NOT NULL,
      update_date              timestamptz(6),
      update_user              integer,
      revision_count           integer           DEFAULT 0 NOT NULL,
      CONSTRAINT search_number_pk PRIMARY KEY (search_number_id)
    );

    COMMENT ON COLUMN search_number.search_number_id       IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN search_number.submission_feature_id  IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN search_number.feature_property_id    IS 'Foreign key to the feature_property table.';
    COMMENT ON COLUMN search_number.value                  IS 'The search value of the record.';
    COMMENT ON COLUMN search_number.create_date            IS 'The datetime the record was created.';
    COMMENT ON COLUMN search_number.create_user            IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN search_number.update_date            IS 'The datetime the record was updated.';
    COMMENT ON COLUMN search_number.update_user            IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN search_number.revision_count         IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  search_number                        IS 'Number search values';

    ----------------------------------------------------------------------------------------

    CREATE TABLE search_datetime(
      search_datetime_id       integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id    integer           NOT NULL,
      feature_property_id      integer           NOT NULL,
      value                    timestamptz(6)    NOT NULL,
      create_date              timestamptz(6)    DEFAULT now() NOT NULL,
      create_user              integer           NOT NULL,
      update_date              timestamptz(6),
      update_user              integer,
      revision_count           integer           DEFAULT 0 NOT NULL,
      CONSTRAINT search_datetime_pk PRIMARY KEY (search_datetime_id)
    );

    COMMENT ON COLUMN search_datetime.search_datetime_id     IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN search_datetime.submission_feature_id  IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN search_datetime.feature_property_id    IS 'Foreign key to the feature_property table.';
    COMMENT ON COLUMN search_datetime.value                  IS 'The search value of the record.';
    COMMENT ON COLUMN search_datetime.create_date            IS 'The datetime the record was created.';
    COMMENT ON COLUMN search_datetime.create_user            IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN search_datetime.update_date            IS 'The datetime the record was updated.';
    COMMENT ON COLUMN search_datetime.update_user            IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN search_datetime.revision_count         IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  search_datetime                        IS 'Datetime search values';

    ----------------------------------------------------------------------------------------

    CREATE TABLE search_spatial(
      search_spatial_id        integer                    GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id    integer                    NOT NULL,
      feature_property_id      integer                    NOT NULL,
      value                    geometry                   NOT NULL,
      create_date              timestamptz(6)             DEFAULT now() NOT NULL,
      create_user              integer                    NOT NULL,
      update_date              timestamptz(6),
      update_user              integer,
      revision_count           integer                    DEFAULT 0 NOT NULL,
      CONSTRAINT search_spatial_pk PRIMARY KEY (search_spatial_id)
    );

    COMMENT ON COLUMN search_spatial.search_spatial_id      IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN search_spatial.submission_feature_id  IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN search_spatial.feature_property_id    IS 'Foreign key to the feature_property table.';
    COMMENT ON COLUMN search_spatial.value                  IS 'The search value of the record.';
    COMMENT ON COLUMN search_spatial.create_date            IS 'The spatial the record was created.';
    COMMENT ON COLUMN search_spatial.create_user            IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN search_spatial.update_date            IS 'The spatial the record was updated.';
    COMMENT ON COLUMN search_spatial.update_user            IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN search_spatial.revision_count         IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  search_spatial                        IS 'Spatial search values';

    ----------------------------------------------------------------------------------------

    CREATE TABLE search_taxonomy(
      search_taxonomy_id       integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id    integer           NOT NULL,
      feature_property_id      integer           NOT NULL,
      value                    numeric           NOT NULL,
      create_date              timestamptz(6)    DEFAULT now() NOT NULL,
      create_user              integer           NOT NULL,
      update_date              timestamptz(6),
      update_user              integer,
      revision_count           integer           DEFAULT 0 NOT NULL,
      CONSTRAINT search_taxonomy_pk PRIMARY KEY (search_taxonomy_id)
    );

    COMMENT ON COLUMN search_taxonomy.search_taxonomy_id     IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN search_taxonomy.submission_feature_id  IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN search_taxonomy.feature_property_id    IS 'Foreign key to the feature_property table.';
    COMMENT ON COLUMN search_taxonomy.value                  IS 'The search value of the record.';
    COMMENT ON COLUMN search_taxonomy.create_date            IS 'The taxonomy the record was created.';
    COMMENT ON COLUMN search_taxonomy.create_user            IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN search_taxonomy.update_date            IS 'The taxonomy the record was updated.';
    COMMENT ON COLUMN search_taxonomy.update_user            IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN search_taxonomy.revision_count         IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  search_taxonomy                        IS 'Taxonomy search values';

    ----------------------------------------------------------------------------------------
    -- Create Indexes and Constraints for table: search_string
    ----------------------------------------------------------------------------------------

    -- Add foreign key constraint
    ALTER TABLE search_string ADD CONSTRAINT search_string_fk1
      FOREIGN KEY (submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    ALTER TABLE search_string ADD CONSTRAINT search_string_fk2
      FOREIGN KEY (feature_property_id)
      REFERENCES feature_property(feature_property_id);

    -- add indexes for foreign keys
    CREATE INDEX search_string_idx1 ON search_string(submission_feature_id);

    CREATE INDEX search_string_idx2 ON search_string(feature_property_id);

    CREATE INDEX search_string_idx3 ON search_string(value);

    ----------------------------------------------------------------------------------------
    -- Create Indexes and Constraints for table: search_number
    ----------------------------------------------------------------------------------------

    -- Add foreign key constraint
    ALTER TABLE search_number ADD CONSTRAINT search_number_fk1
      FOREIGN KEY (submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    ALTER TABLE search_number ADD CONSTRAINT search_number_fk2
      FOREIGN KEY (feature_property_id)
      REFERENCES feature_property(feature_property_id);

    -- add indexes for foreign keys
    CREATE INDEX search_number_idx1 ON search_number(submission_feature_id);

    CREATE INDEX search_number_idx2 ON search_number(feature_property_id);

    CREATE INDEX search_number_idx3 ON search_number(value);

    ----------------------------------------------------------------------------------------
    -- Create Indexes and Constraints for table: search_datetime
    ----------------------------------------------------------------------------------------

    -- Add foreign key constraint
    ALTER TABLE search_datetime ADD CONSTRAINT search_datetime_fk1
      FOREIGN KEY (submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    ALTER TABLE search_datetime ADD CONSTRAINT search_datetime_fk2
      FOREIGN KEY (feature_property_id)
      REFERENCES feature_property(feature_property_id);

    -- add indexes for foreign keys
    CREATE INDEX search_datetime_idx1 ON search_datetime(submission_feature_id);

    CREATE INDEX search_datetime_idx2 ON search_datetime(feature_property_id);

    CREATE INDEX search_datetime_idx3 ON search_datetime(value);

    ----------------------------------------------------------------------------------------
    -- Create Indexes and Constraints for table: search_spatial
    ----------------------------------------------------------------------------------------

    -- Add foreign key constraint
    ALTER TABLE search_spatial ADD CONSTRAINT search_spatial_fk1
      FOREIGN KEY (submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    ALTER TABLE search_spatial ADD CONSTRAINT search_spatial_fk2
      FOREIGN KEY (feature_property_id)
      REFERENCES feature_property(feature_property_id);

    -- add indexes for foreign keys
    CREATE INDEX search_spatial_idx1 ON search_spatial(submission_feature_id);

    CREATE INDEX search_spatial_idx2 ON search_spatial(feature_property_id);

    -- add spatial index
    CREATE INDEX search_spatial_idx3 ON search_spatial using GIST(value);

    ----------------------------------------------------------------------------------------
    -- Create Indexes and Constraints for table: search_taxonomy
    ----------------------------------------------------------------------------------------

    -- Add foreign key constraint
    ALTER TABLE search_taxonomy ADD CONSTRAINT search_taxonomy_fk1
      FOREIGN KEY (submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    ALTER TABLE search_taxonomy ADD CONSTRAINT search_taxonomy_fk2
      FOREIGN KEY (feature_property_id)
      REFERENCES feature_property(feature_property_id);

    -- add indexes for foreign keys
    CREATE INDEX search_taxonomy_idx1 ON search_taxonomy(submission_feature_id);

    CREATE INDEX search_taxonomy_idx2 ON search_taxonomy(feature_property_id);

    CREATE INDEX search_taxonomy_idx3 ON search_taxonomy(value);

    ----------------------------------------------------------------------------------------
    -- Create audit and journal triggers
    ----------------------------------------------------------------------------------------

    create trigger audit_search_string before insert or update or delete on search_string for each row execute procedure tr_audit_trigger();
    create trigger journal_search_string after insert or update or delete on search_string for each row execute procedure tr_journal_trigger();

    create trigger audit_search_number before insert or update or delete on search_number for each row execute procedure tr_audit_trigger();
    create trigger journal_search_number after insert or update or delete on search_number for each row execute procedure tr_journal_trigger();

    create trigger audit_search_datetime before insert or update or delete on search_datetime for each row execute procedure tr_audit_trigger();
    create trigger journal_search_datetime after insert or update or delete on search_datetime for each row execute procedure tr_journal_trigger();

    create trigger audit_search_spatial before insert or update or delete on search_spatial for each row execute procedure tr_audit_trigger();
    create trigger journal_search_spatial after insert or update or delete on search_spatial for each row execute procedure tr_journal_trigger();

    create trigger audit_search_taxonomy before insert or update or delete on search_taxonomy for each row execute procedure tr_audit_trigger();
    create trigger journal_search_taxonomy after insert or update or delete on search_taxonomy for each row execute procedure tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
