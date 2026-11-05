import type { Knex } from 'knex';

/** Create the summary metric dictionary and historical calculated values. */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE TABLE summary_metrics (
      summary_metric_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
      key varchar(100) NOT NULL,
      name varchar(200) NOT NULL,
      description text NOT NULL,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT summary_metrics_pk PRIMARY KEY (summary_metric_id),
      CONSTRAINT summary_metrics_uk1 UNIQUE (key)
    );

    CREATE TABLE summary_metrics_data (
      summary_metrics_data_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
      summary_metric_id integer NOT NULL,
      run_id uuid NOT NULL,
      calculated_at timestamptz(6) NOT NULL,
      value jsonb,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT summary_metrics_data_pk PRIMARY KEY (summary_metrics_data_id),
      CONSTRAINT summary_metrics_data_fk1 FOREIGN KEY (summary_metric_id) REFERENCES summary_metrics(summary_metric_id),
      CONSTRAINT summary_metrics_data_uk1 UNIQUE (run_id, summary_metric_id)
    );

    CREATE INDEX summary_metrics_data_idx1
      ON summary_metrics_data (summary_metric_id, calculated_at DESC, summary_metrics_data_id DESC);
    CREATE INDEX summary_metrics_data_idx2
      ON summary_metrics_data (calculated_at DESC, summary_metrics_data_id DESC);

    COMMENT ON TABLE summary_metrics IS 'Dictionary of platform summary metrics. Keys identify calculations in application code; add a new key when the meaning of a metric changes.';
    COMMENT ON COLUMN summary_metrics.key IS 'Stable machine-readable metric key, independent of its display name.';
    COMMENT ON COLUMN summary_metrics.description IS 'Definition of what the metric measures and which data contributes.';
    COMMENT ON TABLE summary_metrics_data IS 'Historical calculated summary values, grouped into complete snapshots by run_id. Each run is inserted atomically.';
    COMMENT ON COLUMN summary_metrics_data.summary_metric_id IS 'Foreign key to the summary metric dictionary.';
    COMMENT ON COLUMN summary_metrics_data.run_id IS 'Shared identifier for all metric values produced by one calculation.';
    COMMENT ON COLUMN summary_metrics_data.calculated_at IS 'Timestamp of the source snapshot used for this calculation.';
    COMMENT ON COLUMN summary_metrics_data.value IS 'Computed JSON value: numbers for counts, ISO date strings for dates, SQL NULL when no value exists.';

    INSERT INTO summary_metrics (key, name, description, create_user) VALUES
      ('record_count', 'Record count', 'Number of current published features.', 1),
      ('submission_count', 'Submission count', 'Number of distinct submissions represented by current published features.', 1),
      ('survey_count', 'Survey count', 'Number of current published survey features.', 1),
      ('earliest_date', 'Earliest date', 'Earliest indexed submitted date across published features.', 1),
      ('latest_date', 'Latest date', 'Latest indexed submitted date across published features.', 1);

    CREATE TRIGGER audit_summary_metrics BEFORE INSERT OR UPDATE OR DELETE ON summary_metrics
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_summary_metrics AFTER INSERT OR UPDATE OR DELETE ON summary_metrics
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
    CREATE TRIGGER audit_summary_metrics_data BEFORE INSERT OR UPDATE OR DELETE ON summary_metrics_data
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_summary_metrics_data AFTER INSERT OR UPDATE OR DELETE ON summary_metrics_data
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

/** Remove calculated values before their dictionary. */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;
    DROP TABLE summary_metrics_data;
    DROP TABLE summary_metrics;
  `);
}
