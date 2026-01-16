import { Knex } from 'knex';

/**
 * Drop the submission_job_queue table.
 *
 * This table was part of the old fastq-based queue system and has been replaced
 * by the job_tracking table and pg-boss for async job processing.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = 'biohub';

    DROP TABLE IF EXISTS submission_job_queue;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = 'biohub';

    CREATE TABLE submission_job_queue(
      submission_job_queue_id    integer           NOT NULL,
      submission_id              integer           NOT NULL,
      job_start_timestamp        timestamptz(6),
      job_end_timestamp          timestamptz(6),
      security_request           jsonb,
      key                        varchar(100),
      create_date                timestamptz(6)    DEFAULT now() NOT NULL,
      create_user                integer           NOT NULL,
      update_date                timestamptz(6),
      update_user                integer,
      revision_count             integer           DEFAULT 0 NOT NULL,
      CONSTRAINT submission_job_queue_pk PRIMARY KEY (submission_job_queue_id)
    );

    COMMENT ON TABLE submission_job_queue IS 'Submission job queue for tracking async job processing.';

    ALTER TABLE submission_job_queue
      ADD CONSTRAINT submission_job_queue_fk1
      FOREIGN KEY (submission_id)
      REFERENCES submission(submission_id);

    CREATE SEQUENCE submission_job_queue_id_seq START WITH 1 INCREMENT BY 1;
  `);
}
