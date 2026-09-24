import type { Knex } from 'knex';

/**
 * Make the Blueprint assignment the reference everywhere the global pairing was one: stored property
 * values, ingestion error summaries, predicates and allowed reference targets.
 *
 * A Blueprint assignment (`blueprint_feature_type_property`) names a property within a feature type within
 * one Blueprint. Once `feature_type_property` is removed it is the only thing that says which property a
 * stored value belongs to, which property an ingestion error concerns, which values a narrowed predicate
 * matches, and which feature types a `feature::<id>` reference may resolve to. Every such reference is
 * therefore mapped here, and required where the pairing was required.
 *
 * Mapping rule. Every submission feature resolves to exactly one Blueprint (`submission_upload.blueprint_id`
 * is NOT NULL), so a missing assignment is derived as the assignment of the value's property, within the
 * feature's type, within the upload's Blueprint. No lifecycle filter is applied on the way: a value written
 * under an assignment that has since been retired keeps that assignment. The derivation is a deterministic
 * join over configuration tables in this database, which is why it runs here rather than lazily (see
 * `20260921120000`). It is preceded by one pre-flight that fails the migration, naming the rows, if any row
 * resolves to zero or to more than one assignment. Nothing is guessed and nothing is dropped.
 *
 * Stored values. `submission_feature_property_*.blueprint_feature_type_property_id` was added as optional
 * provenance (`20260625120000`) and backfilled only where the feature's Blueprint held an active assignment
 * for the value's global pairing, so rows written before Blueprints existed, rows whose pairing was
 * re-created, and rows written by seeds that never set it are still null. The composite foreign keys
 * `(feature_type_property_id, blueprint_feature_type_property_id)` required the stored assignment to carry
 * the same pairing id as the row. A derived assignment may carry a different pairing id for the same
 * property (a pairing that was end-dated and re-created), and the pairing id is about to be removed, so
 * those keys are replaced by plain keys on the assignment id.
 *
 * Ingestion errors. `submission_feature_error` aggregates one row per (upload, error code, property,
 * property name). Grouping on the assignment keeps errors for the same property under different feature
 * types apart, as the pairing did. Rows with no property (reference and parent errors) keep a null key
 * and, as before, never merge on conflict.
 *
 * Predicates. A predicate always names the property it evaluates (`feature_property_id`) and could
 * optionally narrow to one pairing. That narrowing now targets one assignment. A pairing carried by zero
 * or by several assignments cannot be mapped without changing what the predicate matches, so it fails the
 * migration. The type-compatibility trigger validates the assignment reference the way it validated the
 * pairing, except that it accepts a retired assignment: a predicate may target values stored under a
 * Blueprint version that has since been superseded. `predicate_hash` is left as stored. It is computed by
 * the API from a canonical identity that includes value canonicalization this database cannot reproduce,
 * and the hash is only used to reuse an identical predicate on insert. A predicate re-submitted after this
 * migration therefore inserts a new row instead of reusing a pre-migration one; existing expressions keep
 * their rows.
 *
 * Reference targets. `feature_type_property_feature` listed, for one pairing, the feature types a
 * `feature::<id>` reference may resolve to. A Blueprint owns the composition of its feature types, so the
 * declaration moves onto the assignment: each row is copied once per assignment that carries its pairing,
 * in every Blueprint and at any lifecycle, so that ingestion under a superseded Blueprint keeps resolving
 * references the way it did. A trigger requires the assignment's property to be declared as type `feature`,
 * which the pairing key left to the reader.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Pre-flight. Every check reads only columns that exist before this migration, so all of
    --    them run before any schema change:
    --    a. every unresolved stored value maps to exactly one assignment;
    --    b. every resolved stored value agrees with its feature's type and its upload's Blueprint;
    --    c. every property error maps to exactly one assignment;
    --    d. every narrowed predicate maps to exactly one assignment;
    --    e. every reference-target declaration has at least one assignment to move to.
    ----------------------------------------------------------------------------------------
    DO $do$
    DECLARE
      tbl text;
      offending text;
      offending_total integer;
    BEGIN
      -- a. Unresolved stored values.
      FOREACH tbl IN ARRAY ARRAY[
        'submission_feature_property_string',
        'submission_feature_property_number',
        'submission_feature_property_boolean',
        'submission_feature_property_timestamp',
        'submission_feature_property_code',
        'submission_feature_property_taxon',
        'submission_feature_property_geometry',
        'submission_feature_property_feature'
      ]
      LOOP
        EXECUTE format($q$
          WITH candidates AS (
            SELECT p.%2$I AS row_id
            FROM %1$I p
            JOIN submission_feature sf ON sf.submission_feature_id = p.submission_feature_id
            JOIN submission_upload su ON su.submission_upload_id = sf.submission_upload_id
            JOIN feature_type_property ftp ON ftp.feature_type_property_id = p.feature_type_property_id
            LEFT JOIN blueprint_feature_type bft
              ON bft.blueprint_id = su.blueprint_id
             AND bft.feature_type_id = sf.feature_type_id
            LEFT JOIN blueprint_feature_type_property bftp
              ON bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id
             AND bftp.feature_property_id = ftp.feature_property_id
            WHERE p.blueprint_feature_type_property_id IS NULL
            GROUP BY p.%2$I
            HAVING COUNT(bftp.blueprint_feature_type_property_id) <> 1
          ),
          numbered AS (
            SELECT row_id, row_number() OVER (ORDER BY row_id) AS rn FROM candidates
          )
          SELECT COUNT(*)::integer, string_agg(row_id::text, ', ' ORDER BY row_id) FILTER (WHERE rn <= 50)
          FROM numbered
        $q$, tbl, tbl || '_id')
        INTO offending_total, offending;

        IF offending_total > 0 THEN
          RAISE EXCEPTION
            '% rows in % cannot be mapped to exactly one blueprint assignment (orphan or ambiguous); first ids: %',
            offending_total, tbl, offending;
        END IF;
      END LOOP;

      -- b. Resolved stored values.
      FOREACH tbl IN ARRAY ARRAY[
        'submission_feature_property_string',
        'submission_feature_property_number',
        'submission_feature_property_boolean',
        'submission_feature_property_timestamp',
        'submission_feature_property_code',
        'submission_feature_property_taxon',
        'submission_feature_property_geometry',
        'submission_feature_property_feature',
        'submission_feature_property_artifact'
      ]
      LOOP
        EXECUTE format($q$
          SELECT COUNT(*)::integer, string_agg(p.%2$I::text, ', ') FILTER (WHERE p.%2$I IS NOT NULL)
          FROM (
            SELECT p.%2$I
            FROM %1$I p
            JOIN submission_feature sf ON sf.submission_feature_id = p.submission_feature_id
            JOIN submission_upload su ON su.submission_upload_id = sf.submission_upload_id
            JOIN blueprint_feature_type_property bftp
              ON bftp.blueprint_feature_type_property_id = p.blueprint_feature_type_property_id
            JOIN blueprint_feature_type bft
              ON bft.blueprint_feature_type_id = bftp.blueprint_feature_type_id
            WHERE bft.blueprint_id <> su.blueprint_id
               OR bft.feature_type_id <> sf.feature_type_id
            ORDER BY p.%2$I
            LIMIT 50
          ) p
        $q$, tbl, tbl || '_id')
        INTO offending_total, offending;

        IF offending_total > 0 THEN
          RAISE EXCEPTION
            'rows in % carry a blueprint assignment from another Blueprint or feature type; first ids: %',
            tbl, offending;
        END IF;
      END LOOP;

      -- c. Property errors.
      WITH candidates AS (
        SELECT e.submission_feature_error_id AS row_id
        FROM submission_feature_error e
        JOIN submission_upload su ON su.submission_upload_id = e.submission_upload_id
        JOIN feature_type_property ftp ON ftp.feature_type_property_id = e.feature_type_property_id
        LEFT JOIN blueprint_feature_type bft
          ON bft.blueprint_id = su.blueprint_id
         AND bft.feature_type_id = ftp.feature_type_id
        LEFT JOIN blueprint_feature_type_property bftp
          ON bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id
         AND bftp.feature_property_id = ftp.feature_property_id
        WHERE e.feature_type_property_id IS NOT NULL
        GROUP BY e.submission_feature_error_id
        HAVING COUNT(bftp.blueprint_feature_type_property_id) <> 1
      ),
      numbered AS (
        SELECT row_id, row_number() OVER (ORDER BY row_id) AS rn FROM candidates
      )
      SELECT COUNT(*)::integer, string_agg(row_id::text, ', ' ORDER BY row_id) FILTER (WHERE rn <= 50)
      INTO offending_total, offending
      FROM numbered;

      IF offending_total > 0 THEN
        RAISE EXCEPTION
          '% submission_feature_error rows cannot be mapped to exactly one blueprint assignment; first ids: %',
          offending_total, offending;
      END IF;

      -- d. Narrowed predicates.
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

      -- e. Reference-target declarations.
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
    -- 2. Stored values: derive the assignment for unresolved values, require it, and key on it
    --    directly.
    ----------------------------------------------------------------------------------------
    DO $do$
    DECLARE
      tbl text;
    BEGIN
      FOREACH tbl IN ARRAY ARRAY[
        'submission_feature_property_string',
        'submission_feature_property_number',
        'submission_feature_property_boolean',
        'submission_feature_property_timestamp',
        'submission_feature_property_code',
        'submission_feature_property_taxon',
        'submission_feature_property_geometry',
        'submission_feature_property_feature'
      ]
      LOOP
        EXECUTE format($q$
          UPDATE %I p
          SET blueprint_feature_type_property_id = bftp.blueprint_feature_type_property_id
          FROM submission_feature sf,
               submission_upload su,
               feature_type_property ftp,
               blueprint_feature_type bft,
               blueprint_feature_type_property bftp
          WHERE p.blueprint_feature_type_property_id IS NULL
            AND sf.submission_feature_id = p.submission_feature_id
            AND su.submission_upload_id = sf.submission_upload_id
            AND ftp.feature_type_property_id = p.feature_type_property_id
            AND bft.blueprint_id = su.blueprint_id
            AND bft.feature_type_id = sf.feature_type_id
            AND bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id
            AND bftp.feature_property_id = ftp.feature_property_id
        $q$, tbl);

        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', tbl, tbl || '_bftp_fk');
        EXECUTE format('ALTER TABLE %I ALTER COLUMN blueprint_feature_type_property_id SET NOT NULL', tbl);
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (blueprint_feature_type_property_id) REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id)',
          tbl, tbl || '_bftp_fk'
        );
        EXECUTE format(
          $c$COMMENT ON COLUMN %I.blueprint_feature_type_property_id IS 'Foreign key to blueprint_feature_type_property: the Blueprint assignment this value was stored under. Identifies the property, its feature type and its Blueprint; retained when the assignment is later retired.'$c$,
          tbl
        );
      END LOOP;
    END
    $do$;

    ALTER TABLE submission_feature_property_artifact
      DROP CONSTRAINT IF EXISTS submission_feature_property_artifact_fk3;
    ALTER TABLE submission_feature_property_artifact
      ADD CONSTRAINT submission_feature_property_artifact_bftp_fk
      FOREIGN KEY (blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id);

    ----------------------------------------------------------------------------------------
    -- 3. Ingestion errors: reference the assignment, map existing property errors, aggregate on it.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_feature_error ADD COLUMN blueprint_feature_type_property_id integer;

    ALTER TABLE submission_feature_error
      ADD CONSTRAINT submission_feature_error_fk3
      FOREIGN KEY (blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id);

    COMMENT ON COLUMN submission_feature_error.blueprint_feature_type_property_id IS 'Foreign key to blueprint_feature_type_property: the assignment, within the upload''s Blueprint, of the property the error concerns. Null for errors that are not about a property.';

    UPDATE submission_feature_error e
    SET blueprint_feature_type_property_id = bftp.blueprint_feature_type_property_id
    FROM submission_upload su,
         feature_type_property ftp,
         blueprint_feature_type bft,
         blueprint_feature_type_property bftp
    WHERE e.feature_type_property_id IS NOT NULL
      AND su.submission_upload_id = e.submission_upload_id
      AND ftp.feature_type_property_id = e.feature_type_property_id
      AND bft.blueprint_id = su.blueprint_id
      AND bft.feature_type_id = ftp.feature_type_id
      AND bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id
      AND bftp.feature_property_id = ftp.feature_property_id;

    DROP INDEX IF EXISTS submission_feature_error_u1;
    CREATE UNIQUE INDEX submission_feature_error_u1
      ON submission_feature_error (
        submission_upload_id,
        error_code,
        blueprint_feature_type_property_id,
        property_name
      );

    CREATE INDEX submission_feature_error_idx4
      ON submission_feature_error (submission_upload_id, blueprint_feature_type_property_id);

    ----------------------------------------------------------------------------------------
    -- 4. Predicates: reference the assignment, map narrowed predicates, validate the reference
    --    instead of the pairing.
    ----------------------------------------------------------------------------------------
    ALTER TABLE predicate ADD COLUMN blueprint_feature_type_property_id integer;

    ALTER TABLE predicate
      ADD CONSTRAINT predicate_fk4
      FOREIGN KEY (blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id);

    CREATE INDEX predicate_idx6 ON predicate (blueprint_feature_type_property_id);
    CREATE INDEX predicate_idx7 ON predicate (blueprint_feature_type_property_id) WHERE record_end_date IS NULL;

    COMMENT ON COLUMN predicate.blueprint_feature_type_property_id IS 'Optional foreign key to blueprint_feature_type_property. When set, the predicate applies only to values stored under this assignment; when null, it applies to the property under every assignment.';

    UPDATE predicate p
    SET blueprint_feature_type_property_id = bftp.blueprint_feature_type_property_id
    FROM blueprint_feature_type_property bftp
    WHERE p.feature_type_property_id IS NOT NULL
      AND bftp.feature_type_property_id = p.feature_type_property_id;

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

    ----------------------------------------------------------------------------------------
    -- 5. Reference targets: re-home each declaration onto every assignment that carries its
    --    pairing, and only let a feature-valued assignment declare targets.
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
 * Reverses {@link up}, in the opposite order of its sections.
 *
 * Reference targets collapse to one declaration per (pairing, target); the surviving row is the one with
 * the smallest identifier, which is the original where it still exists. The predicate trigger returns to
 * the pairing check from `20260515123000`. Ingestion errors aggregate on the pairing again. Stored values
 * keep their derived assignments but the assignment becomes optional and the composite keys are restored;
 * restoring a composite key fails if a derived assignment carries a different pairing id than its row,
 * which is the case the plain key was introduced for.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 5. Reference targets.
    ----------------------------------------------------------------------------------------
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

    ----------------------------------------------------------------------------------------
    -- 4. Predicates.
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

    ----------------------------------------------------------------------------------------
    -- 3. Ingestion errors.
    ----------------------------------------------------------------------------------------
    DROP INDEX IF EXISTS submission_feature_error_idx4;

    DROP INDEX IF EXISTS submission_feature_error_u1;
    CREATE UNIQUE INDEX submission_feature_error_u1
      ON submission_feature_error (
        submission_upload_id,
        error_code,
        feature_type_property_id,
        property_name
      );

    ALTER TABLE submission_feature_error DROP CONSTRAINT IF EXISTS submission_feature_error_fk3;
    ALTER TABLE submission_feature_error DROP COLUMN IF EXISTS blueprint_feature_type_property_id;

    ----------------------------------------------------------------------------------------
    -- 2. Stored values.
    ----------------------------------------------------------------------------------------
    DO $do$
    DECLARE
      tbl text;
    BEGIN
      FOREACH tbl IN ARRAY ARRAY[
        'submission_feature_property_string',
        'submission_feature_property_number',
        'submission_feature_property_boolean',
        'submission_feature_property_timestamp',
        'submission_feature_property_code',
        'submission_feature_property_taxon',
        'submission_feature_property_geometry',
        'submission_feature_property_feature'
      ]
      LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', tbl, tbl || '_bftp_fk');
        EXECUTE format('ALTER TABLE %I ALTER COLUMN blueprint_feature_type_property_id DROP NOT NULL', tbl);
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (feature_type_property_id, blueprint_feature_type_property_id) REFERENCES blueprint_feature_type_property(feature_type_property_id, blueprint_feature_type_property_id)',
          tbl, tbl || '_bftp_fk'
        );
        EXECUTE format(
          $c$COMMENT ON COLUMN %I.blueprint_feature_type_property_id IS 'Foreign key to blueprint_feature_type_property: the Blueprint assignment used to validate/index this property. feature_type_property_id remains the primary property reference used by search and data access.'$c$,
          tbl
        );
      END LOOP;
    END
    $do$;

    ALTER TABLE submission_feature_property_artifact
      DROP CONSTRAINT IF EXISTS submission_feature_property_artifact_bftp_fk;
    ALTER TABLE submission_feature_property_artifact
      ADD CONSTRAINT submission_feature_property_artifact_fk3
      FOREIGN KEY (feature_type_property_id, blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(feature_type_property_id, blueprint_feature_type_property_id);
  `);
}
