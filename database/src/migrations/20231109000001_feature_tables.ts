import { Knex } from 'knex';

/**
 * Add tables:
 * - submission_feature
 * - feature_type
 * - feature_type_property
 * - feature_property
 * - feature_property_type
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

    CREATE TABLE submission_feature(
      submission_feature_id          integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_id                  integer           NOT NULL,
      feature_type_id                integer           NOT NULL,
      data                           jsonb             NOT NULL,
      parent_submission_feature_id   integer,
      record_effective_date          date              DEFAULT now() NOT NULL,
      record_end_date                date,
      create_date                    timestamptz(6)    DEFAULT now() NOT NULL,
      create_user                    integer           NOT NULL,
      update_date                    timestamptz(6),
      update_user                    integer,
      revision_count                 integer           DEFAULT 0 NOT NULL,
      CONSTRAINT submission_feature_pk PRIMARY KEY (submission_feature_id)
    );

    COMMENT ON COLUMN submission_feature.submission_feature_id           IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_feature.submission_id                   IS 'Foreign key to the submission table.';
    COMMENT ON COLUMN submission_feature.feature_type_id                 IS 'Foreign key to the feature_type table.';
    COMMENT ON COLUMN submission_feature.data                            IS 'The json data of the submission_feature record.';
    COMMENT ON COLUMN submission_feature.parent_submission_feature_id    IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN submission_feature.record_effective_date           IS 'Record level effective date.';
    COMMENT ON COLUMN submission_feature.record_end_date                 IS 'Record level end date.';
    COMMENT ON COLUMN submission_feature.create_date                     IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature.create_user                     IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature.update_date                     IS 'The datetime the record was updated.';
    COMMENT ON COLUMN submission_feature.update_user                     IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature.revision_count                  IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  submission_feature                                 IS 'A set of data for a specific feature of a submission.';

    ----------------------------------------------------------------------------------------

    CREATE TABLE feature_type(
      feature_type_id          integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      name                     varchar(100)      NOT NULL,
      display_name             varchar(100)      NOT NULL,
      description              varchar(500),
      sort                     integer,
      record_effective_date    date              DEFAULT now() NOT NULL,
      record_end_date          date,
      create_date              timestamptz(6)    DEFAULT now() NOT NULL,
      create_user              integer           NOT NULL,
      update_date              timestamptz(6),
      update_user              integer,
      revision_count           integer           DEFAULT 0 NOT NULL,
      CONSTRAINT feature_type_pk PRIMARY KEY (feature_type_id)
    );

    COMMENT ON COLUMN feature_type.feature_type_id          IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN feature_type.name                     IS 'The name of the feature_type record.';
    COMMENT ON COLUMN feature_type.display_name             IS 'The formatted name of the feature_type record.';
    COMMENT ON COLUMN feature_type.description              IS 'The description of the feature_type record.';
    COMMENT ON COLUMN feature_type.sort                     IS 'Used to provide a custom sort order to the records.';
    COMMENT ON COLUMN feature_type.record_effective_date    IS 'Record level effective date.';
    COMMENT ON COLUMN feature_type.record_end_date          IS 'Record level end date.';
    COMMENT ON COLUMN feature_type.create_date              IS 'The datetime the record was created.';
    COMMENT ON COLUMN feature_type.create_user              IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN feature_type.update_date              IS 'The datetime the record was updated.';
    COMMENT ON COLUMN feature_type.update_user              IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN feature_type.revision_count           IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  feature_type                          IS 'Defines feature types.';

    ----------------------------------------------------------------------------------------

    CREATE TABLE feature_type_property(
      feature_type_property_id           integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      feature_type_id                    integer           NOT NULL,
      feature_property_id                integer           NOT NULL,
      sort                               integer,
      record_effective_date              date              DEFAULT now() NOT NULL,
      record_end_date                    date,
      create_date                        timestamptz(6)    DEFAULT now() NOT NULL,
      create_user                        integer           NOT NULL,
      update_date                        timestamptz(6),
      update_user                        integer,
      revision_count                     integer           DEFAULT 0 NOT NULL,
      CONSTRAINT feature_type_property_pk PRIMARY KEY (feature_type_property_id)
    );

    COMMENT ON COLUMN feature_type_property.feature_type_property_id    IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN feature_type_property.feature_type_id             IS 'Foreign key to the feature_type table.';
    COMMENT ON COLUMN feature_type_property.feature_property_id         IS 'Foreign key to the feature_property table.';
    COMMENT ON COLUMN feature_type_property.sort                        IS 'Used to provide a custom sort order to the records.';
    COMMENT ON COLUMN feature_type_property.record_effective_date       IS 'Record level effective date.';
    COMMENT ON COLUMN feature_type_property.record_end_date             IS 'Record level end date.';
    COMMENT ON COLUMN feature_type_property.create_date                 IS 'The datetime the record was created.';
    COMMENT ON COLUMN feature_type_property.create_user                 IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN feature_type_property.update_date                 IS 'The datetime the record was updated.';
    COMMENT ON COLUMN feature_type_property.update_user                 IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN feature_type_property.revision_count              IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  feature_type_property                             IS 'A join table on feature type and feature_property. Defines which properties can be used by a given feature type.';

    ----------------------------------------------------------------------------------------

    CREATE TABLE feature_property(
      feature_property_id           integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      feature_property_type_id      integer           NOT NULL,
      name                          varchar(100)      NOT NULL,
      display_name                  varchar(100)      NOT NULL,
      description                   varchar(500),
      parent_feature_property_id    integer,
      record_effective_date         date              DEFAULT now() NOT NULL,
      record_end_date               date,
      create_date                   timestamptz(6)    DEFAULT now() NOT NULL,
      create_user                   integer           NOT NULL,
      update_date                   timestamptz(6),
      update_user                   integer,
      revision_count                integer           DEFAULT 0 NOT NULL,
      CONSTRAINT feature_property_pk PRIMARY KEY (feature_property_id)
    );

    COMMENT ON COLUMN feature_property.feature_property_id           IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN feature_property.feature_property_type_id      IS 'Foreign key to the feature_property_type table.';
    COMMENT ON COLUMN feature_property.name                          IS 'The name of the feature_property record.';
    COMMENT ON COLUMN feature_property.display_name                  IS 'The formatted name of the feature_property record.';
    COMMENT ON COLUMN feature_property.description                   IS 'The description of the feature_property record.';
    COMMENT ON COLUMN feature_property.parent_feature_property_id    IS 'Foreign key to the feature_property table.';
    COMMENT ON COLUMN feature_property.record_effective_date         IS 'Record level effective date.';
    COMMENT ON COLUMN feature_property.record_end_date               IS 'Record level end date.';
    COMMENT ON COLUMN feature_property.create_date                   IS 'The datetime the record was created.';
    COMMENT ON COLUMN feature_property.create_user                   IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN feature_property.update_date                   IS 'The datetime the record was updated.';
    COMMENT ON COLUMN feature_property.update_user                   IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN feature_property.revision_count                IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  feature_property                               IS 'Defines supported feature data properties.';

    ----------------------------------------------------------------------------------------

    CREATE TABLE feature_property_type(
      feature_property_type_id   integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      name                       varchar(100)      NOT NULL,
      description                varchar(500),
      record_effective_date      date              DEFAULT now() NOT NULL,
      record_end_date            date,
      create_date                timestamptz(6)    DEFAULT now() NOT NULL,
      create_user                integer           NOT NULL,
      update_date                timestamptz(6),
      update_user                integer,
      revision_count             integer           DEFAULT 0 NOT NULL,
      CONSTRAINT feature_property_type_pk PRIMARY KEY (feature_property_type_id)
    );

    COMMENT ON COLUMN feature_property_type.feature_property_type_id   IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN feature_property_type.name                       IS 'The name of the feature_property_type record.';
    COMMENT ON COLUMN feature_property_type.description                IS 'The description of the feature_property_type record.';
    COMMENT ON COLUMN feature_property_type.record_effective_date      IS 'Record level effective date.';
    COMMENT ON COLUMN feature_property_type.record_end_date            IS 'Record level end date.';
    COMMENT ON COLUMN feature_property_type.create_date                IS 'The datetime the record was created.';
    COMMENT ON COLUMN feature_property_type.create_user                IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN feature_property_type.update_date                IS 'The datetime the record was updated.';
    COMMENT ON COLUMN feature_property_type.update_user                IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN feature_property_type.revision_count             IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  feature_property_type                            IS 'Defines supported feature data property types.';

    ----------------------------------------------------------------------------------------
    -- Create Indexes and Constraints for table: submission_feature
    ----------------------------------------------------------------------------------------

    -- Add foreign key constraint
    ALTER TABLE submission_feature ADD CONSTRAINT submission_feature_fk1
      FOREIGN KEY (submission_id)
      REFERENCES submission(submission_id);

    ALTER TABLE submission_feature ADD CONSTRAINT submission_feature_fk2
      FOREIGN KEY (feature_type_id)
      REFERENCES feature_type(feature_type_id);

    ALTER TABLE submission_feature ADD CONSTRAINT submission_feature_fk3
      FOREIGN KEY (parent_submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    -- add indexes for foreign keys
    CREATE INDEX submission_feature_idx1 ON submission_feature(submission_id);

    CREATE INDEX submission_feature_idx2 ON submission_feature(feature_type_id);

    CREATE INDEX submission_feature_idx3 ON submission_feature(submission_feature_id);

    ----------------------------------------------------------------------------------------
    -- Create Indexes and Constraints for table: feature_type
    ----------------------------------------------------------------------------------------

    -- Add unique end-date key constraint (don't allow 2 records with the same name and a NULL record_end_date)
    CREATE UNIQUE INDEX feature_type_nuk1 ON feature_type(name, (record_end_date is NULL)) where record_end_date is null;

    ----------------------------------------------------------------------------------------
    -- Create Indexes and Constraints for table: feature_type_property
    ----------------------------------------------------------------------------------------

    -- Add unique end-date key constraint (don't allow 2 records with the same feature_type_id, feature_property_id, and a NULL record_end_date)
    CREATE UNIQUE INDEX feature_type_property_nuk1 ON feature_type_property(feature_type_id, feature_property_id, (record_end_date is NULL)) where record_end_date is null;

    -- Add foreign key constraint
    ALTER TABLE feature_type_property ADD CONSTRAINT feature_type_property_fk1
      FOREIGN KEY (feature_type_id)
      REFERENCES feature_type(feature_type_id);

    ALTER TABLE feature_type_property ADD CONSTRAINT feature_type_property_fk2
      FOREIGN KEY (feature_property_id)
      REFERENCES feature_property(feature_property_id);

    -- add indexes for foreign keys
    CREATE INDEX feature_type_property_idx1 ON feature_type_property(feature_type_id);

    CREATE INDEX feature_type_property_idx2 ON feature_type_property(feature_property_id);

    ----------------------------------------------------------------------------------------
    -- Create Indexes and Constraints for table: feature_property
    ----------------------------------------------------------------------------------------

    -- Add unique end-date key constraint (don't allow 2 records with the same name and a NULL record_end_date)
    CREATE UNIQUE INDEX feature_property_nuk1 ON feature_property(name, (record_end_date is NULL)) where record_end_date is null;

    -- Add foreign key constraint
    ALTER TABLE feature_property ADD CONSTRAINT feature_property_fk1
      FOREIGN KEY (feature_property_type_id)
      REFERENCES feature_property_type(feature_property_type_id);

    -- add indexes for foreign keys
    CREATE INDEX feature_property_idx1 ON feature_property(feature_property_type_id);

    ----------------------------------------------------------------------------------------
    -- Create Indexes and Constraints for table: feature_property_type
    ----------------------------------------------------------------------------------------

    -- Add unique end-date key constraint (don't allow 2 records with the same name and a NULL record_end_date)
    CREATE UNIQUE INDEX feature_property_type_nuk1 ON feature_property_type(name, (record_end_date is NULL)) where record_end_date is null;

    ----------------------------------------------------------------------------------------
    -- Create audit and journal triggers
    ----------------------------------------------------------------------------------------

    create trigger audit_submission_feature before insert or update or delete on submission_feature for each row execute procedure tr_audit_trigger();
    create trigger journal_submission_feature after insert or update or delete on submission_feature for each row execute procedure tr_journal_trigger();

    create trigger audit_feature_type before insert or update or delete on feature_type for each row execute procedure tr_audit_trigger();
    create trigger journal_feature_type after insert or update or delete on feature_type for each row execute procedure tr_journal_trigger();

    create trigger audit_feature_type_property before insert or update or delete on feature_type_property for each row execute procedure tr_audit_trigger();
    create trigger journal_feature_type_property after insert or update or delete on feature_type_property for each row execute procedure tr_journal_trigger();

    create trigger audit_feature_property before insert or update or delete on feature_property for each row execute procedure tr_audit_trigger();
    create trigger journal_feature_property after insert or update or delete on feature_property for each row execute procedure tr_journal_trigger();

    create trigger audit_feature_property_type before insert or update or delete on feature_property_type for each row execute procedure tr_audit_trigger();
    create trigger journal_feature_property_type after insert or update or delete on feature_property_type for each row execute procedure tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
