import { Knex } from 'knex';

/**
 * Point staged and indexed property rows at Blueprint property assignments.
 *
 * The feature-property indexing job previously carried the canonical `feature_type_property_id`
 * surrogate through its upload-scoped staging tables and into the durable `submission_feature_property_*`
 * tables. Now that Blueprints exist (see `20260616120000_add_blueprint_tables.ts`), these rows should
 * instead reference the Blueprint assignment (`blueprint_feature_type_property_id`) so an indexed value
 * can be traced back to the exact schema configuration the indexing job used. The canonical
 * `feature_type_property_id` remains reachable with a single join through `blueprint_feature_type_property`.
 *
 * This migration:
 * 1. Renames `feature_type_property_id` -> `blueprint_feature_type_property_id` on the UNLOGGED
 *    upload-scoped staging tables (ephemeral working data; no foreign keys exist on these columns).
 * 2. On the durable `submission_feature_property_*` tables and `submission_feature_error`, repoints the
 *    column at `blueprint_feature_type_property` AND translates existing data. All environments hold real
 *    rows, and the stored `feature_type_property_id` integers are NOT equal to the Blueprint-assignment
 *    ids, so a bare rename would silently mis-map every row. Each value is translated to the
 *    `blueprint_feature_type_property` row for the feature's pinned Blueprint
 *    (`submission_feature -> submission_upload.blueprint_id`). The Blueprint migrations (`20260616120000`,
 *    the `20260616130000` seed assigning every active property to the default Blueprint, and the
 *    `20260619120000` backfill of `submission_upload.blueprint_id`) run earlier in the same deploy, so the
 *    mapping is available.
 *
 * The migration HALTS (RAISE EXCEPTION, whole migration rolls back) if any row cannot be mapped — it never
 * drops or guesses. The expected unmapped count is zero; the most likely real cause of a non-zero count is
 * an indexed row referencing a since-soft-deleted `feature_type_property`. Run the pre-deploy orphan check
 * (see the PR) on TEST/PROD before promoting to catch that without a failed deploy.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Rename the surrogate on the UNLOGGED upload-scoped staging tables.
    --    These have no foreign key on the column, so a plain rename is sufficient; indexes
    --    referencing the column follow the rename automatically.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_upload_staging_resolved_property
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    COMMENT ON COLUMN submission_upload_staging_resolved_property.blueprint_feature_type_property_id IS
      'Resolved blueprint_feature_type_property identifier (the Blueprint assignment) when the selected Blueprint assigns the property.';

    ALTER TABLE submission_upload_staging_typed_property_value
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    COMMENT ON COLUMN submission_upload_staging_typed_property_value.blueprint_feature_type_property_id IS
      'Resolved blueprint_feature_type_property identifier (the Blueprint assignment).';

    ALTER TABLE submission_upload_staging_datetime_candidate
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    COMMENT ON COLUMN submission_upload_staging_datetime_candidate.blueprint_feature_type_property_id IS
      'Resolved datetime blueprint_feature_type_property identifier (the Blueprint assignment).';

    ALTER TABLE submission_upload_staging_spatial_candidate
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    COMMENT ON COLUMN submission_upload_staging_spatial_candidate.blueprint_feature_type_property_id IS
      'Resolved spatial blueprint_feature_type_property identifier (the Blueprint assignment).';

    ALTER TABLE submission_upload_staging_code_candidate
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    COMMENT ON COLUMN submission_upload_staging_code_candidate.blueprint_feature_type_property_id IS
      'Resolved code blueprint_feature_type_property identifier (the Blueprint assignment).';

    ALTER TABLE submission_upload_staging_taxon_candidate
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    COMMENT ON COLUMN submission_upload_staging_taxon_candidate.blueprint_feature_type_property_id IS
      'Resolved taxon blueprint_feature_type_property identifier (the Blueprint assignment).';

    ALTER TABLE submission_upload_staging_artifact_candidate
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    COMMENT ON COLUMN submission_upload_staging_artifact_candidate.blueprint_feature_type_property_id IS
      'Resolved artifact blueprint_feature_type_property identifier (the Blueprint assignment).';

    ALTER TABLE submission_upload_staging_feature_candidate
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    COMMENT ON COLUMN submission_upload_staging_feature_candidate.blueprint_feature_type_property_id IS
      'Resolved feature-reference blueprint_feature_type_property identifier (the Blueprint assignment).';

    ----------------------------------------------------------------------------------------
    -- 2. Repoint AND translate the durable submission_feature_property_* tables. For each: drop the FK to
    --    feature_type_property, rename the column (indexes/unique constraints follow), guard that every
    --    row maps to an assignment in the feature's pinned Blueprint, translate the values in place, then
    --    add the FK to blueprint_feature_type_property. All eight tables share the same submission_feature
    --    -> submission_upload.blueprint_id mapping, so they are handled in one loop.
    ----------------------------------------------------------------------------------------
    DO $do$
    DECLARE
      tbl      text;
      unmapped bigint;
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
        -- Drop the FK to feature_type_property and rename the column; the column transiently holds the OLD
        -- feature_type_property_id values under the new name (no FK enforced during translation).
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', tbl, tbl || '_fk2');
        EXECUTE format(
          'ALTER TABLE %I RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id',
          tbl
        );

        -- Guard: any row whose old value has no assignment in the feature's pinned Blueprint (checked on
        -- the still-old values, so it reliably catches what the UPDATE below would leave untranslated).
        EXECUTE format($q$
          SELECT count(*)
          FROM %I p
          WHERE NOT EXISTS (
            SELECT 1
            FROM submission_feature sf
            JOIN submission_upload su ON su.submission_upload_id = sf.submission_upload_id
            JOIN blueprint_feature_type bft
              ON bft.blueprint_id = su.blueprint_id
             AND bft.feature_type_id = sf.feature_type_id
             AND bft.record_end_date IS NULL
            JOIN blueprint_feature_type_property bftp
              ON bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id
             AND bftp.feature_type_property_id = p.blueprint_feature_type_property_id
             AND bftp.record_end_date IS NULL
            WHERE sf.submission_feature_id = p.submission_feature_id
          )
        $q$, tbl) INTO unmapped;

        IF unmapped > 0 THEN
          RAISE EXCEPTION
            '%: % indexed row(s) reference a feature_type_property with no assignment in the upload''s pinned Blueprint; cannot translate to blueprint_feature_type_property_id',
            tbl, unmapped;
        END IF;

        -- Translate in place: the join reads the OLD feature_type_property_id; SET writes the Blueprint
        -- assignment id. Unique (blueprint_feature_type_id, feature_type_property_id) guarantees one match.
        EXECUTE format($q$
          UPDATE %I p
          SET blueprint_feature_type_property_id = bftp.blueprint_feature_type_property_id
          FROM submission_feature sf,
               submission_upload su,
               blueprint_feature_type bft,
               blueprint_feature_type_property bftp
          WHERE sf.submission_feature_id = p.submission_feature_id
            AND su.submission_upload_id = sf.submission_upload_id
            AND bft.blueprint_id = su.blueprint_id
            AND bft.feature_type_id = sf.feature_type_id
            AND bft.record_end_date IS NULL
            AND bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id
            AND bftp.feature_type_property_id = p.blueprint_feature_type_property_id
            AND bftp.record_end_date IS NULL
        $q$, tbl);

        -- Repoint the FK at blueprint_feature_type_property and document the column.
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (blueprint_feature_type_property_id) REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id)',
          tbl, tbl || '_fk2'
        );
        EXECUTE format(
          $c$COMMENT ON COLUMN %I.blueprint_feature_type_property_id IS 'Foreign key to the blueprint_feature_type_property table (the Blueprint assignment that produced this value).'$c$,
          tbl
        );
      END LOOP;
    END
    $do$;

    ----------------------------------------------------------------------------------------
    -- 3. Repoint AND translate the indexing-engine error table so reported errors trace to the same
    --    schema configuration as the rows they came from. Nullable: only non-null rows translate. It has
    --    no feature_type_id column, so the feature type is read from feature_type_property.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_feature_error DROP CONSTRAINT submission_feature_error_fk2;
    ALTER TABLE submission_feature_error
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;

    DO $do$
    DECLARE
      unmapped bigint;
    BEGIN
      SELECT count(*)
      INTO unmapped
      FROM submission_feature_error e
      WHERE e.blueprint_feature_type_property_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM feature_type_property ftp
          JOIN submission_upload su ON su.submission_upload_id = e.submission_upload_id
          JOIN blueprint_feature_type bft
            ON bft.blueprint_id = su.blueprint_id
           AND bft.feature_type_id = ftp.feature_type_id
           AND bft.record_end_date IS NULL
          JOIN blueprint_feature_type_property bftp
            ON bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id
           AND bftp.feature_type_property_id = e.blueprint_feature_type_property_id
           AND bftp.record_end_date IS NULL
          WHERE ftp.feature_type_property_id = e.blueprint_feature_type_property_id
        );

      IF unmapped > 0 THEN
        RAISE EXCEPTION
          'submission_feature_error: % row(s) reference a feature_type_property with no assignment in the upload''s pinned Blueprint; cannot translate to blueprint_feature_type_property_id',
          unmapped;
      END IF;
    END
    $do$;

    UPDATE submission_feature_error e
    SET blueprint_feature_type_property_id = bftp.blueprint_feature_type_property_id
    FROM feature_type_property ftp,
         submission_upload su,
         blueprint_feature_type bft,
         blueprint_feature_type_property bftp
    WHERE e.blueprint_feature_type_property_id IS NOT NULL
      AND ftp.feature_type_property_id = e.blueprint_feature_type_property_id
      AND su.submission_upload_id = e.submission_upload_id
      AND bft.blueprint_id = su.blueprint_id
      AND bft.feature_type_id = ftp.feature_type_id
      AND bft.record_end_date IS NULL
      AND bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id
      AND bftp.feature_type_property_id = e.blueprint_feature_type_property_id
      AND bftp.record_end_date IS NULL;

    ALTER TABLE submission_feature_error ADD CONSTRAINT submission_feature_error_fk2
      FOREIGN KEY (blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id);
    COMMENT ON COLUMN submission_feature_error.blueprint_feature_type_property_id IS 'Foreign key to the blueprint_feature_type_property table (the Blueprint assignment the error pertains to); null for errors not tied to a resolved property assignment.';
  `);
}

/**
 * Reverse the rename: repoint staged and indexed property rows back at `feature_type_property_id`.
 *
 * For the durable tables: drop the FK to `blueprint_feature_type_property`, rename the column back, and
 * restore the FK to `feature_type_property`.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Restore the indexing-engine error table: reverse-translate non-null rows back to
    --    feature_type_property_id, then rename and restore the FK to feature_type_property.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_feature_error DROP CONSTRAINT submission_feature_error_fk2;

    UPDATE submission_feature_error e
    SET blueprint_feature_type_property_id = bftp.feature_type_property_id
    FROM blueprint_feature_type_property bftp
    WHERE bftp.blueprint_feature_type_property_id = e.blueprint_feature_type_property_id;

    ALTER TABLE submission_feature_error
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_feature_error ADD CONSTRAINT submission_feature_error_fk2
      FOREIGN KEY (feature_type_property_id)
      REFERENCES feature_type_property(feature_type_property_id);

    ----------------------------------------------------------------------------------------
    -- 2. Restore the durable submission_feature_property_* tables: drop the FK, reverse-translate the
    --    Blueprint assignment id back to feature_type_property_id (always succeeds — every value is a valid
    --    blueprint_feature_type_property_id per the FK), rename back, and restore the old FK.
    ----------------------------------------------------------------------------------------
    DO $do$
    DECLARE
      tbl text;
    BEGIN
      FOREACH tbl IN ARRAY ARRAY[
        'submission_feature_property_feature',
        'submission_feature_property_geometry',
        'submission_feature_property_taxon',
        'submission_feature_property_code',
        'submission_feature_property_timestamp',
        'submission_feature_property_boolean',
        'submission_feature_property_number',
        'submission_feature_property_string'
      ]
      LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', tbl, tbl || '_fk2');
        EXECUTE format($q$
          UPDATE %I p
          SET blueprint_feature_type_property_id = bftp.feature_type_property_id
          FROM blueprint_feature_type_property bftp
          WHERE bftp.blueprint_feature_type_property_id = p.blueprint_feature_type_property_id
        $q$, tbl);
        EXECUTE format(
          'ALTER TABLE %I RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id',
          tbl
        );
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (feature_type_property_id) REFERENCES feature_type_property(feature_type_property_id)',
          tbl, tbl || '_fk2'
        );
      END LOOP;
    END
    $do$;

    ----------------------------------------------------------------------------------------
    -- 3. Restore the UNLOGGED upload-scoped staging tables.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_upload_staging_feature_candidate
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_upload_staging_artifact_candidate
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_upload_staging_taxon_candidate
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_upload_staging_code_candidate
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_upload_staging_spatial_candidate
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_upload_staging_datetime_candidate
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_upload_staging_typed_property_value
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_upload_staging_resolved_property
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
  `);
}
