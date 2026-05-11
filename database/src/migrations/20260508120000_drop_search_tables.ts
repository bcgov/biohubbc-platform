import { Knex } from 'knex';

/**
 * Drops the `search_*` cluster and its 4 inner security-condition functions.
 *
 * The cluster (`search_string`, `search_number`, `search_datetime`,
 * `search_spatial`) was replaced by `submission_feature_property_*`; the
 * parser had been double-writing to both, so every `search_*` row already
 * has a mirror in the new substrate.
 *
 * The 4 functions whose bodies reference `search_*`
 * (`evaluate_security_string_condition`, `..._number_condition`,
 * `..._datetime_condition`, `..._spatial_condition`) are dropped together
 * with the tables. The `evaluate_security_rule` and `evaluate_security_rule_2`
 * wrappers are intentionally left in a stale state (orphan, parsable, never
 * called).
 *
 * See: SIMSBIOHUB-976
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Drop the 4 inner security-condition functions BEFORE the tables they read.
    -- The wrapper functions evaluate_security_rule and evaluate_security_rule_2
    -- are intentionally NOT dropped here — they are orphan but kept per the
    -- ticket's scope decision.
    --------------------------------------------------------------------------------
    DROP FUNCTION IF EXISTS evaluate_security_string_condition(VARCHAR, integer);
    DROP FUNCTION IF EXISTS evaluate_security_number_condition(VARCHAR, integer);
    DROP FUNCTION IF EXISTS evaluate_security_datetime_condition(VARCHAR, integer);
    DROP FUNCTION IF EXISTS evaluate_security_spatial_condition(VARCHAR, integer);

    --------------------------------------------------------------------------------
    -- Drop the 4 search_* tables. CASCADE drops the FK constraints and indexes
    -- (including the FTS GIN index on search_string.value) against them.
    -- Production rows have full mirrors in submission_feature_property_*.
    --------------------------------------------------------------------------------
    DROP TABLE IF EXISTS search_string  CASCADE;
    DROP TABLE IF EXISTS search_number  CASCADE;
    DROP TABLE IF EXISTS search_datetime CASCADE;
    DROP TABLE IF EXISTS search_spatial CASCADE;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Recreate the 4 search_* tables (DDL copied from 20231109000002_search_tables.ts)
    --------------------------------------------------------------------------------

    CREATE TABLE search_string(
      search_string_id         integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id    integer           NOT NULL,
      feature_property_id      integer           NOT NULL,
      value                    varchar(250)      NOT NULL,
      create_date              timestamptz(6)    DEFAULT now() NOT NULL,
      create_user              integer           NOT NULL,
      update_date              timestamptz(6),
      update_user              integer,
      revision_count           integer           DEFAULT 0 NOT NULL,
      CONSTRAINT search_string_pk PRIMARY KEY (search_string_id)
    );

    COMMENT ON COLUMN search_string.search_string_id       IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN search_string.submission_feature_id  IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN search_string.feature_property_id    IS 'Foreign key to the feature_property table.';
    COMMENT ON COLUMN search_string.value                  IS 'The search value of the record.';
    COMMENT ON COLUMN search_string.create_date            IS 'The datetime the record was created.';
    COMMENT ON COLUMN search_string.create_user            IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN search_string.update_date            IS 'The datetime the record was updated.';
    COMMENT ON COLUMN search_string.update_user            IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN search_string.revision_count         IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  search_string                        IS 'String search values.';

    CREATE TABLE search_number(
      search_number_id         integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id    integer           NOT NULL,
      feature_property_id      integer           NOT NULL,
      value                    numeric           NOT NULL,
      create_date              timestamptz(6)    DEFAULT now() NOT NULL,
      create_user              integer           NOT NULL,
      update_date              timestamptz(6),
      update_user              integer,
      revision_count           integer           DEFAULT 0 NOT NULL,
      CONSTRAINT search_number_pk PRIMARY KEY (search_number_id)
    );

    COMMENT ON COLUMN search_number.search_number_id       IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN search_number.submission_feature_id  IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN search_number.feature_property_id    IS 'Foreign key to the feature_property table.';
    COMMENT ON COLUMN search_number.value                  IS 'The search value of the record.';
    COMMENT ON COLUMN search_number.create_date            IS 'The datetime the record was created.';
    COMMENT ON COLUMN search_number.create_user            IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN search_number.update_date            IS 'The datetime the record was updated.';
    COMMENT ON COLUMN search_number.update_user            IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN search_number.revision_count         IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  search_number                        IS 'Number search values.';

    CREATE TABLE search_datetime(
      search_datetime_id       integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id    integer           NOT NULL,
      feature_property_id      integer           NOT NULL,
      value                    timestamptz(6)    NOT NULL,
      create_date              timestamptz(6)    DEFAULT now() NOT NULL,
      create_user              integer           NOT NULL,
      update_date              timestamptz(6),
      update_user              integer,
      revision_count           integer           DEFAULT 0 NOT NULL,
      CONSTRAINT search_datetime_pk PRIMARY KEY (search_datetime_id)
    );

    COMMENT ON COLUMN search_datetime.search_datetime_id     IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN search_datetime.submission_feature_id  IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN search_datetime.feature_property_id    IS 'Foreign key to the feature_property table.';
    COMMENT ON COLUMN search_datetime.value                  IS 'The search value of the record.';
    COMMENT ON COLUMN search_datetime.create_date            IS 'The datetime the record was created.';
    COMMENT ON COLUMN search_datetime.create_user            IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN search_datetime.update_date            IS 'The datetime the record was updated.';
    COMMENT ON COLUMN search_datetime.update_user            IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN search_datetime.revision_count         IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  search_datetime                        IS 'Datetime search values.';

    CREATE TABLE search_spatial(
      search_spatial_id        integer                    GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id    integer                    NOT NULL,
      feature_property_id      integer                    NOT NULL,
      value                    geometry                   NOT NULL,
      create_date              timestamptz(6)             DEFAULT now() NOT NULL,
      create_user              integer                    NOT NULL,
      update_date              timestamptz(6),
      update_user              integer,
      revision_count           integer                    DEFAULT 0 NOT NULL,
      CONSTRAINT search_spatial_pk PRIMARY KEY (search_spatial_id)
    );

    COMMENT ON COLUMN search_spatial.search_spatial_id      IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN search_spatial.submission_feature_id  IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN search_spatial.feature_property_id    IS 'Foreign key to the feature_property table.';
    COMMENT ON COLUMN search_spatial.value                  IS 'The search value of the record.';
    COMMENT ON COLUMN search_spatial.create_date            IS 'The spatial the record was created.';
    COMMENT ON COLUMN search_spatial.create_user            IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN search_spatial.update_date            IS 'The spatial the record was updated.';
    COMMENT ON COLUMN search_spatial.update_user            IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN search_spatial.revision_count         IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  search_spatial                        IS 'Spatial search values.';

    --------------------------------------------------------------------------------
    -- Recreate FK constraints and indexes
    --------------------------------------------------------------------------------

    ALTER TABLE search_string ADD CONSTRAINT search_string_fk1
      FOREIGN KEY (submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    ALTER TABLE search_string ADD CONSTRAINT search_string_fk2
      FOREIGN KEY (feature_property_id)
      REFERENCES feature_property(feature_property_id);

    CREATE INDEX search_string_idx1 ON search_string(submission_feature_id);
    CREATE INDEX search_string_idx2 ON search_string(feature_property_id);
    CREATE INDEX search_string_idx3 ON search_string(value);

    ALTER TABLE search_number ADD CONSTRAINT search_number_fk1
      FOREIGN KEY (submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    ALTER TABLE search_number ADD CONSTRAINT search_number_fk2
      FOREIGN KEY (feature_property_id)
      REFERENCES feature_property(feature_property_id);

    CREATE INDEX search_number_idx1 ON search_number(submission_feature_id);
    CREATE INDEX search_number_idx2 ON search_number(feature_property_id);
    CREATE INDEX search_number_idx3 ON search_number(value);

    ALTER TABLE search_datetime ADD CONSTRAINT search_datetime_fk1
      FOREIGN KEY (submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    ALTER TABLE search_datetime ADD CONSTRAINT search_datetime_fk2
      FOREIGN KEY (feature_property_id)
      REFERENCES feature_property(feature_property_id);

    CREATE INDEX search_datetime_idx1 ON search_datetime(submission_feature_id);
    CREATE INDEX search_datetime_idx2 ON search_datetime(feature_property_id);
    CREATE INDEX search_datetime_idx3 ON search_datetime(value);

    ALTER TABLE search_spatial ADD CONSTRAINT search_spatial_fk1
      FOREIGN KEY (submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    ALTER TABLE search_spatial ADD CONSTRAINT search_spatial_fk2
      FOREIGN KEY (feature_property_id)
      REFERENCES feature_property(feature_property_id);

    CREATE INDEX search_spatial_idx1 ON search_spatial(submission_feature_id);
    CREATE INDEX search_spatial_idx2 ON search_spatial(feature_property_id);
    CREATE INDEX search_spatial_idx3 ON search_spatial USING GIST(value);

    --------------------------------------------------------------------------------
    -- Recreate audit and journal triggers
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_search_string   BEFORE INSERT OR UPDATE OR DELETE ON search_string   FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_search_string AFTER  INSERT OR UPDATE OR DELETE ON search_string   FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    CREATE TRIGGER audit_search_number   BEFORE INSERT OR UPDATE OR DELETE ON search_number   FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_search_number AFTER  INSERT OR UPDATE OR DELETE ON search_number   FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    CREATE TRIGGER audit_search_datetime   BEFORE INSERT OR UPDATE OR DELETE ON search_datetime FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_search_datetime AFTER  INSERT OR UPDATE OR DELETE ON search_datetime FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    CREATE TRIGGER audit_search_spatial   BEFORE INSERT OR UPDATE OR DELETE ON search_spatial  FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_search_spatial AFTER  INSERT OR UPDATE OR DELETE ON search_spatial  FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- Recreate the FTS GIN index on search_string.value
    --------------------------------------------------------------------------------
    CREATE INDEX search_string_fts_idx
      ON search_string
      USING GIN (to_tsvector('english', value));

    --------------------------------------------------------------------------------
    -- Recreate the 4 inner security-condition functions. The wrappers
    -- (evaluate_security_rule, evaluate_security_rule_2) were never dropped
    -- by the corresponding 'up', so they are NOT recreated here.
    --------------------------------------------------------------------------------

    CREATE OR REPLACE FUNCTION evaluate_security_string_condition(rule_name VARCHAR, submission_feature_id integer)
    RETURNS TABLE (result boolean)
    LANGUAGE plpgsql
    SET client_min_messages = warning
    AS $$
    DECLARE
        comp TEXT;
        val text;
    BEGIN
        SELECT security_string.comparator, security_string.value INTO comp, val FROM security_string WHERE name = evaluate_security_string_condition.rule_name;

        RETURN QUERY EXECUTE format('SELECT CASE WHEN EXISTS (SELECT 1 FROM search_string WHERE submission_feature_id = %s AND value %s ''%s'') THEN TRUE ELSE FALSE END', evaluate_security_string_condition.submission_feature_id, comp, val);
    END;
    $$;

    CREATE OR REPLACE FUNCTION evaluate_security_number_condition(rule_name VARCHAR, submission_feature_id integer)
    RETURNS TABLE (result boolean)
    LANGUAGE plpgsql
    SET client_min_messages = warning
    AS $$
    DECLARE
        comparator TEXT;
        value numeric;
    BEGIN
        SELECT security_number.comparator, security_number.value INTO comparator, value FROM security_number WHERE name = evaluate_security_number_condition.rule_name;

        RETURN QUERY EXECUTE format('SELECT CASE WHEN EXISTS (SELECT 1 FROM search_number WHERE submission_feature_id = %s AND value %s %s) THEN TRUE ELSE FALSE END', evaluate_security_number_condition.submission_feature_id, comparator, value);
    END;
    $$;

    CREATE OR REPLACE FUNCTION evaluate_security_datetime_condition(rule_name VARCHAR, submission_feature_id integer)
    RETURNS TABLE (result BOOLEAN)
    LANGUAGE plpgsql
    SET client_min_messages = warning
    AS $$
    DECLARE
        comparator TEXT;
        value timestamptz(6);
    BEGIN
        SELECT security_datetime.comparator, security_datetime.value INTO comparator, value FROM security_datetime WHERE name = evaluate_security_datetime_condition.rule_name;

        RETURN QUERY EXECUTE format('SELECT CASE WHEN EXISTS (SELECT 1 FROM search_datetime WHERE submission_feature_id = %s and value %s ''%s'') THEN TRUE ELSE FALSE END', evaluate_security_datetime_condition.submission_feature_id, comparator, value);
    END;
    $$;

    CREATE OR REPLACE FUNCTION evaluate_security_spatial_condition(rule_name VARCHAR, submission_feature_id integer)
    RETURNS TABLE (result BOOLEAN)
    LANGUAGE plpgsql
    SET client_min_messages = warning
    AS $$
    DECLARE
        comparator TEXT;
        value geometry;
    BEGIN
        SELECT security_spatial.comparator, security_spatial.value INTO comparator, value FROM security_spatial WHERE name = evaluate_security_spatial_condition.rule_name;

        RETURN QUERY EXECUTE FORMAT('SELECT CASE WHEN EXISTS (SELECT 1 FROM search_spatial WHERE submission_feature_id = %s AND ST_Intersects(value, ''%s'')) THEN TRUE ELSE FALSE END', evaluate_security_spatial_condition.submission_feature_id, value);
    END;
    $$;
  `);
}
