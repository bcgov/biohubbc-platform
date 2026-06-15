import type { Knex } from 'knex';

/**
 * Adds the download_schedule table — a recurring rebuild configuration that hangs off the stable
 * parent download. On each due occurrence the scheduler reuses the existing rerun primitive to mint a
 * new download_version, so a schedule never re-implements materialization. A download has at most one
 * active schedule (enforced by the partial unique index); disabling it via record_end_date stops new
 * versions while preserving history.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- DOWNLOAD_SCHEDULE
    --------------------------------------------------------------------------------

    CREATE TABLE download_schedule (
      download_schedule_id INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
      download_id UUID NOT NULL,
      cron_expression TEXT NOT NULL,
      timezone TEXT NOT NULL,
      next_run_date TIMESTAMPTZ(6),
      last_run_date TIMESTAMPTZ(6),
      record_end_date TIMESTAMPTZ(6),
      create_date TIMESTAMPTZ(6) DEFAULT now() NOT NULL,
      create_user INTEGER NOT NULL,
      update_date TIMESTAMPTZ(6),
      update_user INTEGER,
      revision_count INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT download_schedule_pk PRIMARY KEY (download_schedule_id),
      CONSTRAINT download_schedule_download_fk1 FOREIGN KEY (download_id) REFERENCES download(download_id) ON DELETE CASCADE
    );

    CREATE INDEX download_schedule_download_id_idx ON download_schedule(download_id);
    CREATE INDEX download_schedule_next_run_date_idx ON download_schedule(next_run_date);

    CREATE UNIQUE INDEX download_schedule_nuk1
      ON download_schedule (download_id)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE download_schedule IS 'A recurring rebuild configuration for a download. Each due occurrence reuses the rerun primitive to create a new download_version; a download has at most one active schedule.';
    COMMENT ON COLUMN download_schedule.download_schedule_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN download_schedule.download_id IS 'Foreign key to the download table.';
    COMMENT ON COLUMN download_schedule.cron_expression IS 'A 5-field cron expression defining the recurrence (e.g. ''0 2 * * *''), interpreted in the schedule''s timezone.';
    COMMENT ON COLUMN download_schedule.timezone IS 'IANA timezone (e.g. ''America/Vancouver'') the cron_expression is evaluated in, so occurrences track local wall-clock across DST.';
    COMMENT ON COLUMN download_schedule.next_run_date IS 'The next instant this schedule is due to fire, computed from cron_expression in timezone. The due scan selects rows whose next_run_date is in the past.';
    COMMENT ON COLUMN download_schedule.last_run_date IS 'The instant the schedule last fired; null until the first run.';
    COMMENT ON COLUMN download_schedule.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN download_schedule.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN download_schedule.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN download_schedule.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN download_schedule.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN download_schedule.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_download_schedule
      BEFORE INSERT OR UPDATE OR DELETE ON download_schedule
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_download_schedule
      AFTER INSERT OR UPDATE OR DELETE ON download_schedule
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- DROP DOWNLOAD_SCHEDULE (triggers/indexes drop automatically with the table)
    --------------------------------------------------------------------------------

    DROP TRIGGER IF EXISTS journal_download_schedule ON download_schedule;
    DROP TRIGGER IF EXISTS audit_download_schedule ON download_schedule;

    DROP TABLE IF EXISTS download_schedule;
  `);
}
