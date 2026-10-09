import type { Knex } from 'knex';

/**
 *
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

    CREATE TABLE validation_metric (
      validation_metric_id   integer        GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      key                    varchar(50)    NOT NULL,
      name                   varchar(100)   NOT NULL,
      description            varchar(500)   NULL,
      record_effective_date  timestamptz(6) DEFAULT now() NOT NULL,
      record_end_date        timestamptz(6) NULL,
      create_date            timestamptz(6) DEFAULT now() NOT NULL,
      create_user            integer        NOT NULL,
      update_date            timestamptz(6) NULL,
      update_user            integer        NULL,
      CONSTRAINT validation_metric_pk PRIMARY KEY (validation_metric_id)
    );

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
    -- Table and column comments
    ----------------------------------------------------------------------------------------

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
    -- Create Indexes and Constraints for table: validation_metric
    ----------------------------------------------------------------------------------------

    -- Add unique end-date key constraint (don't allow 2 records with the same key and a NULL record_end_date)
    CREATE UNIQUE INDEX validation_metric_idx1 ON validation_metric (key, (record_end_date is NULL)) where record_end_date is null;

    ----------------------------------------------------------------------------------------
    -- Create audit and journal triggers
    ----------------------------------------------------------------------------------------

    CREATE TRIGGER audit_validation_metric
      BEFORE INSERT OR UPDATE OR DELETE ON validation_metric
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_validation_metric
      AFTER INSERT OR UPDATE OR DELETE ON validation_metric
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();
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

    ----------------------------------------------------------------------------------------
    -- Drop tables
    ----------------------------------------------------------------------------------------
    DROP TABLE IF EXISTS validation_metric;

  `);
}
