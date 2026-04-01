import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Cross-table / recursive invariants in deferred constraint triggers.
    --------------------------------------------------------------------------------

    CREATE OR REPLACE FUNCTION fn_validate_predicate_resolution()
      RETURNS trigger
      LANGUAGE plpgsql
    AS $$
    DECLARE
      _predicate_id uuid;
      _feature_property_type_id integer;
      _feature_type_property_type_id integer;
      _predicate_record_end_date timestamptz;
      _has_string boolean;
      _has_number boolean;
      _has_boolean boolean;
      _has_timestamp boolean;
      _has_taxon boolean;
      _has_geometry boolean;
      _has_code boolean;
      _payload_count integer;
    BEGIN
      _predicate_id := COALESCE(NEW.predicate_id, OLD.predicate_id);

      IF _predicate_id IS NULL THEN
        RETURN NULL;
      END IF;

      SELECT
        p.feature_property_type_id,
        p.record_end_date
      INTO
        _feature_property_type_id,
        _predicate_record_end_date
      FROM predicate p
      WHERE p.predicate_id = _predicate_id;

      IF NOT FOUND OR _predicate_record_end_date IS NOT NULL THEN
        RETURN NULL;
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM predicate_string ps
        WHERE ps.predicate_id = _predicate_id
          AND ps.record_end_date IS NULL
      ) INTO _has_string;

      SELECT EXISTS (
        SELECT 1 FROM predicate_number pn
        WHERE pn.predicate_id = _predicate_id
          AND pn.record_end_date IS NULL
      ) INTO _has_number;

      SELECT EXISTS (
        SELECT 1 FROM predicate_boolean pb
        WHERE pb.predicate_id = _predicate_id
          AND pb.record_end_date IS NULL
      ) INTO _has_boolean;

      SELECT EXISTS (
        SELECT 1 FROM predicate_timestamp pt
        WHERE pt.predicate_id = _predicate_id
          AND pt.record_end_date IS NULL
      ) INTO _has_timestamp;

      SELECT EXISTS (
        SELECT 1 FROM predicate_taxon px
        WHERE px.predicate_id = _predicate_id
          AND px.record_end_date IS NULL
      ) INTO _has_taxon;

      SELECT EXISTS (
        SELECT 1 FROM predicate_geometry pg
        WHERE pg.predicate_id = _predicate_id
          AND pg.record_end_date IS NULL
      ) INTO _has_geometry;

      SELECT EXISTS (
        SELECT 1 FROM predicate_code pc
        WHERE pc.predicate_id = _predicate_id
          AND pc.record_end_date IS NULL
      ) INTO _has_code;

      _payload_count :=
        (CASE WHEN _has_string THEN 1 ELSE 0 END) +
        (CASE WHEN _has_number THEN 1 ELSE 0 END) +
        (CASE WHEN _has_boolean THEN 1 ELSE 0 END) +
        (CASE WHEN _has_timestamp THEN 1 ELSE 0 END) +
        (CASE WHEN _has_taxon THEN 1 ELSE 0 END) +
        (CASE WHEN _has_geometry THEN 1 ELSE 0 END) +
        (CASE WHEN _has_code THEN 1 ELSE 0 END);

      IF _payload_count <> 1 THEN
        RAISE EXCEPTION 'Active predicate % must resolve to exactly one active typed payload row (found %)', _predicate_id, _payload_count;
      END IF;

      SELECT ftp.feature_property_type_id
      INTO _feature_type_property_type_id
      FROM feature_type_property ftp
      WHERE ftp.feature_type_property_id = (
        SELECT p.feature_type_property_id
        FROM predicate p
        WHERE p.predicate_id = _predicate_id
      )
        AND ftp.record_end_date IS NULL;

      IF _feature_type_property_type_id IS NULL THEN
        RAISE EXCEPTION 'Active predicate % references inactive or missing feature_type_property', _predicate_id;
      END IF;

      IF _feature_type_property_type_id <> _feature_property_type_id THEN
        RAISE EXCEPTION 'Active predicate % has feature_property_type_id % but feature_type_property requires %', _predicate_id, _feature_property_type_id, _feature_type_property_type_id;
      END IF;

      RETURN NULL;
    END;
    $$;

    CREATE OR REPLACE FUNCTION fn_validate_expression_tree_acyclic()
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
      ) INTO _has_cycle;

      IF _has_cycle THEN
        RAISE EXCEPTION 'Cycle detected in expression tree for edge % -> %', NEW.expression_id, NEW.child_expression_id;
      END IF;

      RETURN NULL;
    END;
    $$;

    CREATE OR REPLACE FUNCTION fn_validate_owner_expression_root()
      RETURNS trigger
      LANGUAGE plpgsql
    AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        RETURN NULL;
      END IF;

      IF NEW.record_end_date IS NOT NULL THEN
        RETURN NULL;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM expression e
        WHERE e.expression_id = NEW.expression_id
          AND e.record_end_date IS NULL
      ) THEN
        RAISE EXCEPTION 'Active owner attachment in table % must reference an active expression (%)', TG_TABLE_NAME, NEW.expression_id;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM expression_clause ec
        WHERE ec.child_expression_id = NEW.expression_id
          AND ec.record_end_date IS NULL
      ) THEN
        RAISE EXCEPTION 'Table % may only attach root expressions; expression % has an active parent', TG_TABLE_NAME, NEW.expression_id;
      END IF;

      RETURN NULL;
    END;
    $$;

    CREATE CONSTRAINT TRIGGER validate_predicate_resolution_from_predicate
      AFTER INSERT OR UPDATE OR DELETE ON predicate
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION fn_validate_predicate_resolution();

    CREATE CONSTRAINT TRIGGER validate_predicate_resolution_from_predicate_string
      AFTER INSERT OR UPDATE OR DELETE ON predicate_string
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION fn_validate_predicate_resolution();

    CREATE CONSTRAINT TRIGGER validate_predicate_resolution_from_predicate_number
      AFTER INSERT OR UPDATE OR DELETE ON predicate_number
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION fn_validate_predicate_resolution();

    CREATE CONSTRAINT TRIGGER validate_predicate_resolution_from_predicate_boolean
      AFTER INSERT OR UPDATE OR DELETE ON predicate_boolean
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION fn_validate_predicate_resolution();

    CREATE CONSTRAINT TRIGGER validate_predicate_resolution_from_predicate_timestamp
      AFTER INSERT OR UPDATE OR DELETE ON predicate_timestamp
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION fn_validate_predicate_resolution();

    CREATE CONSTRAINT TRIGGER validate_predicate_resolution_from_predicate_taxon
      AFTER INSERT OR UPDATE OR DELETE ON predicate_taxon
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION fn_validate_predicate_resolution();

    CREATE CONSTRAINT TRIGGER validate_predicate_resolution_from_predicate_geometry
      AFTER INSERT OR UPDATE OR DELETE ON predicate_geometry
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION fn_validate_predicate_resolution();

    CREATE CONSTRAINT TRIGGER validate_predicate_resolution_from_predicate_code
      AFTER INSERT OR UPDATE OR DELETE ON predicate_code
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION fn_validate_predicate_resolution();

    CREATE CONSTRAINT TRIGGER validate_expression_tree_acyclic
      AFTER INSERT OR UPDATE OR DELETE ON expression_clause
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION fn_validate_expression_tree_acyclic();

    CREATE CONSTRAINT TRIGGER validate_download_expression_root
      AFTER INSERT OR UPDATE OR DELETE ON download_expression
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION fn_validate_owner_expression_root();

    CREATE CONSTRAINT TRIGGER validate_policy_statement_condition_expression_root
      AFTER INSERT OR UPDATE OR DELETE ON policy_statement_condition_expression
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION fn_validate_owner_expression_root();

    CREATE CONSTRAINT TRIGGER validate_security_rule_expression_root
      AFTER INSERT OR UPDATE OR DELETE ON security_rule_expression
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION fn_validate_owner_expression_root();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS validate_predicate_resolution_from_predicate ON predicate;
    DROP TRIGGER IF EXISTS validate_predicate_resolution_from_predicate_string ON predicate_string;
    DROP TRIGGER IF EXISTS validate_predicate_resolution_from_predicate_number ON predicate_number;
    DROP TRIGGER IF EXISTS validate_predicate_resolution_from_predicate_boolean ON predicate_boolean;
    DROP TRIGGER IF EXISTS validate_predicate_resolution_from_predicate_timestamp ON predicate_timestamp;
    DROP TRIGGER IF EXISTS validate_predicate_resolution_from_predicate_taxon ON predicate_taxon;
    DROP TRIGGER IF EXISTS validate_predicate_resolution_from_predicate_geometry ON predicate_geometry;
    DROP TRIGGER IF EXISTS validate_predicate_resolution_from_predicate_code ON predicate_code;

    DROP TRIGGER IF EXISTS validate_expression_tree_acyclic ON expression_clause;

    DROP TRIGGER IF EXISTS validate_download_expression_root ON download_expression;
    DROP TRIGGER IF EXISTS validate_policy_statement_condition_expression_root ON policy_statement_condition_expression;
    DROP TRIGGER IF EXISTS validate_security_rule_expression_root ON security_rule_expression;

    DROP FUNCTION IF EXISTS fn_validate_expression_tree_acyclic();
    DROP FUNCTION IF EXISTS fn_validate_owner_expression_root();
    DROP FUNCTION IF EXISTS fn_validate_predicate_resolution();
  `);
}
