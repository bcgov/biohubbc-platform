import type { Knex } from 'knex';

/**
 * Let a predicate narrow to one Blueprint assignment instead of one global pairing.
 *
 * A predicate always names the property it evaluates (`feature_property_id`). It could optionally narrow
 * to `feature_type_property_id`, the property within one feature type. That narrowing now targets
 * `blueprint_feature_type_property_id`: the property within one feature type within one Blueprint.
 * Existing narrowed predicates are mapped to the assignment that carries their pairing; a pairing carried
 * by zero or by several assignments cannot be mapped without changing what the predicate matches, so
 * the migration fails and names the predicates.
 *
 * The type-compatibility trigger keeps its property and type checks and validates the assignment
 * reference the same way it validated the pairing, except that it accepts a retired assignment: a
 * predicate may target values stored under a Blueprint version that has since been superseded.
 *
 * `predicate_hash` is left as stored. It is computed by the API from a canonical identity that includes
 * value canonicalization this database cannot reproduce, and the hash is only used to reuse an identical
 * predicate on insert. A predicate re-submitted after this migration therefore inserts a new row instead
 * of reusing a pre-migration one; existing expressions keep their rows.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Add the assignment reference.
    ----------------------------------------------------------------------------------------
    ALTER TABLE predicate ADD COLUMN blueprint_feature_type_property_id integer;

    ALTER TABLE predicate
      ADD CONSTRAINT predicate_fk4
      FOREIGN KEY (blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id);

    CREATE INDEX predicate_idx6 ON predicate (blueprint_feature_type_property_id);
    CREATE INDEX predicate_idx7 ON predicate (blueprint_feature_type_property_id) WHERE record_end_date IS NULL;

    COMMENT ON COLUMN predicate.blueprint_feature_type_property_id IS 'Optional foreign key to blueprint_feature_type_property. When set, the predicate applies only to values stored under this assignment; when null, it applies to the property under every assignment.';

    ----------------------------------------------------------------------------------------
    -- 2. Pre-flight: every narrowed predicate must map to exactly one assignment.
    ----------------------------------------------------------------------------------------
    DO $do$
    DECLARE
      offending text;
      offending_total integer;
    BEGIN
      WITH candidates AS (
        SELECT p.predicate_id
        FROM predicate p
        LEFT JOIN blueprint_feature_type_property bftp
          ON bftp.feature_type_property_id = p.feature_type_property_id
        WHERE p.feature_type_property_id IS NOT NULL
        GROUP BY p.predicate_id
        HAVING COUNT(bftp.blueprint_feature_type_property_id) <> 1
      )
      SELECT COUNT(*)::integer, string_agg(predicate_id::text, ', ' ORDER BY predicate_id)
      INTO offending_total, offending
      FROM candidates;

      IF offending_total > 0 THEN
        RAISE EXCEPTION
          '% predicates narrow to a feature_type_property carried by zero or several blueprint assignments: %',
          offending_total, offending;
      END IF;
    END
    $do$;

    ----------------------------------------------------------------------------------------
    -- 3. Map existing narrowed predicates.
    ----------------------------------------------------------------------------------------
    UPDATE predicate p
    SET blueprint_feature_type_property_id = bftp.blueprint_feature_type_property_id
    FROM blueprint_feature_type_property bftp
    WHERE p.feature_type_property_id IS NOT NULL
      AND bftp.feature_type_property_id = p.feature_type_property_id;

    ----------------------------------------------------------------------------------------
    -- 4. Validate the assignment reference instead of the pairing.
    ----------------------------------------------------------------------------------------
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

      SELECT fp.feature_property_type_id
      INTO _expected_feature_property_type_id
      FROM feature_property fp
      WHERE fp.feature_property_id = NEW.feature_property_id
        AND fp.record_end_date IS NULL;

      IF _expected_feature_property_type_id IS NULL THEN
        RAISE EXCEPTION 'Active predicate % references inactive or missing feature_property %', NEW.predicate_id, NEW.feature_property_id;
      END IF;

      IF _expected_feature_property_type_id <> NEW.feature_property_type_id THEN
        RAISE EXCEPTION 'Active predicate % has feature_property_type_id % but feature_property % requires %', NEW.predicate_id, NEW.feature_property_type_id, NEW.feature_property_id, _expected_feature_property_type_id;
      END IF;

      -- The assignment may be retired: values stored under a superseded Blueprint stay searchable.
      IF NEW.blueprint_feature_type_property_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM blueprint_feature_type_property bftp
        WHERE bftp.blueprint_feature_type_property_id = NEW.blueprint_feature_type_property_id
          AND bftp.feature_property_id = NEW.feature_property_id
      ) THEN
        RAISE EXCEPTION 'Active predicate % references a missing or mismatched blueprint_feature_type_property %', NEW.predicate_id, NEW.blueprint_feature_type_property_id;
      END IF;

      RETURN NULL;
    END;
    $$;
  `);
}

/**
 * Reverses {@link up}: restore the pairing check from `20260515123000` and drop the assignment reference.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

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

      SELECT fp.feature_property_type_id
      INTO _expected_feature_property_type_id
      FROM feature_property fp
      WHERE fp.feature_property_id = NEW.feature_property_id
        AND fp.record_end_date IS NULL;

      IF _expected_feature_property_type_id IS NULL THEN
        RAISE EXCEPTION 'Active predicate % references inactive or missing feature_property %', NEW.predicate_id, NEW.feature_property_id;
      END IF;

      IF _expected_feature_property_type_id <> NEW.feature_property_type_id THEN
        RAISE EXCEPTION 'Active predicate % has feature_property_type_id % but feature_property % requires %', NEW.predicate_id, NEW.feature_property_type_id, NEW.feature_property_id, _expected_feature_property_type_id;
      END IF;

      IF NEW.feature_type_property_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM feature_type_property ftp
        WHERE ftp.feature_type_property_id = NEW.feature_type_property_id
          AND ftp.feature_property_id = NEW.feature_property_id
          AND ftp.record_end_date IS NULL
      ) THEN
        RAISE EXCEPTION 'Active predicate % references inactive, missing, or mismatched feature_type_property %', NEW.predicate_id, NEW.feature_type_property_id;
      END IF;

      RETURN NULL;
    END;
    $$;

    DROP INDEX IF EXISTS predicate_idx7;
    DROP INDEX IF EXISTS predicate_idx6;
    ALTER TABLE predicate DROP CONSTRAINT IF EXISTS predicate_fk4;
    ALTER TABLE predicate DROP COLUMN IF EXISTS blueprint_feature_type_property_id;
  `);
}
