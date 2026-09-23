import type { Knex } from 'knex';

/**
 * Key ingestion error summaries on the Blueprint assignment instead of the global pairing.
 *
 * `submission_feature_error` aggregates one row per (upload, error code, property, property name). The
 * property was identified by `feature_type_property_id`, which named a property within a feature type.
 * `blueprint_feature_type_property_id` names the same thing within the upload's Blueprint, so grouping on
 * it keeps errors for the same property under different feature types apart, as before.
 *
 * Existing rows are mapped through the upload's Blueprint; a row whose pairing does not resolve to
 * exactly one assignment there fails the migration. Rows with no property (reference and parent
 * errors) keep a null key and, as before, never merge on conflict.
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
    ALTER TABLE submission_feature_error ADD COLUMN blueprint_feature_type_property_id integer;

    ALTER TABLE submission_feature_error
      ADD CONSTRAINT submission_feature_error_fk3
      FOREIGN KEY (blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id);

    COMMENT ON COLUMN submission_feature_error.blueprint_feature_type_property_id IS 'Foreign key to blueprint_feature_type_property: the assignment, within the upload''s Blueprint, of the property the error concerns. Null for errors that are not about a property.';

    ----------------------------------------------------------------------------------------
    -- 2. Pre-flight: every property error must map to exactly one assignment.
    ----------------------------------------------------------------------------------------
    DO $do$
    DECLARE
      offending text;
      offending_total integer;
    BEGIN
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
    END
    $do$;

    ----------------------------------------------------------------------------------------
    -- 3. Map existing property errors.
    ----------------------------------------------------------------------------------------
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

    ----------------------------------------------------------------------------------------
    -- 4. Aggregate on the assignment.
    ----------------------------------------------------------------------------------------
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
  `);
}

/**
 * Reverses {@link up}: aggregate on the global pairing again and drop the assignment reference.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

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
  `);
}
