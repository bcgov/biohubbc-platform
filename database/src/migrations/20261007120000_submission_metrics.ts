import type { Knex } from 'knex';

/** Store complete, platform-wide metric snapshots produced by the nightly calculation. */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE TABLE submission_metrics (
      submission_metrics_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
      calculated_at timestamptz(6) NOT NULL,
      record_count bigint NOT NULL,
      submission_count bigint NOT NULL,
      survey_count bigint NOT NULL,
      earliest_date date,
      latest_date date,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT submission_metrics_pk PRIMARY KEY (submission_metrics_id),
      CONSTRAINT submission_metrics_record_count_check CHECK (record_count >= 0),
      CONSTRAINT submission_metrics_submission_count_check CHECK (submission_count >= 0),
      CONSTRAINT submission_metrics_survey_count_check CHECK (survey_count >= 0),
      CONSTRAINT submission_metrics_date_range_check CHECK (
        (earliest_date IS NULL AND latest_date IS NULL)
        OR (earliest_date IS NOT NULL AND latest_date IS NOT NULL AND earliest_date <= latest_date)
      )
    );

    CREATE INDEX submission_metrics_idx1
      ON submission_metrics (calculated_at DESC, submission_metrics_id DESC);

    COMMENT ON TABLE submission_metrics IS
      'Platform-wide submission metric snapshots. Insert a complete row only after a successful calculation; retain previous snapshots as history.';
    COMMENT ON COLUMN submission_metrics.submission_metrics_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_metrics.calculated_at IS
      'Timestamp of the source snapshot used for the calculation. Order descending with submission_metrics_id as a tie-breaker to retrieve the latest snapshot.';
    COMMENT ON COLUMN submission_metrics.record_count IS 'Total number of records included in the calculation.';
    COMMENT ON COLUMN submission_metrics.submission_count IS 'Total number of submissions included in the calculation.';
    COMMENT ON COLUMN submission_metrics.survey_count IS 'Total number of surveys included in the calculation.';
    COMMENT ON COLUMN submission_metrics.earliest_date IS 'Earliest date covered by the included data; null when no dated data exists.';
    COMMENT ON COLUMN submission_metrics.latest_date IS 'Latest date covered by the included data; null when no dated data exists.';
    COMMENT ON COLUMN submission_metrics.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_metrics.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN submission_metrics.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN submission_metrics.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN submission_metrics.revision_count IS 'Revision count used by the audit trigger for concurrency control.';

    CREATE TRIGGER audit_submission_metrics
      BEFORE INSERT OR UPDATE OR DELETE ON submission_metrics
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_submission_metrics
      AFTER INSERT OR UPDATE OR DELETE ON submission_metrics
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

/** Remove metric snapshots. */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TABLE submission_metrics;
  `);
}
