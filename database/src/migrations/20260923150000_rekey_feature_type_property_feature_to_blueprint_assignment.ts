import type { Knex } from 'knex';

/**
 * Declare the allowed target feature types of a feature-valued property per Blueprint assignment.
 *
 * `feature_type_property_feature` listed, for one global pairing, the feature types a `feature::<id>`
 * reference may resolve to. The pairing is being removed, and a Blueprint owns the composition of its
 * feature types, so the declaration moves onto the Blueprint assignment: each existing row is copied once
 * per assignment that carries its pairing, in every Blueprint and at any lifecycle, so that ingestion
 * under a superseded Blueprint keeps resolving references the way it did. A pairing carried by no
 * assignment cannot be re-homed and fails the migration.
 *
 * A trigger requires the assignment's property to be declared as type `feature`, which the pairing key
 * left to the reader.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Pre-flight: every declaration must have at least one assignment to move to.
    ----------------------------------------------------------------------------------------
    DO $do$
    DECLARE
      offending text;
      offending_total integer;
    BEGIN
      SELECT COUNT(*)::integer, string_agg(f.feature_type_property_feature_id::text, ', ')
      INTO offending_total, offending
      FROM feature_type_property_feature f
      WHERE NOT EXISTS (
        SELECT 1
        FROM blueprint_feature_type_property bftp
        WHERE bftp.feature_type_property_id = f.feature_type_property_id
      );

      IF offending_total > 0 THEN
        RAISE EXCEPTION
          '% feature_type_property_feature rows declare targets for a pairing no blueprint assignment carries: %',
          offending_total, offending;
      END IF;
    END
    $do$;

    ----------------------------------------------------------------------------------------
    -- 2. Re-home each declaration onto every assignment that carries its pairing.
    ----------------------------------------------------------------------------------------
    ALTER TABLE feature_type_property_feature ADD COLUMN blueprint_feature_type_property_id integer;

    INSERT INTO feature_type_property_feature (
      feature_type_property_id,
      blueprint_feature_type_property_id,
      target_feature_type_id,
      record_end_date,
      create_user
    )
    SELECT
      f.feature_type_property_id,
      bftp.blueprint_feature_type_property_id,
      f.target_feature_type_id,
      f.record_end_date,
      f.create_user
    FROM feature_type_property_feature f
    JOIN blueprint_feature_type_property bftp
      ON bftp.feature_type_property_id = f.feature_type_property_id
    WHERE f.blueprint_feature_type_property_id IS NULL;

    DELETE FROM feature_type_property_feature
    WHERE blueprint_feature_type_property_id IS NULL;

    ALTER TABLE feature_type_property_feature
      ALTER COLUMN blueprint_feature_type_property_id SET NOT NULL;

    ALTER TABLE feature_type_property_feature
      ADD CONSTRAINT feature_type_property_feature_fk3
      FOREIGN KEY (blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id);

    DROP INDEX IF EXISTS feature_type_property_feature_nuk1;
    DROP INDEX IF EXISTS feature_type_property_feature_idx1;

    -- Disallow duplicate (assignment, target) rows while a record is active.
    CREATE UNIQUE INDEX feature_type_property_feature_nuk2
      ON feature_type_property_feature(blueprint_feature_type_property_id, target_feature_type_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX feature_type_property_feature_idx3
      ON feature_type_property_feature(blueprint_feature_type_property_id)
      WHERE record_end_date IS NULL;

    ----------------------------------------------------------------------------------------
    -- 3. Only a feature-valued assignment can declare targets.
    ----------------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION tr_validate_feature_type_property_feature()
      RETURNS trigger
      LANGUAGE plpgsql
    AS $$
    DECLARE
      declared_type text;
    BEGIN
      SELECT fpt.name
      INTO declared_type
      FROM blueprint_feature_type_property bftp
      JOIN feature_property fp ON fp.feature_property_id = bftp.feature_property_id
      JOIN feature_property_type fpt ON fpt.feature_property_type_id = fp.feature_property_type_id
      WHERE bftp.blueprint_feature_type_property_id = NEW.blueprint_feature_type_property_id;

      -- A missing assignment is reported by the foreign key, which names the constraint.
      IF FOUND AND declared_type <> 'feature' THEN
        RAISE EXCEPTION
          'blueprint_feature_type_property_id % is declared as % and cannot declare target feature types',
          NEW.blueprint_feature_type_property_id,
          declared_type
          USING ERRCODE = 'datatype_mismatch';
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER validate_feature_type_property_feature
      BEFORE INSERT OR UPDATE OF blueprint_feature_type_property_id
      ON feature_type_property_feature
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_validate_feature_type_property_feature();

    COMMENT ON TABLE feature_type_property_feature IS 'For a feature-valued Blueprint assignment, the set of feature types a feature::<id> reference is allowed to resolve to. An assignment with no active rows here permits no targets.';
    COMMENT ON COLUMN feature_type_property_feature.blueprint_feature_type_property_id IS 'Foreign key to the blueprint_feature_type_property table: the feature-valued assignment whose allowed target type is being declared.';
  `);
}

/**
 * Reverses {@link up}: one declaration per pairing again.
 *
 * The rows fanned out per assignment collapse to one per (pairing, target); the surviving row is the
 * one with the smallest identifier, which is the original where it still exists.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS validate_feature_type_property_feature ON feature_type_property_feature;
    DROP FUNCTION IF EXISTS tr_validate_feature_type_property_feature();

    DROP INDEX IF EXISTS feature_type_property_feature_idx3;
    DROP INDEX IF EXISTS feature_type_property_feature_nuk2;

    DELETE FROM feature_type_property_feature f
    USING feature_type_property_feature keep
    WHERE keep.feature_type_property_id = f.feature_type_property_id
      AND keep.target_feature_type_id = f.target_feature_type_id
      AND (keep.record_end_date IS NULL) = (f.record_end_date IS NULL)
      AND keep.feature_type_property_feature_id < f.feature_type_property_feature_id;

    CREATE UNIQUE INDEX feature_type_property_feature_nuk1
      ON feature_type_property_feature(feature_type_property_id, target_feature_type_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX feature_type_property_feature_idx1
      ON feature_type_property_feature(feature_type_property_id)
      WHERE record_end_date IS NULL;

    ALTER TABLE feature_type_property_feature DROP CONSTRAINT IF EXISTS feature_type_property_feature_fk3;
    ALTER TABLE feature_type_property_feature DROP COLUMN IF EXISTS blueprint_feature_type_property_id;

    COMMENT ON TABLE feature_type_property_feature IS 'For a feature-valued feature_type_property, the set of feature types a feature::<id> reference is allowed to resolve to. A property with no active rows here permits no targets.';
  `);
}
