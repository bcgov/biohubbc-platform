import { Knex } from 'knex';

/**
 * Create the `ticket_system_user` table and supporting enum/index/trigger objects.
 *
 * Domain intent:
 * - `ticket_system_user` represents explicit ticket assignees.
 * - This is intentionally different from ticket participants derived from
 *   `ticket.team_id` membership.
 * - `ticket_system_user` is unrelated to access and authorization.
 *
 * Schema intent:
 * - `ticket_system_user_status` captures assignment lifecycle:
 *   `requested`, `started`, `blocked`, `resolved`.
 * - These status values are patched manually by system administrators.
 *
 * @param {Knex} knex - Knex database client.
 * @return {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Create enum for assignee lifecycle status.
    ----------------------------------------------------------------------------------------
    CREATE TYPE ticket_system_user_status AS ENUM (
      'requested',
      'started',
      'blocked',
      'resolved'
    );

    COMMENT ON TYPE ticket_system_user_status IS 'Assignment response status for a system user on a ticket.';

    ----------------------------------------------------------------------------------------
    -- 2. Create assignee table with soft-delete and audit/journal metadata.
    ----------------------------------------------------------------------------------------
    CREATE TABLE ticket_system_user (
      ticket_system_user_id uuid DEFAULT gen_random_uuid() NOT NULL,
      ticket_id uuid NOT NULL,
      system_user_id integer NOT NULL,
      status ticket_system_user_status NOT NULL DEFAULT 'requested',
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT ticket_system_user_pk PRIMARY KEY (ticket_system_user_id),
      CONSTRAINT ticket_system_user_ticket_fk FOREIGN KEY (ticket_id) REFERENCES ticket(ticket_id),
      CONSTRAINT ticket_system_user_system_user_fk FOREIGN KEY (system_user_id) REFERENCES "system_user"(system_user_id)
    );

    ----------------------------------------------------------------------------------------
    -- 3. Create lookup indexes and enforce one active assignment per ticket/user.
    ----------------------------------------------------------------------------------------
    CREATE INDEX ticket_system_user_ticket_idx ON ticket_system_user(ticket_id);
    CREATE INDEX ticket_system_user_system_user_idx ON ticket_system_user(system_user_id);
    CREATE UNIQUE INDEX ticket_system_user_nuk1
      ON ticket_system_user(ticket_id, system_user_id, (record_end_date IS NULL))
      WHERE record_end_date IS NULL;

    ----------------------------------------------------------------------------------------
    -- 4. Add table/column/index comments for schema discoverability.
    ----------------------------------------------------------------------------------------
    COMMENT ON TABLE ticket_system_user IS 'Explicit ticket assignees. Distinct from ticket.team_id participants.';
    COMMENT ON COLUMN ticket_system_user.ticket_system_user_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN ticket_system_user.ticket_id IS 'Foreign key to ticket for the assignment.';
    COMMENT ON COLUMN ticket_system_user.system_user_id IS 'Foreign key to system_user assigned to the ticket.';
    COMMENT ON COLUMN ticket_system_user.status IS 'Assignment status: requested, started, blocked, or resolved.';
    COMMENT ON COLUMN ticket_system_user.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN ticket_system_user.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN ticket_system_user.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN ticket_system_user.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN ticket_system_user.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN ticket_system_user.revision_count IS 'Revision count used for concurrency control.';
    COMMENT ON INDEX ticket_system_user_nuk1 IS 'Ensures one active assignment per ticket and system user while allowing soft-delete re-creation.';

    ----------------------------------------------------------------------------------------
    -- 5. Attach standard audit + journal triggers.
    ----------------------------------------------------------------------------------------
    CREATE TRIGGER audit_ticket_system_user
      BEFORE INSERT OR UPDATE OR DELETE ON ticket_system_user
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_ticket_system_user
      AFTER INSERT OR UPDATE OR DELETE ON ticket_system_user
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

/**
 * Roll back `ticket_system_user` schema objects in dependency-safe order.
 *
 * Rollback order:
 * - drop triggers first (table dependencies),
 * - then indexes,
 * - then table,
 * - then enum type.
 *
 * @param {Knex} knex - Knex database client.
 * @return {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Drop triggers bound to ticket_system_user.
    ----------------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS journal_ticket_system_user ON ticket_system_user;
    DROP TRIGGER IF EXISTS audit_ticket_system_user ON ticket_system_user;

    ----------------------------------------------------------------------------------------
    -- 2. Drop indexes created for lookup + active-row uniqueness.
    ----------------------------------------------------------------------------------------
    DROP INDEX IF EXISTS ticket_system_user_nuk1;
    DROP INDEX IF EXISTS ticket_system_user_ticket_idx;
    DROP INDEX IF EXISTS ticket_system_user_system_user_idx;

    ----------------------------------------------------------------------------------------
    -- 3. Drop table and then enum type.
    ----------------------------------------------------------------------------------------
    DROP TABLE IF EXISTS ticket_system_user;

    DROP TYPE IF EXISTS ticket_system_user_status;
  `);
}
