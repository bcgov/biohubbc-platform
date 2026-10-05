import type { Knex } from 'knex';

/**
 * Let a Blueprint own which properties belong to each of its feature types.
 *
 * `blueprint_feature_type_property` identified its property only through the global
 * `feature_type_property` pairing, so a Blueprint could only assign a property that had already been
 * paired with the feature type globally. This adds `feature_property_id` so the assignment references
 * the reusable property definition directly:
 *
 *   blueprint -> blueprint_feature_type -> blueprint_feature_type_property -> feature_property
 *
 * `feature_type_property_id` is retained as a compatibility reference. The durable
 * `submission_feature_property_*` tables hold a composite FK onto
 * `(feature_type_property_id, blueprint_feature_type_property_id)`, and search, downloads, policies and
 * the map tile functions still read through `feature_type_property`. Removing the global pairing is a
 * follow-up; until then both references are stored and the database keeps them in agreement:
 *
 * - a composite FK onto `feature_type_property (feature_type_property_id, feature_property_id)` proves
 *   the two references name the same property;
 * - `tr_validate_blueprint_feature_type_property` proves the pairing belongs to the feature type of the
 *   parent `blueprint_feature_type`, which no FK can express without duplicating `feature_type_id` here.
 *
 * The same trigger derives `feature_property_id` from the pairing when an insert omits it. That branch
 * is transitional: it keeps inserts written against the old shape working (migrations on in-flight
 * branches, fixtures) and is removed together with `feature_type_property_id`.
 *
 * Active-row uniqueness moves from `(blueprint_feature_type_id, feature_type_property_id)` to
 * `(blueprint_feature_type_id, feature_property_id)`. With the pairing FK in place the new index implies
 * the old one; the old one did not imply the new one, because an end-dated and re-created global pairing
 * yields two pairing ids for one property.
 *
 * Existing rows are backfilled here rather than lazily. The value is a deterministic join within this
 * database over a small configuration table, and both the NOT NULL constraint and the new unique index
 * need it (same shape as `20260619120000_add_blueprint_id_to_submission_upload`). A pre-flight check
 * fails the migration loudly, naming the rows, if existing data cannot satisfy the new rules; nothing
 * is retired or rewritten automatically.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Add the Blueprint-owned property reference and backfill it from the global pairing.
    --
    -- No record_end_date filter: retired assignments and retired pairings are backfilled too.
    ----------------------------------------------------------------------------------------
    ALTER TABLE blueprint_feature_type_property ADD COLUMN feature_property_id integer;

    UPDATE blueprint_feature_type_property bftp
    SET feature_property_id = ftp.feature_property_id
    FROM feature_type_property ftp
    WHERE ftp.feature_type_property_id = bftp.feature_type_property_id
      AND bftp.feature_property_id IS NULL;

    ----------------------------------------------------------------------------------------
    -- 2. Pre-flight: refuse to continue if existing rows cannot satisfy the new rules.
    ----------------------------------------------------------------------------------------
    DO $do$
    DECLARE
      offending text;
    BEGIN
      SELECT string_agg(
        format('(blueprint_feature_type_id=%s, feature_property_id=%s)', d.blueprint_feature_type_id, d.feature_property_id),
        ', '
      )
      INTO offending
      FROM (
        SELECT blueprint_feature_type_id, feature_property_id
        FROM blueprint_feature_type_property
        WHERE record_end_date IS NULL
        GROUP BY blueprint_feature_type_id, feature_property_id
        HAVING COUNT(*) > 1
      ) d;

      IF offending IS NOT NULL THEN
        RAISE EXCEPTION
          'blueprint_feature_type_property has duplicate active property assignments: %', offending;
      END IF;

      SELECT string_agg(bftp.blueprint_feature_type_property_id::text, ', ')
      INTO offending
      FROM blueprint_feature_type_property bftp
      JOIN blueprint_feature_type bft
        ON bft.blueprint_feature_type_id = bftp.blueprint_feature_type_id
      JOIN feature_type_property ftp
        ON ftp.feature_type_property_id = bftp.feature_type_property_id
      WHERE ftp.feature_type_id <> bft.feature_type_id;

      IF offending IS NOT NULL THEN
        RAISE EXCEPTION
          'blueprint_feature_type_property rows reference a feature_type_property of a different feature type: %', offending;
      END IF;
    END
    $do$;

    ----------------------------------------------------------------------------------------
    -- 3. Constrain the new reference.
    ----------------------------------------------------------------------------------------
    ALTER TABLE blueprint_feature_type_property ALTER COLUMN feature_property_id SET NOT NULL;

    ALTER TABLE blueprint_feature_type_property
      ADD CONSTRAINT blueprint_feature_type_property_feature_property_fk
      FOREIGN KEY (feature_property_id) REFERENCES feature_property(feature_property_id);

    CREATE INDEX blueprint_feature_type_property_feature_property_id_idx
      ON blueprint_feature_type_property(feature_property_id);

    ----------------------------------------------------------------------------------------
    -- 4. Each property may be assigned at most once per Blueprint feature type among active rows.
    ----------------------------------------------------------------------------------------
    DROP INDEX IF EXISTS blueprint_feature_type_property_nuk1;

    CREATE UNIQUE INDEX blueprint_feature_type_property_nuk2
      ON blueprint_feature_type_property(blueprint_feature_type_id, feature_property_id)
      WHERE record_end_date is null;

    ----------------------------------------------------------------------------------------
    -- 5. Keep the compatibility pairing in agreement with the owned property.
    --
    -- The unique constraint is not a key change; it only gives the composite FK a target.
    ----------------------------------------------------------------------------------------
    ALTER TABLE feature_type_property
      ADD CONSTRAINT feature_type_property_uk2
      UNIQUE (feature_type_property_id, feature_property_id);

    ALTER TABLE blueprint_feature_type_property
      ADD CONSTRAINT blueprint_feature_type_property_ftp_pairing_fk
      FOREIGN KEY (feature_type_property_id, feature_property_id)
      REFERENCES feature_type_property(feature_type_property_id, feature_property_id);

    ----------------------------------------------------------------------------------------
    -- 6. Derive the owned property for old-shape inserts, and require the pairing to belong to
    --    the Blueprint feature type.
    ----------------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION tr_validate_blueprint_feature_type_property()
      RETURNS trigger
      LANGUAGE plpgsql
    AS $$
    DECLARE
      pairing record;
      owning_feature_type_id integer;
    BEGIN
      SELECT ftp.feature_type_id, ftp.feature_property_id
      INTO pairing
      FROM feature_type_property ftp
      WHERE ftp.feature_type_property_id = NEW.feature_type_property_id;

      -- A missing pairing or parent is reported by the foreign keys, which name the constraint.
      IF NOT FOUND THEN
        RETURN NEW;
      END IF;

      -- Transitional: inserts written before feature_property_id existed omit it. Removed together
      -- with feature_type_property_id.
      IF TG_OP = 'INSERT' AND NEW.feature_property_id IS NULL THEN
        NEW.feature_property_id := pairing.feature_property_id;
      END IF;

      SELECT bft.feature_type_id
      INTO owning_feature_type_id
      FROM blueprint_feature_type bft
      WHERE bft.blueprint_feature_type_id = NEW.blueprint_feature_type_id;

      IF FOUND AND pairing.feature_type_id <> owning_feature_type_id THEN
        RAISE EXCEPTION
          'feature_type_property_id % does not belong to the feature type of blueprint_feature_type_id %',
          NEW.feature_type_property_id,
          NEW.blueprint_feature_type_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      RETURN NEW;
    END;
    $$;

    COMMENT ON FUNCTION tr_validate_blueprint_feature_type_property() IS 'Requires blueprint_feature_type_property.feature_type_property_id to belong to the feature type of the parent blueprint_feature_type, and derives feature_property_id from that pairing when an insert omits it. Transitional: removed together with feature_type_property_id.';

    CREATE TRIGGER validate_blueprint_feature_type_property
      BEFORE INSERT OR UPDATE OF blueprint_feature_type_id, feature_type_property_id, feature_property_id
      ON blueprint_feature_type_property
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_validate_blueprint_feature_type_property();

    ----------------------------------------------------------------------------------------
    -- 7. Comments.
    ----------------------------------------------------------------------------------------
    COMMENT ON TABLE blueprint_feature_type_property IS 'The properties a Blueprint assigns to each of its feature types. The assignment owns the property reference, whether it is required, whether it allows multiple values, its ordering and its lifecycle.';
    COMMENT ON COLUMN blueprint_feature_type_property.feature_property_id IS 'Foreign key to the feature_property table; the reusable property definition this Blueprint feature type is assigned. The source of truth for which property the assignment configures.';
    COMMENT ON COLUMN blueprint_feature_type_property.feature_type_property_id IS 'Compatibility reference to the global feature_type_property pairing, retained for the durable property tables, search, downloads and policies until that table is removed. Must name the same property as feature_property_id (blueprint_feature_type_property_ftp_pairing_fk) and belong to the feature type of the parent blueprint_feature_type (tr_validate_blueprint_feature_type_property).';
  `);
}

/**
 * Reverses {@link up}: restores assignment by global pairing only.
 *
 * Recreating the old unique index cannot fail: the index it replaces implied it.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS validate_blueprint_feature_type_property ON blueprint_feature_type_property;
    DROP FUNCTION IF EXISTS tr_validate_blueprint_feature_type_property();

    ALTER TABLE blueprint_feature_type_property
      DROP CONSTRAINT IF EXISTS blueprint_feature_type_property_ftp_pairing_fk;

    ALTER TABLE feature_type_property
      DROP CONSTRAINT IF EXISTS feature_type_property_uk2;

    DROP INDEX IF EXISTS blueprint_feature_type_property_nuk2;

    CREATE UNIQUE INDEX IF NOT EXISTS blueprint_feature_type_property_nuk1
      ON blueprint_feature_type_property(blueprint_feature_type_id, feature_type_property_id)
      WHERE record_end_date is null;

    DROP INDEX IF EXISTS blueprint_feature_type_property_feature_property_id_idx;

    ALTER TABLE blueprint_feature_type_property
      DROP CONSTRAINT IF EXISTS blueprint_feature_type_property_feature_property_fk;

    ALTER TABLE blueprint_feature_type_property DROP COLUMN IF EXISTS feature_property_id;

    COMMENT ON TABLE blueprint_feature_type_property IS 'The properties assigned to each feature type within a Blueprint, including whether each is required and whether it allows multiple values.';
    COMMENT ON COLUMN blueprint_feature_type_property.feature_type_property_id IS 'Foreign key to the feature_type_property table; the global feature-type/property pool entry being assigned within this Blueprint.';
  `);
}
