import type { Knex } from 'knex';

/** Retire metric definitions and values without removing referenced history. */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;
    ALTER TABLE summary_metrics
      ADD COLUMN record_effective_date timestamptz(6) DEFAULT now() NOT NULL,
      ADD COLUMN record_end_date timestamptz(6);
    ALTER TABLE summary_metrics_data
      ADD COLUMN record_effective_date timestamptz(6) DEFAULT now() NOT NULL,
      ADD COLUMN record_end_date timestamptz(6);
    COMMENT ON COLUMN summary_metrics.record_effective_date IS 'The datetime the metric definition became effective.';
    COMMENT ON COLUMN summary_metrics.record_end_date IS 'The datetime the metric was retired; referenced values remain as history.';
    COMMENT ON COLUMN summary_metrics_data.record_effective_date IS 'The datetime the calculated value became effective.';
    COMMENT ON COLUMN summary_metrics_data.record_end_date IS 'The datetime the value was retired (soft deleted).';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;
    ALTER TABLE summary_metrics_data DROP COLUMN record_effective_date, DROP COLUMN record_end_date;
    ALTER TABLE summary_metrics DROP COLUMN record_effective_date, DROP COLUMN record_end_date;
  `);
}
