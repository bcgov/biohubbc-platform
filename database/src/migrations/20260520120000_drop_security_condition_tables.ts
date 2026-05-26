import { Knex } from 'knex';

/**
 * Drops the legacy typed security-condition tables that backed the removed
 * `search_*` evaluator path.
 *
 * Prior cleanup removed the `search_*` tables and inner
 * `evaluate_security_*_condition` functions (SIMSBIOHUB-976), then the stale
 * `evaluate_security_rule` / `evaluate_security_rule_2` wrappers. These four
 * tables are the last orphaned artifacts; the live security path is
 * `security_rule_expression`-based.
 *
 * Full rollback requires undoing migrations in order: this migration's
 * `down()`, then `drop_evaluate_security_rule_wrappers`, then
 * `drop_search_tables`.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Drop the 4 typed security-condition tables. CASCADE removes FK constraints,
    -- indexes, and audit/journal triggers created in 20231117000001.
    --------------------------------------------------------------------------------
    DROP TABLE IF EXISTS security_string   CASCADE;
    DROP TABLE IF EXISTS security_number   CASCADE;
    DROP TABLE IF EXISTS security_datetime CASCADE;
    DROP TABLE IF EXISTS security_spatial  CASCADE;
  `);
}

/**
 * Recreates the 4 typed security-condition tables verbatim from
 * 20231117000001_security_tables.ts so that a full rollback chain restores
 * schema objects referenced by the wrapper and condition-function rollbacks.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Table DDL copied from 20231117000001_security_tables.ts
    --------------------------------------------------------------------------------

    CREATE TABLE security_string(
      security_string_id       integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      security_rule_id         integer           NOT NULL,
      name                     varchar(100)      NOT NULL,
      description              varchar(500),
      feature_property_id      integer           NOT NULL,
      value                    varchar(250)      NOT NULL,
      comparator               varchar(50)       NOT NULL,
      record_effective_date    date              DEFAULT now() NOT NULL,
      record_end_date          date,
      create_date              timestamptz(6)    DEFAULT now() NOT NULL,
      create_user              integer           NOT NULL,
      update_date              timestamptz(6),
      update_user              integer,
      revision_count           integer           DEFAULT 0 NOT NULL,
      CONSTRAINT security_string_pk PRIMARY KEY (security_string_id)
    );

    COMMENT ON COLUMN security_string.security_string_id      IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN security_string.security_rule_id        IS 'Foreign key to the security_string table.';
    COMMENT ON COLUMN security_string.name                    IS 'The name of the security_string record.';
    COMMENT ON COLUMN security_string.description             IS 'The description of the security_string record.';
    COMMENT ON COLUMN security_string.feature_property_id     IS 'Foreign key to the feature_property table.';
    COMMENT ON COLUMN security_string.value                   IS 'The search value of the record.';
    COMMENT ON COLUMN security_string.comparator              IS 'The comparison template.';
    COMMENT ON COLUMN security_string.create_date             IS 'The datetime the record was created.';
    COMMENT ON COLUMN security_string.create_user             IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN security_string.update_date             IS 'The datetime the record was updated.';
    COMMENT ON COLUMN security_string.update_user             IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN security_string.revision_count          IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  security_string                         IS 'String security condition.';

    CREATE TABLE security_number(
      security_number_id       integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      security_rule_id         integer           NOT NULL,
      name                     varchar(100)      NOT NULL,
      description              varchar(500),
      feature_property_id      integer           NOT NULL,
      value                    numeric           NOT NULL,
      comparator               varchar(50)       NOT NULL,
      record_effective_date    date              DEFAULT now() NOT NULL,
      record_end_date          date,
      create_date              timestamptz(6)    DEFAULT now() NOT NULL,
      create_user              integer           NOT NULL,
      update_date              timestamptz(6),
      update_user              integer,
      revision_count           integer           DEFAULT 0 NOT NULL,
      CONSTRAINT security_number_pk PRIMARY KEY (security_number_id)
    );

    COMMENT ON COLUMN security_number.security_number_id      IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN security_number.security_rule_id        IS 'Foreign key to the security_number table.';
    COMMENT ON COLUMN security_number.name                    IS 'The name of the security_number record.';
    COMMENT ON COLUMN security_number.description             IS 'The description of the security_number record.';
    COMMENT ON COLUMN security_number.feature_property_id     IS 'Foreign key to the feature_property table.';
    COMMENT ON COLUMN security_number.value                   IS 'The search value of the record.';
    COMMENT ON COLUMN security_number.comparator              IS 'The comparison template.';
    COMMENT ON COLUMN security_number.create_date             IS 'The datetime the record was created.';
    COMMENT ON COLUMN security_number.create_user             IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN security_number.update_date             IS 'The datetime the record was updated.';
    COMMENT ON COLUMN security_number.update_user             IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN security_number.revision_count          IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  security_number                         IS 'Number security condition.';

    CREATE TABLE security_datetime(
      security_datetime_id     integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      security_rule_id         integer           NOT NULL,
      name                     varchar(100)      NOT NULL,
      description              varchar(500),
      feature_property_id      integer           NOT NULL,
      value                    timestamptz(6)    NOT NULL,
      comparator               varchar(50)       NOT NULL,
      record_effective_date    date              DEFAULT now() NOT NULL,
      record_end_date          date,
      create_date              timestamptz(6)    DEFAULT now() NOT NULL,
      create_user              integer           NOT NULL,
      update_date              timestamptz(6),
      update_user              integer,
      revision_count           integer           DEFAULT 0 NOT NULL,
      CONSTRAINT security_datetime_pk PRIMARY KEY (security_datetime_id)
    );

    COMMENT ON COLUMN security_datetime.security_datetime_id    IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN security_datetime.security_rule_id        IS 'Foreign key to the security_datetime table.';
    COMMENT ON COLUMN security_datetime.name                    IS 'The name of the security_datetime record.';
    COMMENT ON COLUMN security_datetime.description             IS 'The description of the security_datetime record.';
    COMMENT ON COLUMN security_datetime.feature_property_id     IS 'Foreign key to the feature_property table.';
    COMMENT ON COLUMN security_datetime.value                   IS 'The search value of the record.';
    COMMENT ON COLUMN security_datetime.comparator              IS 'The comparison template.';
    COMMENT ON COLUMN security_datetime.create_date             IS 'The datetime the record was created.';
    COMMENT ON COLUMN security_datetime.create_user             IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN security_datetime.update_date             IS 'The datetime the record was updated.';
    COMMENT ON COLUMN security_datetime.update_user             IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN security_datetime.revision_count          IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  security_datetime                         IS 'Datetime security condition.';

    CREATE TABLE security_spatial(
      security_spatial_id      integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      security_rule_id         integer           NOT NULL,
      name                     varchar(100)      NOT NULL,
      description              varchar(500),
      feature_property_id      integer           NOT NULL,
      value                    geometry          NOT NULL,
      comparator               varchar(50)       NOT NULL,
      record_effective_date    date              DEFAULT now() NOT NULL,
      record_end_date          date,
      create_date              timestamptz(6)    DEFAULT now() NOT NULL,
      create_user              integer           NOT NULL,
      update_date              timestamptz(6),
      update_user              integer,
      revision_count           integer           DEFAULT 0 NOT NULL,
      CONSTRAINT security_spatial_pk PRIMARY KEY (security_spatial_id)
    );

    COMMENT ON COLUMN security_spatial.security_spatial_id     IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN security_spatial.security_rule_id        IS 'Foreign key to the security_spatial table.';
    COMMENT ON COLUMN security_spatial.name                    IS 'The name of the security_spatial record.';
    COMMENT ON COLUMN security_spatial.description             IS 'The description of the security_spatial record.';
    COMMENT ON COLUMN security_spatial.feature_property_id     IS 'Foreign key to the feature_property table.';
    COMMENT ON COLUMN security_spatial.value                   IS 'The search value of the record.';
    COMMENT ON COLUMN security_spatial.comparator              IS 'The comparison template.';
    COMMENT ON COLUMN security_spatial.create_date             IS 'The spatial the record was created.';
    COMMENT ON COLUMN security_spatial.create_user             IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN security_spatial.update_date             IS 'The spatial the record was updated.';
    COMMENT ON COLUMN security_spatial.update_user             IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN security_spatial.revision_count          IS 'Revision count used for concurrency control.';
    COMMENT ON TABLE  security_spatial                         IS 'Spatial security condition.';

    --------------------------------------------------------------------------------
    -- Indexes and constraints (copied from 20231117000001_security_tables.ts)
    --------------------------------------------------------------------------------

    CREATE UNIQUE INDEX security_string_nuk1 ON security_string(name, (record_end_date is NULL)) where record_end_date is null;

    ALTER TABLE security_string ADD CONSTRAINT security_string_fk1
      FOREIGN KEY (security_rule_id)
      REFERENCES security_rule(security_rule_id);

    CREATE INDEX security_string_idx1 ON security_string(security_rule_id);

    CREATE UNIQUE INDEX security_number_nuk1 ON security_number(name, (record_end_date is NULL)) where record_end_date is null;

    ALTER TABLE security_number ADD CONSTRAINT security_number_fk1
      FOREIGN KEY (security_rule_id)
      REFERENCES security_rule(security_rule_id);

    CREATE INDEX security_number_idx1 ON security_number(security_rule_id);

    CREATE UNIQUE INDEX security_datetime_nuk1 ON security_datetime(name, (record_end_date is NULL)) where record_end_date is null;

    ALTER TABLE security_datetime ADD CONSTRAINT security_datetime_fk1
      FOREIGN KEY (security_rule_id)
      REFERENCES security_rule(security_rule_id);

    CREATE INDEX security_datetime_idx1 ON security_datetime(security_rule_id);

    CREATE UNIQUE INDEX security_spatial_nuk1 ON security_spatial(name, (record_end_date is NULL)) where record_end_date is null;

    ALTER TABLE security_spatial ADD CONSTRAINT security_spatial_fk1
      FOREIGN KEY (security_rule_id)
      REFERENCES security_rule(security_rule_id);

    CREATE INDEX security_spatial_idx1 ON security_spatial(security_rule_id);

    --------------------------------------------------------------------------------
    -- Audit and journal triggers (copied from 20231117000001_security_tables.ts)
    --------------------------------------------------------------------------------

    create trigger audit_security_string before insert or update or delete on security_string for each row execute procedure tr_audit_trigger();
    create trigger journal_security_string after insert or update or delete on security_string for each row execute procedure tr_journal_trigger();

    create trigger audit_security_number before insert or update or delete on security_number for each row execute procedure tr_audit_trigger();
    create trigger journal_security_number after insert or update or delete on security_number for each row execute procedure tr_journal_trigger();

    create trigger audit_security_datetime before insert or update or delete on security_datetime for each row execute procedure tr_audit_trigger();
    create trigger journal_security_datetime after insert or update or delete on security_datetime for each row execute procedure tr_journal_trigger();

    create trigger audit_security_spatial before insert or update or delete on security_spatial for each row execute procedure tr_audit_trigger();
    create trigger journal_security_spatial after insert or update or delete on security_spatial for each row execute procedure tr_journal_trigger();
  `);
}
