import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission_upload ADD COLUMN ticket_id uuid;

    COMMENT ON COLUMN submission_upload.ticket_id IS 'Foreign key to the ticket associated with this submission upload.';

    WITH advisory_lock AS (
      SELECT pg_advisory_xact_lock(hashtext('ticket_slug_generation'))
    ),
    day_context AS (
      SELECT TO_CHAR((now() AT TIME ZONE 'UTC')::date, 'DDD') AS day_of_year
    ),
    latest AS (
      SELECT
        COALESCE(MAX(RIGHT(ticket_slug, 5)::integer), -1) AS last_value
      FROM ticket, day_context, advisory_lock
      WHERE ticket_slug LIKE day_context.day_of_year || '%'
    ),
    ensure_backfill_team AS (
      INSERT INTO team (name, description, create_user)
      SELECT
        'Submission Upload Backfill Team',
        'Auto-generated team for legacy submission upload ticket backfill.',
        1
      WHERE NOT EXISTS (
        SELECT 1
        FROM team
        WHERE name = 'Submission Upload Backfill Team'
          AND record_end_date IS NULL
      )
      RETURNING team_id
    ),
    selected_team AS (
      SELECT team_id FROM ensure_backfill_team
      UNION ALL
      SELECT t.team_id
      FROM team t
      WHERE t.name = 'Submission Upload Backfill Team'
        AND t.record_end_date IS NULL
      LIMIT 1
    ),
    numbered_submission_upload AS (
      SELECT
        su.submission_upload_id,
        su.submission_id,
        su.upload_id,
        COALESCE(su.create_user, 1) AS create_user,
        gen_random_uuid() AS new_ticket_id,
        ROW_NUMBER() OVER (ORDER BY su.create_date, su.submission_upload_id) - 1 AS seq_offset
      FROM submission_upload su
      WHERE su.ticket_id IS NULL
    ),
    inserted_tickets AS (
      INSERT INTO ticket (
        ticket_id,
        ticket_slug,
        subject,
        description,
        team_id,
        priority,
        status,
        create_user
      )
      SELECT
        nsu.new_ticket_id,
        day_context.day_of_year || LPAD((latest.last_value + nsu.seq_offset + 1)::text, 5, '0'),
        'Legacy Submission Upload',
        'Backfilled ticket for existing submission_upload row. submission_id=' || nsu.submission_id || ', upload_id=' || nsu.upload_id,
        st.team_id,
        'medium',
        'open',
        nsu.create_user
      FROM numbered_submission_upload nsu
      CROSS JOIN selected_team st
      CROSS JOIN day_context
      CROSS JOIN latest
      RETURNING ticket_id
    ),
    inserted_ticket_status AS (
      INSERT INTO ticket_status (
        ticket_id,
        status,
        create_user
      )
      SELECT
        nsu.new_ticket_id,
        'open',
        nsu.create_user
      FROM numbered_submission_upload nsu
      RETURNING ticket_status_id
    )
    UPDATE submission_upload su
    SET ticket_id = nsu.new_ticket_id
    FROM numbered_submission_upload nsu
    WHERE su.submission_upload_id = nsu.submission_upload_id;

    ALTER TABLE submission_upload ALTER COLUMN ticket_id SET NOT NULL;

    ALTER TABLE submission_upload ADD CONSTRAINT submission_upload_ticket_fk
      FOREIGN KEY (ticket_id) REFERENCES ticket(ticket_id);

    CREATE INDEX submission_upload_ticket_idx ON submission_upload(ticket_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS submission_upload_ticket_idx;

    ALTER TABLE submission_upload DROP CONSTRAINT IF EXISTS submission_upload_ticket_fk;

    ALTER TABLE submission_upload DROP COLUMN IF EXISTS ticket_id;
  `);
}
