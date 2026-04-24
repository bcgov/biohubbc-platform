import type { Knex } from 'knex';

/**
 * Adds deferred validation triggers for the expression/predicate model.
 *
 * What this migration enforces:
 * - Active expression edges cannot create a cycle.
 * - Active predicates must use the same feature property type as their active
 *   feature_type_property row.
 *
 * @param {Knex} knex - Migration knex connection.
 * @return {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- VALIDATION FUNCTION: EXPRESSION GRAPH ACYCLICITY
    --
    -- Goal:
    -- - Prevent cycles in active expression links.
    --
    -- Why a trigger:
    -- - A cycle can span many rows, so normal FK/UNIQUE/CHECK constraints are not
    --   enough to enforce this on their own.
    --------------------------------------------------------------------------------

    CREATE OR REPLACE FUNCTION tr_validate_expression_tree_acyclic()
      RETURNS trigger
      LANGUAGE plpgsql
    AS $$
    DECLARE
      _has_cycle boolean;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        RETURN NULL;
      END IF;

      IF NEW.record_end_date IS NOT NULL OR NEW.child_expression_id IS NULL THEN
        RETURN NULL;
      END IF;

      WITH RECURSIVE descendants(expression_id) AS (
        SELECT NEW.child_expression_id
        UNION
        SELECT ec.child_expression_id
        FROM expression_clause ec
        JOIN descendants d ON d.expression_id = ec.expression_id
        WHERE ec.child_expression_id IS NOT NULL
          AND ec.record_end_date IS NULL
      )
      SELECT EXISTS (
        SELECT 1
        FROM descendants
        WHERE expression_id = NEW.expression_id
      )
      INTO _has_cycle;

      IF _has_cycle THEN
        RAISE EXCEPTION 'Cycle detected in expression tree for edge % -> %', NEW.expression_id, NEW.child_expression_id;
      END IF;

      RETURN NULL;
    END;
    $$;

    --------------------------------------------------------------------------------
    -- VALIDATION FUNCTION: PREDICATE TYPE COMPATIBILITY
    --
    -- Goal:
    -- - For active predicates, ensure feature_property_type_id matches the active
    --   feature_type_property row referenced by feature_type_property_id.
    --
    -- Notes:
    -- - Trigger is deferred so multi-step writes can be validated at commit time.
    -- - Inactive predicate rows are ignored.
    --------------------------------------------------------------------------------

    CREATE OR REPLACE FUNCTION tr_validate_predicate_feature_property_type_match()
      RETURNS trigger
      LANGUAGE plpgsql
    AS $$
    DECLARE
      _expected_feature_property_type_id integer;
    BEGIN
      -- Ignore inactive predicate rows.
      IF NEW.record_end_date IS NOT NULL THEN
        RETURN NULL;
      END IF;

      -- Single indexed lookup in the normal path.
      SELECT ftp.feature_property_type_id
      INTO _expected_feature_property_type_id
      FROM feature_type_property ftp
      WHERE ftp.feature_type_property_id = NEW.feature_type_property_id
        AND ftp.record_end_date IS NULL;

      IF _expected_feature_property_type_id IS NULL THEN
        RAISE EXCEPTION 'Active predicate % references inactive or missing feature_type_property %', NEW.predicate_id, NEW.feature_type_property_id;
      END IF;

      IF _expected_feature_property_type_id <> NEW.feature_property_type_id THEN
        RAISE EXCEPTION 'Active predicate % has feature_property_type_id % but feature_type_property % requires %', NEW.predicate_id, NEW.feature_property_type_id, NEW.feature_type_property_id, _expected_feature_property_type_id;
      END IF;

      RETURN NULL;
    END;
    $$;

    --------------------------------------------------------------------------------
    -- EXPRESSION GRAPH ACYCLICITY
    --------------------------------------------------------------------------------

    CREATE CONSTRAINT TRIGGER validate_expression_tree_acyclic
      AFTER INSERT OR UPDATE OR DELETE ON expression_clause
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION tr_validate_expression_tree_acyclic();

    --------------------------------------------------------------------------------
    -- PREDICATE TYPE COMPATIBILITY
    --------------------------------------------------------------------------------

    CREATE CONSTRAINT TRIGGER validate_predicate_feature_property_type_match
      AFTER INSERT OR UPDATE ON predicate
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION tr_validate_predicate_feature_property_type_match();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- DROP CONSTRAINT TRIGGERS
    --------------------------------------------------------------------------------

    DROP TRIGGER IF EXISTS validate_predicate_feature_property_type_match ON predicate;
    DROP TRIGGER IF EXISTS validate_expression_tree_acyclic ON expression_clause;

    --------------------------------------------------------------------------------
    -- DROP VALIDATION FUNCTION
    --------------------------------------------------------------------------------

    DROP FUNCTION IF EXISTS tr_validate_predicate_feature_property_type_match();
    DROP FUNCTION IF EXISTS tr_validate_expression_tree_acyclic();
  `);
}
