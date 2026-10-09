import type { Knex } from 'knex';

/**
 * Create submission_upload_validation_metric table with audit and journal triggers
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- Create table
    ----------------------------------------------------------------------------------------

    CREATE TABLE submission_upload_validation_metric (
      submission_upload_validation_metric_id    integer        GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_upload_id                      uuid           NOT NULL,
      blueprint_feature_type_property_id        integer        NOT NULL,
      validation_metric_id                      integer        NOT NULL,
      metric_value                              numeric        NOT NULL,
      CONSTRAINT submission_upload_validation_metric_pk PRIMARY KEY (submission_upload_validation_metric_id)
    );

    ----------------------------------------------------------------------------------------
    -- Create indexes and constraints
    ----------------------------------------------------------------------------------------

    -- Add unique constraint on submission_upload_id, blueprint_feature_type_property_id and validation_metric_id) 
    ALTER TABLE submission_upload_validation_metric ADD CONSTRAINT submission_upload_validation_metric_uk1 UNIQUE 
    (submission_upload_id, blueprint_feature_type_property_id, validation_metric_id);

    ALTER TABLE submission_upload_validation_metric ADD CONSTRAINT submission_upload_validation_metric_fk1
      FOREIGN KEY (submission_upload_id)
      REFERENCES submission_upload(submission_upload_id);

    ALTER TABLE submission_upload_validation_metric ADD CONSTRAINT submission_upload_validation_metric_fk2
      FOREIGN KEY (blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id);

    ALTER TABLE submission_upload_validation_metric ADD CONSTRAINT submission_upload_validation_metric_fk3
      FOREIGN KEY (validation_metric_id)
      REFERENCES validation_metric(validation_metric_id);

    -- Add indexes for foreign keys
    CREATE INDEX submission_upload_validation_metric_idx1 ON submission_upload_validation_metric (submission_upload_id);

    CREATE INDEX submission_upload_validation_metric_idx1 ON submission_upload_validation_metric (blueprint_feature_type_property_id);

    CREATE INDEX submission_upload_validation_metric_idx1 ON submission_upload_validation_metric (validation_metric_id);

    ----------------------------------------------------------------------------------------
    -- Table and column comments
    ----------------------------------------------------------------------------------------

    COMMENT ON TABLE submission_upload_validation_metric IS 'A table for storing submission upload statistic values such as min, max, average and percentiles';
    COMMENT ON COLUMN submission_upload_validation_metric.submission_upload_validation_metric_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_upload_validation_metric.submission_upload_id IS 'A foreign key to the submission_upload table.';
    COMMENT ON COLUMN submission_upload_validation_metric.blueprint_feature_type_property_id IS 'A foreign key to the feature_type_property table.';
    COMMENT ON COLUMN submission_upload_validation_metric.validation_metric_id IS 'A foreign key to the validation_metric table.';
    COMMENT ON COLUMN submission_upload_validation_metric.metric_value IS 'The value of the metric for the submission property.';

    ----------------------------------------------------------------------------------------
    -- Create audit and journal triggers
    ----------------------------------------------------------------------------------------

    CREATE TRIGGER audit_submission_upload_validation_metric
      BEFORE INSERT OR UPDATE OR DELETE ON submission_upload_validation_metric
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_submission_upload_validation_metric
      AFTER INSERT OR UPDATE OR DELETE ON submission_upload_validation_metric
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- Drop triggers
    ----------------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS journal_submission_upload_validation_metric ON submission_upload_validation_metric;
    DROP TRIGGER IF EXISTS audit_submission_upload_validation_metric ON submission_upload_validation_metric;

    ----------------------------------------------------------------------------------------
    -- Drop tables
    ----------------------------------------------------------------------------------------
    DROP TABLE IF EXISTS submission_upload_validation_metric;

  `);
}
