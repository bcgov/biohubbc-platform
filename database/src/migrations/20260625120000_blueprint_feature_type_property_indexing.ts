import { Knex } from 'knex';

/**
 * Record which Blueprint assignment was used to index each property value.
 *
 * Adds a nullable `blueprint_feature_type_property_id` provenance column (FK -> blueprint_feature_type_property)
 * to the durable `submission_feature_property_*` tables. `feature_type_property_id` remains the primary
 * property reference used by search and data access; this column is secondary validation/provenance
 * metadata recording the Blueprint assignment the indexing job resolved the property through.
 *
 * Existing rows are backfilled best-effort by mapping `feature_type_property_id` through the feature's
 * pinned Blueprint (`submission_feature` -> `submission_upload.blueprint_id`). Rows that do not resolve are
 * left null — the column is optional metadata, so there is no guard and nothing is dropped.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

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
        -- Nullable provenance column + FK to the Blueprint assignment + lookup index.
        EXECUTE format('ALTER TABLE %I ADD COLUMN blueprint_feature_type_property_id integer', tbl);

        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (blueprint_feature_type_property_id) REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id)',
          tbl, tbl || '_bftp_fk'
        );

        EXECUTE format('CREATE INDEX %I ON %I (blueprint_feature_type_property_id)', tbl || '_bftp_idx', tbl);

        EXECUTE format(
          $c$COMMENT ON COLUMN %I.blueprint_feature_type_property_id IS 'Foreign key to blueprint_feature_type_property: the Blueprint assignment used to validate/index this property. Nullable provenance metadata; feature_type_property_id remains the primary property reference.'$c$,
          tbl
        );

        -- Best-effort backfill of existing rows via the feature's pinned Blueprint; unresolved rows stay null.
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
            AND bftp.feature_type_property_id = p.feature_type_property_id
            AND bftp.record_end_date IS NULL
        $q$, tbl);
      END LOOP;
    END
    $do$;
  `);
}

/**
 * Drop the provenance column, its FK, and its index from each property table.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

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
        EXECUTE format('DROP INDEX IF EXISTS %I', tbl || '_bftp_idx');
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', tbl, tbl || '_bftp_fk');
        EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS blueprint_feature_type_property_id', tbl);
      END LOOP;
    END
    $do$;
  `);
}
