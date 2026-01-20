import { Knex } from 'knex';

/**
 * Creates tables to support contributor systems.
 *
 * Tables:
 * - contributor
 * - contributor_system_user
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub;

    ---------------------------------------------------
    -- Contributor table for tracking contributing systems (eg. SIMS)
    ---------------------------------------------------

    CREATE TABLE contributor (
      contributor_id      integer         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      client_id           varchar(100)    NOT NULL,
      description         varchar(1000),
      record_end_date     timestamptz(6),
      create_date         timestamptz(6)  DEFAULT now() NOT NULL,
      create_user         integer         NOT NULL,
      update_date         timestamptz(6),
      update_user         integer,
      revision_count      integer         DEFAULT 0 NOT NULL
    );

    CREATE UNIQUE INDEX contributor_uk 
      ON contributor (client_id, (record_end_date IS NULL)) 
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE contributor IS 'A system, organization, or source that contributes data to this system.';
    COMMENT ON COLUMN contributor.contributor_id IS 'System-generated primary key.';
    COMMENT ON COLUMN contributor.client_id IS 'The Keycloak client_id of the contributing system or organization.';
    COMMENT ON COLUMN contributor.description IS 'Description of the contributor.';
    COMMENT ON COLUMN contributor.record_end_date IS 'The date the record was soft-deleted or expired.';
    COMMENT ON COLUMN contributor.create_date IS 'Timestamp when the record was created.';
    COMMENT ON COLUMN contributor.create_user IS 'ID of the user who created the record.';
    COMMENT ON COLUMN contributor.update_date IS 'Timestamp when the record was last updated.';
    COMMENT ON COLUMN contributor.update_user IS 'ID of the user who last updated the record.';
    COMMENT ON COLUMN contributor.revision_count IS 'Concurrency control field.';

    ---------------------------------------------------
    -- Table joining service accounts to their respective contributor systems
    ---------------------------------------------------

    CREATE TABLE contributor_system_user (
      contributor_system_user_id  integer         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      contributor_id              integer         NOT NULL,
      system_user_id              integer         NOT NULL,
      record_end_date             timestamptz(6),
      create_date                 timestamptz(6)  DEFAULT now() NOT NULL,
      create_user                 integer         NOT NULL,
      update_date                 timestamptz(6),
      update_user                 integer,
      revision_count              integer         DEFAULT 0 NOT NULL,

      CONSTRAINT fk_contributor FOREIGN KEY (contributor_id) REFERENCES contributor(contributor_id),
      CONSTRAINT fk_system_user FOREIGN KEY (system_user_id) REFERENCES "system_user"(system_user_id)
    );

    CREATE INDEX contributor_system_user_contributor_id_idx ON contributor_system_user (contributor_id);
    CREATE INDEX contributor_system_user_system_user_id_idx ON contributor_system_user (system_user_id);

    CREATE UNIQUE INDEX contributor_system_uk1 
      ON contributor_system_user (contributor_id, system_user_id, (record_end_date IS NULL)) 
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE contributor_system_user IS 'Join table associating system users (service accounts) to their respective contributor system.';
    COMMENT ON COLUMN contributor_system_user.contributor_system_user_id IS 'System-generated primary key.';
    COMMENT ON COLUMN contributor_system_user.contributor_id IS 'ID of the associated contributor.';
    COMMENT ON COLUMN contributor_system_user.system_user_id IS 'ID of the associated system user (service account).';
    COMMENT ON COLUMN contributor_system_user.record_end_date IS 'The date the record was soft-deleted or expired.';
    COMMENT ON COLUMN contributor_system_user.create_date IS 'Timestamp when the record was created.';
    COMMENT ON COLUMN contributor_system_user.create_user IS 'ID of the user who created the record.';
    COMMENT ON COLUMN contributor_system_user.update_date IS 'Timestamp when the record was last updated.';
    COMMENT ON COLUMN contributor_system_user.update_user IS 'ID of the user who last updated the record.';
    COMMENT ON COLUMN contributor_system_user.revision_count IS 'Concurrency control field.';

    ----------------------------------------------------------------------------------------
    -- Create audit and journal triggers
    ----------------------------------------------------------------------------------------

    CREATE TRIGGER audit_contributor 
      BEFORE INSERT OR UPDATE OR DELETE ON contributor 
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();

    CREATE TRIGGER journal_contributor 
      AFTER INSERT OR UPDATE OR DELETE ON contributor 
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    CREATE TRIGGER audit_contributor_system_user 
      BEFORE INSERT OR UPDATE OR DELETE ON contributor_system_user 
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();

    CREATE TRIGGER journal_contributor_system_user 
      AFTER INSERT OR UPDATE OR DELETE ON contributor_system_user 
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();
  `);
}

/**
 * Drops the contributor tables and related objects.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub;

    DROP TABLE IF EXISTS contributor_system_user CASCADE;
    DROP TABLE IF EXISTS contributor CASCADE;
  `);
}
