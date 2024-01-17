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
  await knex.raw(`--sql
    ----------------------------------------------------------------------------------------
    -- Create table
    ----------------------------------------------------------------------------------------
    set search_path=biohub,public;

    CREATE TABLE region_lookup (
      region_id       integer                     GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      region_name     varchar(300)                NOT NULL,
      org_unit        varchar(10)                 NOT NULL,
      org_unit_name   varchar(300)                NOT NULL,
      feature_code    varchar(50),
      feature_name    varchar(50),
      object_id       integer                     NOT NULL,
      geojson         jsonb                       NOT NULL,
      geometry        geometry(geometry, 3005),
      geography       geography(geometry, 4326),
      create_date     timestamptz(6)              DEFAULT now() NOT NULL,
      create_user     integer                     NOT NULL,
      update_date     timestamptz(6),
      update_user     integer,
      revision_count  integer                     DEFAULT 0 NOT NULL,
      CONSTRAINT region_lookup_pk PRIMARY KEY (region_id)
    );
    
    COMMENT ON COLUMN region_lookup.region_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN region_lookup.region_name IS 'Name given to region.';
    COMMENT ON COLUMN region_lookup.org_unit IS 'Organization unit code.';
    COMMENT ON COLUMN region_lookup.org_unit_name IS 'Organization unit name.';
    COMMENT ON COLUMN region_lookup.feature_code IS 'Feature code.';
    COMMENT ON COLUMN region_lookup.feature_name IS 'Feature name.';
    COMMENT ON COLUMN region_lookup.object_id IS 'Object ID from gov.';
    COMMENT ON COLUMN region_lookup.geojson IS 'A JSON representation of the project boundary geometry that provides necessary details for shape manipulation in client side tools.';
    COMMENT ON COLUMN region_lookup.geometry IS 'The containing geometry of the record.';
    COMMENT ON COLUMN region_lookup.geography IS 'The containing geography of the record.';
    COMMENT ON COLUMN region_lookup.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN region_lookup.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN region_lookup.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN region_lookup.update_user IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN region_lookup.revision_count IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE region_lookup IS 'Lookup table for regions.';

    CREATE TABLE submission_regions (
      submission_id   integer             NOT NULL,
      region_id       integer             NOT NULL,
      create_date     timestamptz(6)      DEFAULT now() NOT NULL,
      create_user     integer             NOT NULL,
      update_date     timestamptz(6),
      update_user     integer,
      revision_count  integer             DEFAULT 0 NOT NULL,
      CONSTRAINT submission_region_pk PRIMARY KEY (submission_id, region_id)
    );

    COMMENT ON COLUMN submission_regions.submission_id IS 'A Foreign key that points to submissions.';
    COMMENT ON COLUMN submission_regions.region_id IS 'A foreign key that points to regions to associate to submissions.';
    COMMENT ON COLUMN submission_regions.create_date IS 'The date time the record was created.';
    COMMENT ON COLUMN submission_regions.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN submission_regions.update_date IS 'The date time the record was updated.';
    COMMENT ON COLUMN submission_regions.update_user IS 'The id of the user who updated the record.';
    COMMENT ON COLUMN submission_regions.revision_count IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE submission_regions IS 'A join table for submissions and regions.';

    ----------------------------------------------------------------------------------------
    -- Create table indexes and constraints
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_regions ADD CONSTRAINT submission_regions_fk1 FOREIGN KEY (submission_id) REFERENCES submission(submission_id);
    ALTER TABLE submission_regions ADD CONSTRAINT submission_regions_fk2 FOREIGN KEY (region_id) REFERENCES region_lookup(region_id);

    CREATE INDEX submission_regions_fk1 ON submission_regions(submission_id);
    CREATE INDEX submission_regions_fk2 ON submission_regions(region_id);

    ----------------------------------------------------------------------------------------
    -- Create table triggers
    ----------------------------------------------------------------------------------------
    create trigger audit_region_lookup before insert or update or delete on region_lookup for each row execute procedure tr_audit_trigger();
    create trigger journal_region_lookup after insert or update or delete on region_lookup for each row execute procedure tr_journal_trigger();

    create trigger audit_submission_regions before insert or update or delete on submission_regions for each row execute procedure tr_audit_trigger();
    create trigger journal_submission_regions after insert or update or delete on submission_regions for each row execute procedure tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
