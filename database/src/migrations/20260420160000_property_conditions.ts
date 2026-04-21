import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- ENUMS
    --------------------------------------------------------------------------------

    CREATE TYPE string_operator_type AS ENUM (
      'Equals',
      'NotEquals',
      'Like',
      'ILike',
      'StartsWith',
      'EndsWith',
      'Contains',
      'Exists'
    );

    CREATE TYPE number_operator_type AS ENUM (
      'Equals',
      'NotEquals',
      'GreaterThan',
      'GreaterThanOrEqual',
      'LessThan',
      'LessThanOrEqual',
      'Exists'
    );

    CREATE TYPE boolean_operator_type AS ENUM (
      'Equals',
      'Exists'
    );

    CREATE TYPE timestamp_operator_type AS ENUM (
      'Before',
      'After',
      'OnDate',
      'OnTime',
      'Exists'
    );

    CREATE TYPE taxon_operator_type AS ENUM (
      'Equals',
      'ParentOf',
      'ChildOf',
      'DescendsFrom',
      'AscendsFrom',
      'Exists'
    );

    CREATE TYPE geometry_operator_type AS ENUM (
      'Within',
      'Intersects',
      'Contains',
      'Exists'
    );

    CREATE TYPE code_operator_type AS ENUM (
      'Equals',
      'NotEquals',
      'Exists'
    );

    CREATE TYPE logical_operator_type AS ENUM (
      'AND',
      'OR'
    );

    --------------------------------------------------------------------------------
    -- EXPRESSION
    --------------------------------------------------------------------------------

    CREATE TABLE expression (
      expression_id uuid DEFAULT public.gen_random_uuid() NOT NULL,
      operator logical_operator_type NOT NULL,
      expression_hash text NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT expression_pk PRIMARY KEY (expression_id)
    );

    --------------------------------------------------------------------------------
    -- PREDICATE
    --------------------------------------------------------------------------------

    CREATE TABLE predicate (
      predicate_id uuid DEFAULT public.gen_random_uuid() NOT NULL,
      feature_type_property_id integer NOT NULL,
      feature_property_type_id integer NOT NULL,
      predicate_hash text NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT predicate_pk PRIMARY KEY (predicate_id),
      CONSTRAINT predicate_fk1
        FOREIGN KEY (feature_type_property_id)
        REFERENCES feature_type_property(feature_type_property_id),
      CONSTRAINT predicate_fk2
        FOREIGN KEY (feature_property_type_id)
        REFERENCES feature_property_type(feature_property_type_id)
    );

    CREATE UNIQUE INDEX expression_nuk_hash
      ON expression(expression_hash)
      WHERE record_end_date IS NULL;

    CREATE INDEX predicate_idx1 ON predicate(feature_type_property_id);
    CREATE INDEX predicate_idx2
      ON predicate(feature_type_property_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX predicate_idx3 ON predicate(feature_property_type_id);

    CREATE UNIQUE INDEX predicate_nuk_hash
      ON predicate(predicate_hash)
      WHERE record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- EXPRESSION_CLAUSE
    --------------------------------------------------------------------------------

    CREATE TABLE expression_clause (
      expression_clause_id uuid DEFAULT public.gen_random_uuid() NOT NULL,
      expression_id uuid NOT NULL,
      sequence integer NOT NULL,
      predicate_id uuid,
      child_expression_id uuid,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT expression_clause_pk PRIMARY KEY (expression_clause_id),
      CONSTRAINT expression_clause_fk1
        FOREIGN KEY (expression_id)
        REFERENCES expression(expression_id)
        ON DELETE CASCADE,
      CONSTRAINT expression_clause_fk2
        FOREIGN KEY (predicate_id)
        REFERENCES predicate(predicate_id)
        ON DELETE CASCADE,
      CONSTRAINT expression_clause_fk3
        FOREIGN KEY (child_expression_id)
        REFERENCES expression(expression_id)
        ON DELETE CASCADE,
      CONSTRAINT expression_clause_ck1 CHECK (sequence > 0),
      CONSTRAINT expression_clause_ck2
        CHECK (
          (predicate_id IS NOT NULL AND child_expression_id IS NULL)
          OR (predicate_id IS NULL AND child_expression_id IS NOT NULL)
        ),
      CONSTRAINT expression_clause_ck3 CHECK (child_expression_id IS NULL OR child_expression_id <> expression_id)
    );

    CREATE INDEX expression_clause_idx1 ON expression_clause(expression_id);
    CREATE INDEX expression_clause_idx2 ON expression_clause(predicate_id);
    CREATE INDEX expression_clause_idx3 ON expression_clause(child_expression_id);
    CREATE INDEX expression_clause_idx4 ON expression_clause(expression_id, sequence);
    CREATE INDEX expression_clause_idx5
      ON expression_clause(expression_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX expression_clause_idx6
      ON expression_clause(predicate_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX expression_clause_idx7
      ON expression_clause(child_expression_id)
      WHERE record_end_date IS NULL;

    CREATE UNIQUE INDEX expression_clause_nuk1
      ON expression_clause(expression_id, sequence)
      WHERE record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- PREDICATE_STRING
    --------------------------------------------------------------------------------

    CREATE TABLE predicate_string (
      predicate_string_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
      predicate_id uuid NOT NULL,
      value varchar(250),
      operator string_operator_type NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT predicate_string_pk PRIMARY KEY (predicate_string_id),
      CONSTRAINT predicate_string_fk1
        FOREIGN KEY (predicate_id)
        REFERENCES predicate(predicate_id)
        ON DELETE CASCADE,
      CONSTRAINT predicate_string_ck1 CHECK (
        (operator = 'Exists' AND value IS NULL) OR
        (operator <> 'Exists' AND value IS NOT NULL)
      )
    );

    CREATE UNIQUE INDEX predicate_string_nuk1
      ON predicate_string(predicate_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX predicate_string_idx1 ON predicate_string(predicate_id);
    CREATE INDEX predicate_string_idx2 ON predicate_string(operator);
    CREATE INDEX predicate_string_idx3 ON predicate_string(value);
    CREATE INDEX predicate_string_idx4
      ON predicate_string(operator, value)
      WHERE record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- PREDICATE_NUMBER
    --------------------------------------------------------------------------------

    CREATE TABLE predicate_number (
      predicate_number_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
      predicate_id uuid NOT NULL,
      value numeric,
      operator number_operator_type NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT predicate_number_pk PRIMARY KEY (predicate_number_id),
      CONSTRAINT predicate_number_fk1
        FOREIGN KEY (predicate_id)
        REFERENCES predicate(predicate_id)
        ON DELETE CASCADE,
      CONSTRAINT predicate_number_ck1 CHECK (
        (operator = 'Exists' AND value IS NULL) OR
        (operator <> 'Exists' AND value IS NOT NULL)
      )
    );

    CREATE UNIQUE INDEX predicate_number_nuk1
      ON predicate_number(predicate_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX predicate_number_idx1 ON predicate_number(predicate_id);
    CREATE INDEX predicate_number_idx2 ON predicate_number(operator);
    CREATE INDEX predicate_number_idx3 ON predicate_number(value);
    CREATE INDEX predicate_number_idx4
      ON predicate_number(operator, value)
      WHERE record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- PREDICATE_BOOLEAN
    --------------------------------------------------------------------------------

    CREATE TABLE predicate_boolean (
      predicate_boolean_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
      predicate_id uuid NOT NULL,
      value boolean,
      operator boolean_operator_type NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT predicate_boolean_pk PRIMARY KEY (predicate_boolean_id),
      CONSTRAINT predicate_boolean_fk1
        FOREIGN KEY (predicate_id)
        REFERENCES predicate(predicate_id)
        ON DELETE CASCADE,
      CONSTRAINT predicate_boolean_ck1 CHECK (
        (operator = 'Exists' AND value IS NULL) OR
        (operator <> 'Exists' AND value IS NOT NULL)
      )
    );

    CREATE UNIQUE INDEX predicate_boolean_nuk1
      ON predicate_boolean(predicate_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX predicate_boolean_idx1 ON predicate_boolean(predicate_id);
    CREATE INDEX predicate_boolean_idx2 ON predicate_boolean(operator);
    CREATE INDEX predicate_boolean_idx3 ON predicate_boolean(value);
    CREATE INDEX predicate_boolean_idx4
      ON predicate_boolean(operator, value)
      WHERE record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- PREDICATE_TIMESTAMP
    --------------------------------------------------------------------------------

    CREATE TABLE predicate_timestamp (
      predicate_timestamp_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
      predicate_id uuid NOT NULL,
      date_value date,
      time_value timetz(6),
      operator timestamp_operator_type NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT predicate_timestamp_pk PRIMARY KEY (predicate_timestamp_id),
      CONSTRAINT predicate_timestamp_fk1
        FOREIGN KEY (predicate_id)
        REFERENCES predicate(predicate_id)
        ON DELETE CASCADE,
      CONSTRAINT predicate_timestamp_ck1 CHECK (
        (operator = 'Exists' AND date_value IS NULL AND time_value IS NULL) OR
        (operator <> 'Exists' AND (date_value IS NOT NULL OR time_value IS NOT NULL))
      ),
      CONSTRAINT predicate_timestamp_ck2 CHECK (
        operator <> 'OnDate' OR (date_value IS NOT NULL AND time_value IS NULL)
      ),
      CONSTRAINT predicate_timestamp_ck3 CHECK (
        operator <> 'OnTime' OR (time_value IS NOT NULL AND date_value IS NULL)
      )
    );

    CREATE UNIQUE INDEX predicate_timestamp_nuk1
      ON predicate_timestamp(predicate_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX predicate_timestamp_idx1 ON predicate_timestamp(predicate_id);
    CREATE INDEX predicate_timestamp_idx2 ON predicate_timestamp(operator);
    CREATE INDEX predicate_timestamp_idx3 ON predicate_timestamp(date_value);
    CREATE INDEX predicate_timestamp_idx4 ON predicate_timestamp(time_value);
    CREATE INDEX predicate_timestamp_idx5
      ON predicate_timestamp(operator, date_value, time_value)
      WHERE record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- PREDICATE_TAXON
    --------------------------------------------------------------------------------

    CREATE TABLE predicate_taxon (
      predicate_taxon_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
      predicate_id uuid NOT NULL,
      taxon_id integer,
      operator taxon_operator_type NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT predicate_taxon_pk PRIMARY KEY (predicate_taxon_id),
      CONSTRAINT predicate_taxon_fk1
        FOREIGN KEY (predicate_id)
        REFERENCES predicate(predicate_id)
        ON DELETE CASCADE,
      CONSTRAINT predicate_taxon_fk2
        FOREIGN KEY (taxon_id)
        REFERENCES taxon(taxon_id),
      CONSTRAINT predicate_taxon_ck1 CHECK (
        (operator = 'Exists' AND taxon_id IS NULL) OR
        (operator <> 'Exists' AND taxon_id IS NOT NULL)
      )
    );

    CREATE UNIQUE INDEX predicate_taxon_nuk1
      ON predicate_taxon(predicate_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX predicate_taxon_idx1 ON predicate_taxon(predicate_id);
    CREATE INDEX predicate_taxon_idx2 ON predicate_taxon(operator);
    CREATE INDEX predicate_taxon_idx3 ON predicate_taxon(taxon_id);
    CREATE INDEX predicate_taxon_idx4
      ON predicate_taxon(operator, taxon_id)
      WHERE record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- PREDICATE_GEOMETRY
    --------------------------------------------------------------------------------

    CREATE TABLE predicate_geometry (
      predicate_geometry_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
      predicate_id uuid NOT NULL,
      value geometry,
      operator geometry_operator_type NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT predicate_geometry_pk PRIMARY KEY (predicate_geometry_id),
      CONSTRAINT predicate_geometry_fk1
        FOREIGN KEY (predicate_id)
        REFERENCES predicate(predicate_id)
        ON DELETE CASCADE,
      CONSTRAINT predicate_geometry_ck1 CHECK (
        (operator = 'Exists' AND value IS NULL) OR
        (operator <> 'Exists' AND value IS NOT NULL)
      )
    );

    CREATE UNIQUE INDEX predicate_geometry_nuk1
      ON predicate_geometry(predicate_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX predicate_geometry_idx1 ON predicate_geometry(predicate_id);
    CREATE INDEX predicate_geometry_idx2 ON predicate_geometry(operator);
    CREATE INDEX predicate_geometry_idx3 ON predicate_geometry USING GIST(value);
    CREATE INDEX predicate_geometry_idx4
      ON predicate_geometry(operator)
      WHERE record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- PREDICATE_CODE
    --------------------------------------------------------------------------------

    CREATE TABLE predicate_code (
      predicate_code_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
      predicate_id uuid NOT NULL,
      contributor_codeset_code_id integer,
      operator code_operator_type NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT predicate_code_pk PRIMARY KEY (predicate_code_id),
      CONSTRAINT predicate_code_fk1
        FOREIGN KEY (predicate_id)
        REFERENCES predicate(predicate_id)
        ON DELETE CASCADE,
      CONSTRAINT predicate_code_fk2
        FOREIGN KEY (contributor_codeset_code_id)
        REFERENCES contributor_codeset_code(contributor_codeset_code_id),
      CONSTRAINT predicate_code_ck1 CHECK (
        (operator = 'Exists' AND contributor_codeset_code_id IS NULL) OR
        (operator <> 'Exists' AND contributor_codeset_code_id IS NOT NULL)
      )
    );

    CREATE UNIQUE INDEX predicate_code_nuk1
      ON predicate_code(predicate_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX predicate_code_idx1 ON predicate_code(predicate_id);
    CREATE INDEX predicate_code_idx2 ON predicate_code(operator);
    CREATE INDEX predicate_code_idx3 ON predicate_code(contributor_codeset_code_id);
    CREATE INDEX predicate_code_idx4
      ON predicate_code(operator, contributor_codeset_code_id)
      WHERE record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- OWNER EXPRESSION TABLES
    --------------------------------------------------------------------------------

    --------------------------------------------------------------------------------
    -- DOWNLOAD_EXPRESSION
    --------------------------------------------------------------------------------

    CREATE TABLE download_expression (
      download_expression_id uuid DEFAULT public.gen_random_uuid() NOT NULL,
      download_id uuid NOT NULL,
      expression_id uuid NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT download_expression_pk PRIMARY KEY (download_expression_id),
      CONSTRAINT download_expression_fk1
        FOREIGN KEY (download_id)
        REFERENCES download(download_id)
        ON DELETE CASCADE,
      CONSTRAINT download_expression_fk2
        FOREIGN KEY (expression_id)
        REFERENCES expression(expression_id)
        ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX download_expression_nuk1
      ON download_expression(download_id, expression_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX download_expression_idx1 ON download_expression(download_id);
    CREATE INDEX download_expression_idx2 ON download_expression(expression_id);
    CREATE INDEX download_expression_idx3
      ON download_expression(expression_id)
      WHERE record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- POLICY_STATEMENT_CONDITION_EXPRESSION
    --------------------------------------------------------------------------------

    CREATE TABLE policy_statement_condition_expression (
      policy_statement_condition_expression_id uuid DEFAULT public.gen_random_uuid() NOT NULL,
      policy_statement_condition_id uuid NOT NULL,
      expression_id uuid NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT policy_statement_condition_expression_pk PRIMARY KEY (policy_statement_condition_expression_id),
      CONSTRAINT policy_statement_condition_expression_fk1
        FOREIGN KEY (policy_statement_condition_id)
        REFERENCES policy_statement_condition(policy_statement_condition_id)
        ON DELETE CASCADE,
      CONSTRAINT policy_statement_condition_expression_fk2
        FOREIGN KEY (expression_id)
        REFERENCES expression(expression_id)
        ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX policy_statement_condition_expression_nuk1
      ON policy_statement_condition_expression(policy_statement_condition_id, expression_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX policy_statement_condition_expression_idx1 ON policy_statement_condition_expression(policy_statement_condition_id);
    CREATE INDEX policy_statement_condition_expression_idx2 ON policy_statement_condition_expression(expression_id);
    CREATE INDEX policy_statement_condition_expression_idx3
      ON policy_statement_condition_expression(expression_id)
      WHERE record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- POLICY_STATEMENT_EXPRESSION
    --------------------------------------------------------------------------------

    CREATE TABLE policy_statement_expression (
      policy_statement_expression_id uuid DEFAULT public.gen_random_uuid() NOT NULL,
      policy_statement_id uuid NOT NULL,
      expression_id uuid NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT policy_statement_expression_pk PRIMARY KEY (policy_statement_expression_id),
      CONSTRAINT policy_statement_expression_fk1
        FOREIGN KEY (policy_statement_id)
        REFERENCES policy_statement(policy_statement_id)
        ON DELETE CASCADE,
      CONSTRAINT policy_statement_expression_fk2
        FOREIGN KEY (expression_id)
        REFERENCES expression(expression_id)
        ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX policy_statement_expression_nuk1
      ON policy_statement_expression(policy_statement_id, expression_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX policy_statement_expression_idx1 ON policy_statement_expression(policy_statement_id);
    CREATE INDEX policy_statement_expression_idx2 ON policy_statement_expression(expression_id);
    CREATE INDEX policy_statement_expression_idx3
      ON policy_statement_expression(expression_id)
      WHERE record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- SECURITY_RULE_EXPRESSION
    --------------------------------------------------------------------------------

    CREATE TABLE security_rule_expression (
      security_rule_expression_id uuid DEFAULT public.gen_random_uuid() NOT NULL,
      security_rule_id integer NOT NULL,
      expression_id uuid NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT security_rule_expression_pk PRIMARY KEY (security_rule_expression_id),
      CONSTRAINT security_rule_expression_fk1
        FOREIGN KEY (security_rule_id)
        REFERENCES security_rule(security_rule_id)
        ON DELETE CASCADE,
      CONSTRAINT security_rule_expression_fk2
        FOREIGN KEY (expression_id)
        REFERENCES expression(expression_id)
        ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX security_rule_expression_nuk1
      ON security_rule_expression(security_rule_id, expression_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX security_rule_expression_idx1 ON security_rule_expression(security_rule_id);
    CREATE INDEX security_rule_expression_idx2 ON security_rule_expression(expression_id);
    CREATE INDEX security_rule_expression_idx3
      ON security_rule_expression(expression_id)
      WHERE record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- COMMENTS
    --------------------------------------------------------------------------------

    COMMENT ON TABLE expression IS 'Reusable logical expression node that can be owned by domain entities or nested within other expressions.';
    COMMENT ON COLUMN expression.expression_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN expression.operator IS 'Logical operator used to combine this expression''s ordered clauses.';
    COMMENT ON COLUMN expression.expression_hash IS 'Canonical SHA-256 hash of normalized ordered expression structure (operator + ordered child links). Used for immutable deduplication.';
    COMMENT ON COLUMN expression.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN expression.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN expression.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN expression.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN expression.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN expression.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE predicate IS 'Stable anchor table representing a reusable predicate against a feature type property.';
    COMMENT ON COLUMN predicate.predicate_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN predicate.feature_type_property_id IS 'Foreign key to feature_type_property; identifies the property this predicate evaluates.';
    COMMENT ON COLUMN predicate.feature_property_type_id IS 'Foreign key to feature_property_type indicating the predicate value type. Active predicate must resolve to exactly one matching typed payload row.';
    COMMENT ON COLUMN predicate.predicate_hash IS 'Canonical SHA-256 hash of normalized predicate semantics (property id, type, operator, value). Used for immutable deduplication.';
    COMMENT ON COLUMN predicate.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN predicate.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN predicate.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN predicate.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN predicate.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN predicate.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE expression_clause IS 'Ordered clause rows that connect an expression to either a predicate or child expression.';
    COMMENT ON COLUMN expression_clause.expression_clause_id IS 'System generated UUID primary key identifier.';
    COMMENT ON COLUMN expression_clause.expression_id IS 'Foreign key to parent expression.';
    COMMENT ON COLUMN expression_clause.sequence IS 'Sibling ordering in the parent expression.';
    COMMENT ON COLUMN expression_clause.predicate_id IS 'Foreign key to reusable predicate. Exactly one of predicate_id or child_expression_id must be set.';
    COMMENT ON COLUMN expression_clause.child_expression_id IS 'Foreign key to reusable child expression. Exactly one of predicate_id or child_expression_id must be set.';
    COMMENT ON COLUMN expression_clause.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN expression_clause.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN expression_clause.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN expression_clause.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN expression_clause.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN expression_clause.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE predicate_string IS 'Typed predicate payload table for string comparisons.';
    COMMENT ON COLUMN predicate_string.predicate_string_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN predicate_string.predicate_id IS 'Foreign key to predicate table.';
    COMMENT ON COLUMN predicate_string.value IS 'String comparison value; null only when operator is Exists.';
    COMMENT ON COLUMN predicate_string.operator IS 'Comparison operator for the string predicate.';
    COMMENT ON COLUMN predicate_string.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN predicate_string.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN predicate_string.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN predicate_string.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN predicate_string.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN predicate_string.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE predicate_number IS 'Typed predicate payload table for numeric comparisons.';
    COMMENT ON COLUMN predicate_number.predicate_number_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN predicate_number.predicate_id IS 'Foreign key to predicate table.';
    COMMENT ON COLUMN predicate_number.value IS 'Numeric comparison value; null only when operator is Exists.';
    COMMENT ON COLUMN predicate_number.operator IS 'Comparison operator for the numeric predicate.';
    COMMENT ON COLUMN predicate_number.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN predicate_number.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN predicate_number.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN predicate_number.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN predicate_number.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN predicate_number.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE predicate_boolean IS 'Typed predicate payload table for boolean comparisons.';
    COMMENT ON COLUMN predicate_boolean.predicate_boolean_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN predicate_boolean.predicate_id IS 'Foreign key to predicate table.';
    COMMENT ON COLUMN predicate_boolean.value IS 'Boolean comparison value; null only when operator is Exists.';
    COMMENT ON COLUMN predicate_boolean.operator IS 'Comparison operator for the boolean predicate.';
    COMMENT ON COLUMN predicate_boolean.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN predicate_boolean.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN predicate_boolean.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN predicate_boolean.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN predicate_boolean.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN predicate_boolean.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE predicate_timestamp IS 'Typed predicate payload table for timestamp comparisons.';
    COMMENT ON COLUMN predicate_timestamp.predicate_timestamp_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN predicate_timestamp.predicate_id IS 'Foreign key to predicate table.';
    COMMENT ON COLUMN predicate_timestamp.date_value IS 'Optional date component for date-only or combined date/time timestamp predicates; null-only allowed for Exists or time-only shapes.';
    COMMENT ON COLUMN predicate_timestamp.time_value IS 'Optional time with timezone component for time-only recurring rules or combined date/time predicates; null-only allowed for Exists or date-only shapes.';
    COMMENT ON COLUMN predicate_timestamp.operator IS 'Comparison operator for the timestamp predicate (Before, After, OnDate, OnTime, Exists).';
    COMMENT ON COLUMN predicate_timestamp.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN predicate_timestamp.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN predicate_timestamp.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN predicate_timestamp.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN predicate_timestamp.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN predicate_timestamp.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE predicate_taxon IS 'Typed predicate payload table for taxon comparisons.';
    COMMENT ON COLUMN predicate_taxon.predicate_taxon_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN predicate_taxon.predicate_id IS 'Foreign key to predicate table.';
    COMMENT ON COLUMN predicate_taxon.taxon_id IS 'Foreign key to taxon; taxon comparison value, null only when operator is Exists.';
    COMMENT ON COLUMN predicate_taxon.operator IS 'Comparison operator for the taxon predicate.';
    COMMENT ON COLUMN predicate_taxon.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN predicate_taxon.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN predicate_taxon.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN predicate_taxon.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN predicate_taxon.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN predicate_taxon.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE predicate_geometry IS 'Typed predicate payload table for geometry comparisons.';
    COMMENT ON COLUMN predicate_geometry.predicate_geometry_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN predicate_geometry.predicate_id IS 'Foreign key to predicate table.';
    COMMENT ON COLUMN predicate_geometry.value IS 'Geometry comparison value; null only when operator is Exists.';
    COMMENT ON COLUMN predicate_geometry.operator IS 'Comparison operator for the geometry predicate.';
    COMMENT ON COLUMN predicate_geometry.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN predicate_geometry.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN predicate_geometry.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN predicate_geometry.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN predicate_geometry.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN predicate_geometry.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE predicate_code IS 'Typed predicate payload table for coded value comparisons.';
    COMMENT ON COLUMN predicate_code.predicate_code_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN predicate_code.predicate_id IS 'Foreign key to predicate table.';
    COMMENT ON COLUMN predicate_code.contributor_codeset_code_id IS 'Foreign key to contributor_codeset_code; code comparison value, null only when operator is Exists.';
    COMMENT ON COLUMN predicate_code.operator IS 'Comparison operator for the code predicate.';
    COMMENT ON COLUMN predicate_code.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN predicate_code.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN predicate_code.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN predicate_code.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN predicate_code.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN predicate_code.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE download_expression IS 'Join table linking a download to a root expression. Only active root expressions (no active parent) are allowed.';
    COMMENT ON COLUMN download_expression.download_expression_id IS 'System generated UUID surrogate primary key identifier.';
    COMMENT ON COLUMN download_expression.download_id IS 'Foreign key to download.';
    COMMENT ON COLUMN download_expression.expression_id IS 'Foreign key to root expression.';
    COMMENT ON COLUMN download_expression.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN download_expression.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN download_expression.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN download_expression.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN download_expression.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN download_expression.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE policy_statement_condition_expression IS 'Join table linking a policy statement condition to a root expression. Only active root expressions (no active parent) are allowed.';
    COMMENT ON COLUMN policy_statement_condition_expression.policy_statement_condition_expression_id IS 'System generated UUID surrogate primary key identifier.';
    COMMENT ON COLUMN policy_statement_condition_expression.policy_statement_condition_id IS 'Foreign key to policy_statement_condition.';
    COMMENT ON COLUMN policy_statement_condition_expression.expression_id IS 'Foreign key to root expression.';
    COMMENT ON COLUMN policy_statement_condition_expression.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN policy_statement_condition_expression.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN policy_statement_condition_expression.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN policy_statement_condition_expression.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN policy_statement_condition_expression.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN policy_statement_condition_expression.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE policy_statement_expression IS 'Join table linking a policy statement to a root expression. Only active root expressions (no active parent) are allowed.';
    COMMENT ON COLUMN policy_statement_expression.policy_statement_expression_id IS 'System generated UUID surrogate primary key identifier.';
    COMMENT ON COLUMN policy_statement_expression.policy_statement_id IS 'Foreign key to policy_statement.';
    COMMENT ON COLUMN policy_statement_expression.expression_id IS 'Foreign key to root expression.';
    COMMENT ON COLUMN policy_statement_expression.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN policy_statement_expression.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN policy_statement_expression.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN policy_statement_expression.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN policy_statement_expression.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN policy_statement_expression.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE security_rule_expression IS 'Join table linking a security rule to a root expression. Only active root expressions (no active parent) are allowed.';
    COMMENT ON COLUMN security_rule_expression.security_rule_expression_id IS 'System generated UUID surrogate primary key identifier.';
    COMMENT ON COLUMN security_rule_expression.security_rule_id IS 'Foreign key to security_rule.';
    COMMENT ON COLUMN security_rule_expression.expression_id IS 'Foreign key to root expression.';
    COMMENT ON COLUMN security_rule_expression.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN security_rule_expression.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN security_rule_expression.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN security_rule_expression.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN security_rule_expression.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN security_rule_expression.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --
    -- Convention in this codebase: operational tables use tr_audit_trigger +
    -- tr_journal_trigger to keep create/update metadata and append journal rows.
    --------------------------------------------------------------------------------
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_expression
      BEFORE INSERT OR UPDATE OR DELETE ON expression
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_expression
      AFTER INSERT OR UPDATE OR DELETE ON expression
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_predicate
      BEFORE INSERT OR UPDATE OR DELETE ON predicate
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_predicate
      AFTER INSERT OR UPDATE OR DELETE ON predicate
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_expression_clause
      BEFORE INSERT OR UPDATE OR DELETE ON expression_clause
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_expression_clause
      AFTER INSERT OR UPDATE OR DELETE ON expression_clause
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_predicate_string
      BEFORE INSERT OR UPDATE OR DELETE ON predicate_string
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_predicate_string
      AFTER INSERT OR UPDATE OR DELETE ON predicate_string
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_predicate_number
      BEFORE INSERT OR UPDATE OR DELETE ON predicate_number
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_predicate_number
      AFTER INSERT OR UPDATE OR DELETE ON predicate_number
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_predicate_boolean
      BEFORE INSERT OR UPDATE OR DELETE ON predicate_boolean
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_predicate_boolean
      AFTER INSERT OR UPDATE OR DELETE ON predicate_boolean
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_predicate_timestamp
      BEFORE INSERT OR UPDATE OR DELETE ON predicate_timestamp
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_predicate_timestamp
      AFTER INSERT OR UPDATE OR DELETE ON predicate_timestamp
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_predicate_taxon
      BEFORE INSERT OR UPDATE OR DELETE ON predicate_taxon
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_predicate_taxon
      AFTER INSERT OR UPDATE OR DELETE ON predicate_taxon
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_predicate_geometry
      BEFORE INSERT OR UPDATE OR DELETE ON predicate_geometry
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_predicate_geometry
      AFTER INSERT OR UPDATE OR DELETE ON predicate_geometry
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_predicate_code
      BEFORE INSERT OR UPDATE OR DELETE ON predicate_code
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_predicate_code
      AFTER INSERT OR UPDATE OR DELETE ON predicate_code
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_download_expression
      BEFORE INSERT OR UPDATE OR DELETE ON download_expression
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_download_expression
      AFTER INSERT OR UPDATE OR DELETE ON download_expression
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_policy_statement_condition_expression
      BEFORE INSERT OR UPDATE OR DELETE ON policy_statement_condition_expression
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_policy_statement_condition_expression
      AFTER INSERT OR UPDATE OR DELETE ON policy_statement_condition_expression
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_policy_statement_expression
      BEFORE INSERT OR UPDATE OR DELETE ON policy_statement_expression
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_policy_statement_expression
      AFTER INSERT OR UPDATE OR DELETE ON policy_statement_expression
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_security_rule_expression
      BEFORE INSERT OR UPDATE OR DELETE ON security_rule_expression
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_security_rule_expression
      AFTER INSERT OR UPDATE OR DELETE ON security_rule_expression
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- DOWN order notes:
    -- 1) Drop triggers first (they depend on tables).
    -- 2) Drop indexes.
    -- 3) Drop tables in dependency order (children before parents).
    -- 4) Drop enum types last.
    --------------------------------------------------------------------------------

    --------------------------------------------------------------------------------
    -- DROP TRIGGERS
    --------------------------------------------------------------------------------

    DROP TRIGGER IF EXISTS journal_security_rule_expression ON security_rule_expression;
    DROP TRIGGER IF EXISTS audit_security_rule_expression ON security_rule_expression;
    DROP TRIGGER IF EXISTS journal_policy_statement_condition_expression ON policy_statement_condition_expression;
    DROP TRIGGER IF EXISTS audit_policy_statement_condition_expression ON policy_statement_condition_expression;
    DROP TRIGGER IF EXISTS journal_policy_statement_expression ON policy_statement_expression;
    DROP TRIGGER IF EXISTS audit_policy_statement_expression ON policy_statement_expression;
    DROP TRIGGER IF EXISTS journal_download_expression ON download_expression;
    DROP TRIGGER IF EXISTS audit_download_expression ON download_expression;

    DROP TRIGGER IF EXISTS journal_predicate_code ON predicate_code;
    DROP TRIGGER IF EXISTS audit_predicate_code ON predicate_code;
    DROP TRIGGER IF EXISTS journal_predicate_geometry ON predicate_geometry;
    DROP TRIGGER IF EXISTS audit_predicate_geometry ON predicate_geometry;
    DROP TRIGGER IF EXISTS journal_predicate_taxon ON predicate_taxon;
    DROP TRIGGER IF EXISTS audit_predicate_taxon ON predicate_taxon;
    DROP TRIGGER IF EXISTS journal_predicate_timestamp ON predicate_timestamp;
    DROP TRIGGER IF EXISTS audit_predicate_timestamp ON predicate_timestamp;
    DROP TRIGGER IF EXISTS journal_predicate_boolean ON predicate_boolean;
    DROP TRIGGER IF EXISTS audit_predicate_boolean ON predicate_boolean;
    DROP TRIGGER IF EXISTS journal_predicate_number ON predicate_number;
    DROP TRIGGER IF EXISTS audit_predicate_number ON predicate_number;
    DROP TRIGGER IF EXISTS journal_predicate_string ON predicate_string;
    DROP TRIGGER IF EXISTS audit_predicate_string ON predicate_string;

    DROP TRIGGER IF EXISTS journal_expression_clause ON expression_clause;
    DROP TRIGGER IF EXISTS audit_expression_clause ON expression_clause;
    DROP TRIGGER IF EXISTS journal_predicate ON predicate;
    DROP TRIGGER IF EXISTS audit_predicate ON predicate;
    DROP TRIGGER IF EXISTS journal_expression ON expression;
    DROP TRIGGER IF EXISTS audit_expression ON expression;

    --------------------------------------------------------------------------------
    -- DROP INDEXES
    --------------------------------------------------------------------------------

    DROP INDEX IF EXISTS security_rule_expression_nuk1;
    DROP INDEX IF EXISTS security_rule_expression_idx3;
    DROP INDEX IF EXISTS security_rule_expression_idx2;
    DROP INDEX IF EXISTS security_rule_expression_idx1;

    DROP INDEX IF EXISTS policy_statement_condition_expression_nuk1;
    DROP INDEX IF EXISTS policy_statement_condition_expression_idx3;
    DROP INDEX IF EXISTS policy_statement_condition_expression_idx2;
    DROP INDEX IF EXISTS policy_statement_condition_expression_idx1;

    DROP INDEX IF EXISTS policy_statement_expression_nuk1;
    DROP INDEX IF EXISTS policy_statement_expression_idx3;
    DROP INDEX IF EXISTS policy_statement_expression_idx2;
    DROP INDEX IF EXISTS policy_statement_expression_idx1;

    DROP INDEX IF EXISTS download_expression_nuk1;
    DROP INDEX IF EXISTS download_expression_idx3;
    DROP INDEX IF EXISTS download_expression_idx2;
    DROP INDEX IF EXISTS download_expression_idx1;

    DROP INDEX IF EXISTS predicate_code_nuk1;
    DROP INDEX IF EXISTS predicate_code_idx4;
    DROP INDEX IF EXISTS predicate_code_idx3;
    DROP INDEX IF EXISTS predicate_code_idx2;
    DROP INDEX IF EXISTS predicate_code_idx1;

    DROP INDEX IF EXISTS predicate_geometry_nuk1;
    DROP INDEX IF EXISTS predicate_geometry_idx4;
    DROP INDEX IF EXISTS predicate_geometry_idx3;
    DROP INDEX IF EXISTS predicate_geometry_idx2;
    DROP INDEX IF EXISTS predicate_geometry_idx1;

    DROP INDEX IF EXISTS predicate_taxon_nuk1;
    DROP INDEX IF EXISTS predicate_taxon_idx4;
    DROP INDEX IF EXISTS predicate_taxon_idx3;
    DROP INDEX IF EXISTS predicate_taxon_idx2;
    DROP INDEX IF EXISTS predicate_taxon_idx1;

    DROP INDEX IF EXISTS predicate_timestamp_nuk1;
    DROP INDEX IF EXISTS predicate_timestamp_idx5;
    DROP INDEX IF EXISTS predicate_timestamp_idx4;
    DROP INDEX IF EXISTS predicate_timestamp_idx3;
    DROP INDEX IF EXISTS predicate_timestamp_idx2;
    DROP INDEX IF EXISTS predicate_timestamp_idx1;

    DROP INDEX IF EXISTS predicate_boolean_nuk1;
    DROP INDEX IF EXISTS predicate_boolean_idx4;
    DROP INDEX IF EXISTS predicate_boolean_idx3;
    DROP INDEX IF EXISTS predicate_boolean_idx2;
    DROP INDEX IF EXISTS predicate_boolean_idx1;

    DROP INDEX IF EXISTS predicate_number_nuk1;
    DROP INDEX IF EXISTS predicate_number_idx4;
    DROP INDEX IF EXISTS predicate_number_idx3;
    DROP INDEX IF EXISTS predicate_number_idx2;
    DROP INDEX IF EXISTS predicate_number_idx1;

    DROP INDEX IF EXISTS predicate_string_nuk1;
    DROP INDEX IF EXISTS predicate_string_idx4;
    DROP INDEX IF EXISTS predicate_string_idx3;
    DROP INDEX IF EXISTS predicate_string_idx2;
    DROP INDEX IF EXISTS predicate_string_idx1;

    DROP INDEX IF EXISTS expression_clause_nuk1;
    DROP INDEX IF EXISTS expression_clause_idx7;
    DROP INDEX IF EXISTS expression_clause_idx6;
    DROP INDEX IF EXISTS expression_clause_idx5;
    DROP INDEX IF EXISTS expression_clause_idx4;
    DROP INDEX IF EXISTS expression_clause_idx3;
    DROP INDEX IF EXISTS expression_clause_idx2;
    DROP INDEX IF EXISTS expression_clause_idx1;

    DROP INDEX IF EXISTS predicate_nuk_hash;
    DROP INDEX IF EXISTS expression_nuk_hash;

    DROP INDEX IF EXISTS predicate_idx2;
    DROP INDEX IF EXISTS predicate_idx1;
    DROP INDEX IF EXISTS predicate_idx3;

    --------------------------------------------------------------------------------
    -- DROP TABLES
    --------------------------------------------------------------------------------

    DROP TABLE IF EXISTS security_rule_expression;
    DROP TABLE IF EXISTS policy_statement_expression;
    DROP TABLE IF EXISTS policy_statement_condition_expression;
    DROP TABLE IF EXISTS download_expression;

    DROP TABLE IF EXISTS predicate_code;
    DROP TABLE IF EXISTS predicate_geometry;
    DROP TABLE IF EXISTS predicate_taxon;
    DROP TABLE IF EXISTS predicate_timestamp;
    DROP TABLE IF EXISTS predicate_boolean;
    DROP TABLE IF EXISTS predicate_number;
    DROP TABLE IF EXISTS predicate_string;

    DROP TABLE IF EXISTS expression_clause;
    DROP TABLE IF EXISTS predicate;
    DROP TABLE IF EXISTS expression;

    --------------------------------------------------------------------------------
    -- DROP ENUM TYPES
    --------------------------------------------------------------------------------

    DROP TYPE IF EXISTS logical_operator_type;
    DROP TYPE IF EXISTS code_operator_type;
    DROP TYPE IF EXISTS geometry_operator_type;
    DROP TYPE IF EXISTS taxon_operator_type;
    DROP TYPE IF EXISTS timestamp_operator_type;
    DROP TYPE IF EXISTS boolean_operator_type;
    DROP TYPE IF EXISTS number_operator_type;
    DROP TYPE IF EXISTS string_operator_type;

  `);
}
