import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_type t
          JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'ticket_system_user_status' AND e.enumlabel = 'done'
      ) THEN
        ALTER TYPE ticket_system_user_status RENAME VALUE 'done' TO 'resolved';
      END IF;
    END $$;

    COMMENT ON COLUMN ticket_system_user.status IS 'Assignment status: requested, started, blocked, or resolved.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_type t
          JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'ticket_system_user_status' AND e.enumlabel = 'resolved'
      ) THEN
        ALTER TYPE ticket_system_user_status RENAME VALUE 'resolved' TO 'done';
      END IF;
    END $$;

    COMMENT ON COLUMN ticket_system_user.status IS 'Assignment status: requested, started, blocked, or done.';
  `);
}
