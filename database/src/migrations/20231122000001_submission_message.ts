import { Knex } from 'knex';

/**
 * Add tables:
 * - submission_message
 * - submission_message_type
 *
 * Populate tables:
 * - submission_message_type
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
  
    CREATE TABLE submission_message(
      submission_message_id         integer            GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_message_type_id    integer            NOT NULL,
      submission_id                 integer            NOT NULL,
      label                         varchar(250)       NOT NULL,
      message                       varchar(500)       NOT NULL,
      data                          jsonb,
      create_date                   timestamptz(6)     DEFAULT now() NOT NULL,
      create_user                   integer            NOT NULL,
      update_date                   timestamptz(6),
      update_user                   integer,
      revision_count                integer            DEFAULT 0 NOT NULL,
      CONSTRAINT submission_message_pk PRIMARY KEY (submission_message_id)
    );
  
    COMMENT ON COLUMN submission_message.submission_message_id         IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_message.submission_message_type_id    IS 'Foreign key to the submission_message_type table.';
    COMMENT ON COLUMN submission_message.submission_id                 IS 'Foreign key to the submission table.';
    COMMENT ON COLUMN submission_message.label                         IS 'The message label.';
    COMMENT ON COLUMN submission_message.message                       IS 'The message text.';
    COMMENT ON COLUMN submission_message.data                          IS 'The message data.';
    COMMENT ON COLUMN submission_message.create_date                   IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_message.create_user                   IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN submission_message.update_date                   IS 'The datetime the record was updated.';
    COMMENT ON COLUMN submission_message.update_user                   IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN submission_message.revision_count                IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  submission_message                               IS 'Messages about the submission.';

    ----------------------------------------------------------------------------------------

    CREATE TABLE submission_message_type(
      submission_message_type_id    integer            GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      name                          varchar(50)        NOT NULL,
      description                   varchar(50)        NOT NULL,
      create_date                   timestamptz(6)     DEFAULT now() NOT NULL,
      create_user                   integer            NOT NULL,
      update_date                   timestamptz(6),
      update_user                   integer,
      revision_count                integer            DEFAULT 0 NOT NULL,
      CONSTRAINT submission_message_type_pk PRIMARY KEY (submission_message_type_id)
    );

    COMMENT ON COLUMN submission_message_type.submission_message_type_id    IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_message_type.name                          IS 'The name of the submission_message_type record.';
    COMMENT ON COLUMN submission_message_type.description                   IS 'The description of the submission_message_type record.';
    COMMENT ON COLUMN submission_message_type.create_date                   IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_message_type.create_user                   IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN submission_message_type.update_date                   IS 'The datetime the record was updated.';
    COMMENT ON COLUMN submission_message_type.update_user                   IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN submission_message_type.revision_count                IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  submission_message_type                               IS 'Submission message types.';

    ----------------------------------------------------------------------------------------
    -- Create Indexes and Constraints for table: submission_message
    ----------------------------------------------------------------------------------------

    -- Add foreign key constraint
    ALTER TABLE submission_message ADD CONSTRAINT submission_message_fk1
      FOREIGN KEY (submission_id)
      REFERENCES submission(submission_id);

    -- Add foreign key constraint
    ALTER TABLE submission_message ADD CONSTRAINT submission_message_fk2
      FOREIGN KEY (submission_message_type_id)
      REFERENCES submission_message_type(submission_message_type_id);

    -- add indexes for foreign keys
    CREATE INDEX submission_message_idx1 ON submission_message(submission_id);  

    -- add indexes for foreign keys
    CREATE INDEX submission_message_idx2 ON submission_message(submission_message_type_id);

    ----------------------------------------------------------------------------------------
    -- Create audit and journal triggers
    ----------------------------------------------------------------------------------------

    create trigger audit_submission_message before insert or update or delete on submission_message for each row execute procedure tr_audit_trigger();
    create trigger journal_submission_message after insert or update or delete on submission_message for each row execute procedure tr_journal_trigger();

    create trigger audit_submission_message_type before insert or update or delete on submission_message_type for each row execute procedure tr_audit_trigger();
    create trigger journal_submission_message_type after insert or update or delete on submission_message_type for each row execute procedure tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- Populate lookup tables
    ----------------------------------------------------------------------------------------

    -- populate submission_message_type table
    insert into submission_message_type (name, description) values ('info',  'An informational message.');
    insert into submission_message_type (name, description) values ('warn',  'A warning message.');
    insert into submission_message_type (name, description) values ('error', 'An error message.');
    insert into submission_message_type (name, description) values ('debug', 'A debug message.');
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
