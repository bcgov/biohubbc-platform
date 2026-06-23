import { Knex } from 'knex';

/**
 * Introduce policy_expression as the policy-owned expression identity.
 *
 * This migration creates the policy_expression table, backfills active
 * policy_statement_expression rows, merges multiple active expressions with AND,
 * enforces one active expression link per statement, and drops legacy policy
 * condition tables.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Create the policy_expression table.
    ----------------------------------------------------------------------------------------
    CREATE TABLE policy_expression (
      policy_expression_id uuid DEFAULT public.gen_random_uuid() NOT NULL,
      policy_id uuid NOT NULL,
      expression_id uuid NOT NULL,
      name varchar(100),
      description varchar(1000),
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT policy_expression_pk PRIMARY KEY (policy_expression_id),
      CONSTRAINT policy_expression_fk1
        FOREIGN KEY (policy_id)
        REFERENCES policy(policy_id)
        ON DELETE CASCADE,
      CONSTRAINT policy_expression_fk2
        FOREIGN KEY (expression_id)
        REFERENCES expression(expression_id)
        ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX policy_expression_nuk1
      ON policy_expression(policy_id, expression_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX policy_expression_idx1 ON policy_expression(policy_id);
    CREATE INDEX policy_expression_idx2 ON policy_expression(expression_id);
    CREATE INDEX policy_expression_idx3
      ON policy_expression(policy_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX policy_expression_idx4
      ON policy_expression(expression_id)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE policy_expression IS 'Policy-owned expression identity linking a policy to a reusable root expression.';
    COMMENT ON COLUMN policy_expression.policy_expression_id IS 'System generated UUID surrogate primary key identifier.';
    COMMENT ON COLUMN policy_expression.policy_id IS 'Foreign key to policy.';
    COMMENT ON COLUMN policy_expression.expression_id IS 'Foreign key to root expression.';
    COMMENT ON COLUMN policy_expression.name IS 'Human-readable policy expression name.';
    COMMENT ON COLUMN policy_expression.description IS 'Optional human-readable policy expression description.';
    COMMENT ON COLUMN policy_expression.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN policy_expression.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN policy_expression.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN policy_expression.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN policy_expression.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN policy_expression.revision_count IS 'Revision count used for concurrency control.';

    CREATE TRIGGER audit_policy_expression
      BEFORE INSERT OR UPDATE OR DELETE ON policy_expression
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_policy_expression
      AFTER INSERT OR UPDATE OR DELETE ON policy_expression
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- 2. Add the future policy_expression reference to policy_statement_expression.
    --
    -- This stays nullable until the backfill below populates active rows and adds the active-row
    -- check constraint.
    ----------------------------------------------------------------------------------------
    ALTER TABLE policy_statement_expression
      ADD COLUMN policy_expression_id uuid;

    ----------------------------------------------------------------------------------------
    -- 3. End stale active statement-expression links whose parent policy, statement, or
    --    expression is inactive.
    --
    -- The new active-row constraint below is defined on policy_statement_expression itself.
    -- Old service deletes soft-ended parents without soft-ending child expression links, so
    -- normalize those stale links before the active-only backfill.
    ----------------------------------------------------------------------------------------
    UPDATE policy_statement_expression pse
    SET record_end_date = now()
    FROM policy_statement ps,
      policy p,
      expression e
    WHERE ps.policy_statement_id = pse.policy_statement_id
      AND p.policy_id = ps.policy_id
      AND e.expression_id = pse.expression_id
      AND pse.record_end_date IS NULL
      AND (
        ps.record_end_date IS NOT NULL
        OR p.record_end_date IS NOT NULL
        OR e.record_end_date IS NOT NULL
      );

    ----------------------------------------------------------------------------------------
    -- 4. Backfill active policy_expression identities.
    --
    -- Historical policy_statement_expression rows are intentionally not backfilled. The new
    -- policy_expression_id column is required only for active rows by the check constraint added
    -- below.
    ----------------------------------------------------------------------------------------
    WITH active_policy_expressions AS (
      SELECT
        ps.policy_id,
        pse.expression_id,
        min(pse.create_user) AS create_user
      FROM policy_statement_expression pse
      JOIN policy_statement ps ON ps.policy_statement_id = pse.policy_statement_id
      JOIN expression e ON e.expression_id = pse.expression_id
      WHERE pse.record_end_date IS NULL
        AND ps.record_end_date IS NULL
        AND e.record_end_date IS NULL
      GROUP BY ps.policy_id, pse.expression_id
    )
    INSERT INTO policy_expression (
      policy_id,
      expression_id,
      create_user
    )
    SELECT
      active_policy_expressions.policy_id,
      active_policy_expressions.expression_id,
      active_policy_expressions.create_user
    FROM active_policy_expressions
    WHERE NOT EXISTS (
      SELECT 1
      FROM policy_expression pe
      WHERE pe.policy_id = active_policy_expressions.policy_id
        AND pe.expression_id = active_policy_expressions.expression_id
        AND pe.record_end_date IS NULL
    );

    ----------------------------------------------------------------------------------------
    -- 5. Backfill active policy_statement_expression.policy_expression_id while expression_id
    --    still exists.
    ----------------------------------------------------------------------------------------
    UPDATE policy_statement_expression pse
    SET policy_expression_id = pe.policy_expression_id
    FROM policy_statement ps,
      expression e,
      policy_expression pe
    WHERE ps.policy_statement_id = pse.policy_statement_id
      AND e.expression_id = pse.expression_id
      AND pe.policy_id = ps.policy_id
      AND pe.expression_id = pse.expression_id
      AND pe.record_end_date IS NULL
      AND pse.record_end_date IS NULL
      AND ps.record_end_date IS NULL
      AND e.record_end_date IS NULL;

    ALTER TABLE policy_statement_expression
      ADD CONSTRAINT policy_statement_expression_chk1
        CHECK (record_end_date IS NOT NULL OR policy_expression_id IS NOT NULL);

    ----------------------------------------------------------------------------------------
    -- 6. Stage statements with multiple distinct active expressions.
    --
    -- Duplicate active links to the same expression are handled later as duplicate rows rather
    -- than wrapped in a noisy single-child AND.
    ----------------------------------------------------------------------------------------
    CREATE TEMP TABLE tmp_policy_statement_expression_merge_clause ON COMMIT DROP AS
    WITH active_links AS (
      SELECT
        pse.policy_statement_expression_id,
        pse.policy_statement_id,
        ps.policy_id,
        pe.expression_id,
        e.expression_hash,
        pse.create_user
      FROM policy_statement_expression pse
      JOIN policy_statement ps ON ps.policy_statement_id = pse.policy_statement_id
      JOIN policy_expression pe ON pe.policy_expression_id = pse.policy_expression_id
      JOIN expression e ON e.expression_id = pe.expression_id
      WHERE pse.record_end_date IS NULL
        AND ps.record_end_date IS NULL
        AND pe.record_end_date IS NULL
        AND e.record_end_date IS NULL
    ),
    multi_expression_statements AS (
      SELECT policy_statement_id
      FROM active_links
      GROUP BY policy_statement_id
      HAVING count(DISTINCT expression_id) > 1
    )
    SELECT
      active_links.policy_statement_id,
      active_links.policy_id,
      active_links.expression_id,
      active_links.expression_hash,
      min(active_links.create_user) AS create_user,
      row_number() OVER (
        PARTITION BY active_links.policy_statement_id
        ORDER BY active_links.expression_hash, active_links.expression_id
      ) AS sequence
    FROM active_links
    JOIN multi_expression_statements
      ON multi_expression_statements.policy_statement_id = active_links.policy_statement_id
    GROUP BY
      active_links.policy_statement_id,
      active_links.policy_id,
      active_links.expression_id,
      active_links.expression_hash;

    CREATE TEMP TABLE tmp_policy_statement_expression_merge ON COMMIT DROP AS
    SELECT
      merge_clause.policy_statement_id,
      merge_clause.policy_id,
      encode(
        sha256(
          convert_to(
            '{"clauses":[' ||
            string_agg(
              '{"clause_hash":' || to_json(merge_clause.expression_hash)::text ||
              ',"clause_type":"expression","sequence":' || merge_clause.sequence::text ||
              '}',
              ',' ORDER BY merge_clause.sequence
            ) ||
            '],"operator":"AND","type":"expression"}',
            'UTF8'
          )
        ),
        'hex'
      ) AS merged_expression_hash,
      min(merge_clause.create_user) AS create_user
    FROM tmp_policy_statement_expression_merge_clause merge_clause
    GROUP BY merge_clause.policy_statement_id, merge_clause.policy_id;

    ----------------------------------------------------------------------------------------
    -- 7. Create or reuse the merged AND expression anchors.
    --
    -- The merged expression hash is built to match ExpressionTreeService stableStringify({
    --   type: 'expression',
    --   operator: 'AND',
    --   clauses: [
    --     { sequence, clause_type: 'expression', clause_hash },
    --     ...
    --   ]
    -- }), which serializes as:
    --   {"clauses":[...],"operator":"AND","type":"expression"}
    ----------------------------------------------------------------------------------------
    INSERT INTO expression (operator, expression_hash, create_user)
    SELECT
      'AND'::logical_operator_type,
      merge_group.merged_expression_hash,
      merge_group.create_user
    FROM tmp_policy_statement_expression_merge merge_group
    WHERE NOT EXISTS (
      SELECT 1
      FROM expression e
      WHERE e.expression_hash = merge_group.merged_expression_hash
        AND e.record_end_date IS NULL
    );

    ----------------------------------------------------------------------------------------
    -- 8. Attach each original expression as a child of its merged AND expression.
    ----------------------------------------------------------------------------------------
    INSERT INTO expression_clause (
      expression_id,
      sequence,
      child_expression_id,
      create_user
    )
    SELECT
      merged_expression.expression_id,
      merge_clause.sequence,
      merge_clause.expression_id,
      merge_clause.create_user
    FROM tmp_policy_statement_expression_merge_clause merge_clause
    JOIN tmp_policy_statement_expression_merge merge_group
      ON merge_group.policy_statement_id = merge_clause.policy_statement_id
    JOIN expression merged_expression
      ON merged_expression.expression_hash = merge_group.merged_expression_hash
     AND merged_expression.record_end_date IS NULL
    WHERE NOT EXISTS (
      SELECT 1
      FROM expression_clause ec
      WHERE ec.expression_id = merged_expression.expression_id
        AND ec.sequence = merge_clause.sequence
        AND ec.record_end_date IS NULL
    );

    ----------------------------------------------------------------------------------------
    -- 9. Create or reuse the policy-owned identity for each merged expression.
    ----------------------------------------------------------------------------------------
    INSERT INTO policy_expression (
      policy_id,
      expression_id,
      name,
      description,
      create_user
    )
    SELECT
      merge_group.policy_id,
      merged_expression.expression_id,
      'Merged policy statement expression',
      'Merged from multiple active policy statement expressions during policy_expression migration.',
      merge_group.create_user
    FROM tmp_policy_statement_expression_merge merge_group
    JOIN expression merged_expression
      ON merged_expression.expression_hash = merge_group.merged_expression_hash
     AND merged_expression.record_end_date IS NULL
    WHERE NOT EXISTS (
      SELECT 1
      FROM policy_expression pe
      WHERE pe.policy_id = merge_group.policy_id
        AND pe.expression_id = merged_expression.expression_id
        AND pe.record_end_date IS NULL
    );

    ----------------------------------------------------------------------------------------
    -- 10. Repoint one active statement-expression row to the merged policy expression.
    ----------------------------------------------------------------------------------------
    WITH retained AS (
      SELECT
        ranked.policy_statement_expression_id,
        merged_policy_expression.policy_expression_id
      FROM (
        SELECT
          pse.policy_statement_id,
          pse.policy_statement_expression_id,
          row_number() OVER (
            PARTITION BY pse.policy_statement_id
            ORDER BY pse.create_date, pse.policy_statement_expression_id
          ) AS row_number
        FROM policy_statement_expression pse
        JOIN tmp_policy_statement_expression_merge merge_group
          ON merge_group.policy_statement_id = pse.policy_statement_id
        WHERE pse.record_end_date IS NULL
      ) ranked
      JOIN tmp_policy_statement_expression_merge merge_group
        ON merge_group.policy_statement_id = ranked.policy_statement_id
      JOIN expression merged_expression
        ON merged_expression.expression_hash = merge_group.merged_expression_hash
       AND merged_expression.record_end_date IS NULL
      JOIN policy_expression merged_policy_expression
        ON merged_policy_expression.policy_id = merge_group.policy_id
       AND merged_policy_expression.expression_id = merged_expression.expression_id
       AND merged_policy_expression.record_end_date IS NULL
      WHERE ranked.row_number = 1
    )
    UPDATE policy_statement_expression pse
    SET policy_expression_id = retained.policy_expression_id
    FROM retained
    WHERE pse.policy_statement_expression_id = retained.policy_statement_expression_id;

    ----------------------------------------------------------------------------------------
    -- 11. After any required merge has repointed the retained row, keep exactly one active
    --     policy_statement_expression row per statement and soft-delete the rest.
    ----------------------------------------------------------------------------------------
    WITH ranked AS (
      SELECT
        policy_statement_expression_id,
        row_number() OVER (
          PARTITION BY policy_statement_id
          ORDER BY create_date, policy_statement_expression_id
        ) AS row_number
      FROM policy_statement_expression pse
      WHERE pse.record_end_date IS NULL
    )
    UPDATE policy_statement_expression pse
    SET record_end_date = now()
    FROM ranked
    WHERE ranked.policy_statement_expression_id = pse.policy_statement_expression_id
      AND ranked.row_number > 1;

    ----------------------------------------------------------------------------------------
    -- 12. Swap policy_statement_expression to the new policy_expression reference.
    ----------------------------------------------------------------------------------------
    DROP INDEX IF EXISTS policy_statement_expression_nuk1;
    DROP INDEX IF EXISTS policy_statement_expression_idx2;
    DROP INDEX IF EXISTS policy_statement_expression_idx3;

    ALTER TABLE policy_statement_expression
      DROP CONSTRAINT IF EXISTS policy_statement_expression_fk2;

    ALTER TABLE policy_statement_expression
      ADD CONSTRAINT policy_statement_expression_fk2
        FOREIGN KEY (policy_expression_id)
        REFERENCES policy_expression(policy_expression_id)
        ON DELETE CASCADE,
      DROP COLUMN expression_id;

    CREATE UNIQUE INDEX policy_statement_expression_nuk1
      ON policy_statement_expression(policy_statement_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX policy_statement_expression_idx2 ON policy_statement_expression(policy_expression_id);
    CREATE INDEX policy_statement_expression_idx3
      ON policy_statement_expression(policy_expression_id)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE policy_statement_expression IS 'Join table linking a policy statement to at most one active policy-owned expression.';
    COMMENT ON COLUMN policy_statement_expression.policy_expression_id IS 'Foreign key to policy_expression.';

    ----------------------------------------------------------------------------------------
    -- 13. Drop legacy policy statement condition tables.
    ----------------------------------------------------------------------------------------
    DROP TABLE IF EXISTS policy_statement_condition_expression;
    DROP TABLE IF EXISTS policy_statement_condition;

    DROP FUNCTION IF EXISTS biohub.tr_validate_policy_condition_key();
    DROP TYPE IF EXISTS policy_condition_operator;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Restore legacy policy statement condition tables.
    ----------------------------------------------------------------------------------------
    CREATE TYPE policy_condition_operator AS ENUM (
      'StringEquals',
      'StringNotEquals',
      'StringLike',
      'NumericEquals',
      'Bool',
      'Exists',
      'DateBefore',
      'DateAfter',
      'Within',
      'Intersects',
      'Contains',
      'ParentOf',
      'ChildOf'
    );

    CREATE TABLE policy_statement_condition (
      policy_statement_condition_id uuid DEFAULT public.gen_random_uuid(),
      policy_statement_id uuid NOT NULL,
      operator policy_condition_operator NOT NULL,
      key varchar(500) NOT NULL,
      value jsonb NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT policy_statement_condition_pk PRIMARY KEY (policy_statement_condition_id),
      CONSTRAINT policy_statement_condition_statement_fk
        FOREIGN KEY (policy_statement_id)
        REFERENCES policy_statement(policy_statement_id)
    );

    CREATE INDEX policy_statement_condition_statement_id_idx ON policy_statement_condition(policy_statement_id);
    CREATE UNIQUE INDEX policy_statement_condition_nuk1
      ON policy_statement_condition(policy_statement_id, operator, key, value, (record_end_date is NULL))
      WHERE record_end_date IS NULL;
    CREATE INDEX policy_statement_condition_value_gin_idx ON policy_statement_condition USING GIN (value);

    COMMENT ON TABLE policy_statement_condition IS 'Key-value condition associated with a policy statement, with support for operator-based evaluations.';
    COMMENT ON COLUMN policy_statement_condition.policy_statement_condition_id IS 'System-generated primary key.';
    COMMENT ON COLUMN policy_statement_condition.policy_statement_id IS 'Foreign key to the policy_statement table.';
    COMMENT ON COLUMN policy_statement_condition.operator IS 'Comparison operator (e.g., StringEquals, StringLike).';
    COMMENT ON COLUMN policy_statement_condition.key IS 'Condition key (e.g., taxon_id, region).';
    COMMENT ON COLUMN policy_statement_condition.value IS 'Value or array of values for the condition, stored as JSONB.';
    COMMENT ON COLUMN policy_statement_condition.record_end_date IS 'The end date of the record for soft deletes.';
    COMMENT ON COLUMN policy_statement_condition.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN policy_statement_condition.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN policy_statement_condition.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN policy_statement_condition.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN policy_statement_condition.revision_count IS 'Revision count used for concurrency control.';

    CREATE OR REPLACE FUNCTION biohub.tr_validate_policy_condition_key()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY INVOKER
    AS $$
    DECLARE
        property_type_name TEXT;
        operator_text TEXT;
        value_type TEXT;
        valid_operators TEXT[];
        elem JSONB;
    BEGIN
        operator_text := NEW.operator::TEXT;

        SELECT fpt.name INTO property_type_name
        FROM biohub.feature_type_property ftp
        JOIN biohub.feature_property fp ON fp.feature_property_id = ftp.feature_property_id
        JOIN biohub.feature_property_type fpt ON fp.feature_property_type_id = fpt.feature_property_type_id
        WHERE fp.name = NEW.key
        LIMIT 1;

        IF property_type_name IS NULL THEN
            RAISE EXCEPTION 'Invalid property key "%": not found in feature_type_property', NEW.key;
        END IF;

        valid_operators := CASE property_type_name
            WHEN 'string' THEN
                ARRAY['StringEquals', 'StringNotEquals', 'StringLike', 'Exists']
            WHEN 'number' THEN
                ARRAY['NumericEquals', 'Exists']
            WHEN 'datetime' THEN
                ARRAY['DateBefore', 'DateAfter', 'Exists']
            WHEN 'spatial' THEN
                ARRAY['Within', 'Intersects', 'Contains', 'Exists']
            WHEN 'boolean' THEN
                ARRAY['Bool', 'Exists']
            WHEN 'object' THEN
                ARRAY['Exists']
            WHEN 'array' THEN
                ARRAY['Exists']
            WHEN 'artifact_key' THEN
                ARRAY['StringEquals', 'StringNotEquals', 'StringLike', 'Exists']
            ELSE
                NULL
        END;

        IF valid_operators IS NULL THEN
            RAISE EXCEPTION 'Unknown property type "%"', property_type_name;
        END IF;

        IF NOT (operator_text = ANY(valid_operators)) THEN
            RAISE EXCEPTION 'Operator "%" not valid for property type "%". Valid operators: %',
                operator_text, property_type_name, array_to_string(valid_operators, ', ');
        END IF;

        value_type := jsonb_typeof(NEW.value);

        IF operator_text = 'Bool' THEN
            IF value_type != 'boolean' THEN
                RAISE EXCEPTION 'Bool operator requires a boolean value, got: %', value_type;
            END IF;
        END IF;

        IF operator_text = 'NumericEquals' THEN
            IF value_type NOT IN ('number', 'array') THEN
                RAISE EXCEPTION 'NumericEquals operator requires a number or array of numbers, got: %', value_type;
            END IF;
            IF value_type = 'array' THEN
                FOR elem IN SELECT * FROM jsonb_array_elements(NEW.value) LOOP
                    IF jsonb_typeof(elem) != 'number' THEN
                        RAISE EXCEPTION 'NumericEquals array must contain only numbers, found: %', jsonb_typeof(elem);
                    END IF;
                END LOOP;
            END IF;
        END IF;

        IF operator_text = 'StringEquals' OR operator_text = 'StringNotEquals' OR operator_text = 'StringLike' THEN
            IF value_type NOT IN ('string', 'array') THEN
                RAISE EXCEPTION '% operator requires a string or array of strings, got: %', operator_text, value_type;
            END IF;
            IF value_type = 'array' THEN
                FOR elem IN SELECT * FROM jsonb_array_elements(NEW.value) LOOP
                    IF jsonb_typeof(elem) != 'string' THEN
                        RAISE EXCEPTION '% operator array must contain only strings, found: %', operator_text, jsonb_typeof(elem);
                    END IF;
                END LOOP;
            END IF;
        END IF;

        IF operator_text = 'Exists' THEN
            IF value_type != 'boolean' THEN
                RAISE EXCEPTION 'Exists operator requires a boolean value, got: %', value_type;
            END IF;
        END IF;

        IF operator_text = 'Within' OR operator_text = 'Intersects' OR operator_text = 'Contains' THEN
            IF value_type != 'object' THEN
                RAISE EXCEPTION 'Spatial operator % requires a GeoJSON object, got: %', operator_text, value_type;
            END IF;
            IF NEW.value -> 'type' IS NULL THEN
                RAISE EXCEPTION 'Spatial operator % requires valid GeoJSON with "type" field', operator_text;
            END IF;
        END IF;

        IF operator_text = ANY(ARRAY['DateBefore', 'DateAfter']) THEN
            IF value_type NOT IN ('string', 'array') THEN
                RAISE EXCEPTION '% operator requires a date string or array of date strings, got: %', operator_text, value_type;
            END IF;
            IF value_type = 'array' THEN
                FOR elem IN SELECT * FROM jsonb_array_elements(NEW.value) LOOP
                    IF jsonb_typeof(elem) != 'string' THEN
                        RAISE EXCEPTION '% operator array must contain only date strings, found: %', operator_text, jsonb_typeof(elem);
                    END IF;
                END LOOP;
            END IF;
        END IF;
        RETURN NEW;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Policy condition validation failed for key="%", operator="%": %',
                NEW.key, operator_text, SQLERRM;
    END;
    $$;

    CREATE TRIGGER validate_policy_condition_key
      BEFORE INSERT ON biohub.policy_statement_condition
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_validate_policy_condition_key();
    CREATE TRIGGER audit_policy_statement_condition
      BEFORE INSERT OR UPDATE OR DELETE ON policy_statement_condition
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_policy_statement_condition
      AFTER INSERT OR UPDATE OR DELETE ON policy_statement_condition
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

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
    CREATE INDEX policy_statement_condition_expression_idx4
      ON policy_statement_condition_expression(policy_statement_condition_id)
      WHERE record_end_date IS NULL;

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

    CREATE TRIGGER audit_policy_statement_condition_expression
      BEFORE INSERT OR UPDATE OR DELETE ON policy_statement_condition_expression
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_policy_statement_condition_expression
      AFTER INSERT OR UPDATE OR DELETE ON policy_statement_condition_expression
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- 2. Restore policy_statement_expression.expression_id and legacy indexes.
    --
    -- This down migration restores the legacy schema shape. It does not reconstruct the exact
    -- pre-migration active row set:
    -- - active rows merged during up remain represented by the synthesized AND expression
    -- - historical rows not backfilled during up may have null expression_id after rollback
    ----------------------------------------------------------------------------------------
    ALTER TABLE policy_statement_expression
      ADD COLUMN expression_id uuid;

    UPDATE policy_statement_expression pse
    SET expression_id = pe.expression_id
    FROM policy_expression pe
    WHERE pe.policy_expression_id = pse.policy_expression_id;

    DROP INDEX IF EXISTS policy_statement_expression_nuk1;
    DROP INDEX IF EXISTS policy_statement_expression_idx2;
    DROP INDEX IF EXISTS policy_statement_expression_idx3;

    ALTER TABLE policy_statement_expression
      DROP CONSTRAINT IF EXISTS policy_statement_expression_fk2,
      DROP CONSTRAINT IF EXISTS policy_statement_expression_chk1;

    ALTER TABLE policy_statement_expression
      ADD CONSTRAINT policy_statement_expression_fk2
        FOREIGN KEY (expression_id)
        REFERENCES expression(expression_id)
        ON DELETE CASCADE;

    CREATE UNIQUE INDEX policy_statement_expression_nuk1
      ON policy_statement_expression(policy_statement_id, expression_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX policy_statement_expression_idx2 ON policy_statement_expression(expression_id);
    CREATE INDEX policy_statement_expression_idx3
      ON policy_statement_expression(expression_id)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE policy_statement_expression IS 'Join table linking a policy statement to a root expression. Only active root expressions (no active parent) are allowed.';
    COMMENT ON COLUMN policy_statement_expression.expression_id IS 'Foreign key to root expression.';

    UPDATE policy_statement_expression
    SET policy_expression_id = NULL;

    ALTER TABLE policy_statement_expression
      DROP COLUMN IF EXISTS policy_expression_id;

    DROP TABLE IF EXISTS policy_expression;
  `);
}
