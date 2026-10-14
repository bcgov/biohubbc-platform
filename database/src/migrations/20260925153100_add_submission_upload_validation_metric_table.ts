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
    -- Create tables
    ----------------------------------------------------------------------------------------

    CREATE TABLE validation_metric (
      validation_metric_id   integer          GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      key                    varchar(50)      NOT NULL,
      name                   varchar(100)     NOT NULL,
      description            varchar(500)     NULL,
      record_effective_date  timestamptz(6)   DEFAULT now() NOT NULL,
      record_end_date        timestamptz(6)   NULL,
      create_date            timestamptz(6)   DEFAULT now() NOT NULL,
      create_user            integer          NOT NULL,
      update_date            timestamptz(6)   NULL,
      update_user            integer          NULL,
      CONSTRAINT validation_metric_pk PRIMARY KEY (validation_metric_id)
    );

    COMMENT ON TABLE validation_metric IS 'A table for storing validation metrics such as min, max, average values for submission features properties.';
    COMMENT ON COLUMN validation_metric.validation_metric_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN validation_metric.name IS 'The name of the validation metric.';
    COMMENT ON COLUMN validation_metric.description IS 'A description of the validation metric.';
    COMMENT ON COLUMN validation_metric.record_effective_date IS 'The datetime the record was effective.';
    COMMENT ON COLUMN validation_metric.record_end_date IS 'The datetime the record was ended.';
    COMMENT ON COLUMN validation_metric.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN validation_metric.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN validation_metric.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN validation_metric.update_user IS 'The id of the user who updated the record as identified in the system user table.';

    ----------------------------------------------------------------------------------------

    CREATE TABLE submission_upload_validation_metric (
      submission_upload_validation_metric_id    integer        GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_upload_id                      uuid           NOT NULL,
      blueprint_feature_type_property_id        integer        NOT NULL,
      validation_metric_id                      integer        NOT NULL,
      metric_value                              numeric        NOT NULL,
      CONSTRAINT submission_upload_validation_metric_pk PRIMARY KEY (submission_upload_validation_metric_id)
    );

    COMMENT ON TABLE submission_upload_validation_metric IS 'A table for storing submission upload statistic values such as min, max, average and percentiles';
    COMMENT ON COLUMN submission_upload_validation_metric.submission_upload_validation_metric_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_upload_validation_metric.submission_upload_id IS 'A foreign key to the submission_upload table.';
    COMMENT ON COLUMN submission_upload_validation_metric.blueprint_feature_type_property_id IS 'A foreign key to the feature_type_property table.';
    COMMENT ON COLUMN submission_upload_validation_metric.validation_metric_id IS 'A foreign key to the validation_metric table.';
    COMMENT ON COLUMN submission_upload_validation_metric.metric_value IS 'The value of the metric for the submission property.';

    ----------------------------------------------------------------------------------------
    -- Inserting values
    ----------------------------------------------------------------------------------------

    INSERT INTO validation_metric (key, name, description, record_end_date, create_user, update_date, update_user)
    VALUES ('min', 'Minimum', 'Minimum value for the submission feature property.', NULL, 1, NULL, NULL),
          ('max', 'Maximum', 'Maximum value for the submission feature property.', NULL, 1, NULL, NULL),
          ('average', 'Average', 'Average value for the submission feature property.', NULL, 1, NULL, NULL),
          ('q1', 'First Quartile', 'First Quartile (Q1) value for the submission feature property.', NULL, 1, NULL, NULL),
          ('median', 'Second Quartile', 'Second Quartile (Q2)/Median value for the submission feature property.', NULL, 1, NULL, NULL),
          ('q3', 'Third Quartile', 'Third Quartile (Q3) value for the submission feature property.', NULL, 1, NULL, NULL),
          ('total','Total Count', 'Total count of the submission feature property records.', NULL, 1, NULL, NULL);

    ----------------------------------------------------------------------------------------
    -- Create Indexes and Constraints for table: validation_metric
    ----------------------------------------------------------------------------------------

    -- Add unique end-date key constraint (don't allow 2 records with the same key and a NULL record_end_date)
    CREATE UNIQUE INDEX validation_metric_idx1 ON validation_metric (key) where record_end_date is null;

    ----------------------------------------------------------------------------------------
    -- Create Indexes and Constraints for table: submission_upload_validation_metric
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

    CREATE INDEX submission_upload_validation_metric_idx2 ON submission_upload_validation_metric (blueprint_feature_type_property_id);

    CREATE INDEX submission_upload_validation_metric_idx3 ON submission_upload_validation_metric (validation_metric_id);

    ----------------------------------------------------------------------------------------
    -- Create audit and journal triggers
    ----------------------------------------------------------------------------------------

    CREATE TRIGGER audit_submission_upload_validation_metric BEFORE INSERT OR UPDATE OR DELETE ON submission_upload_validation_metric FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_submission_upload_validation_metric AFTER INSERT OR UPDATE OR DELETE ON submission_upload_validation_metric FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    CREATE TRIGGER audit_validation_metric BEFORE INSERT OR UPDATE OR DELETE ON validation_metric FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_validation_metric AFTER INSERT OR UPDATE OR DELETE ON validation_metric FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();
    
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- Drop triggers
    ----------------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS journal_validation_metric ON validation_metric;
    DROP TRIGGER IF EXISTS audit_validation_metric ON validation_metric;

    DROP TRIGGER IF EXISTS journal_submission_upload_validation_metric ON submission_upload_validation_metric;
    DROP TRIGGER IF EXISTS audit_submission_upload_validation_metric ON submission_upload_validation_metric;

    ----------------------------------------------------------------------------------------
    -- Drop tables
    ----------------------------------------------------------------------------------------
    DROP TABLE IF EXISTS validation_metric;

    DROP TABLE IF EXISTS submission_upload_validation_metric;

  `);
}
