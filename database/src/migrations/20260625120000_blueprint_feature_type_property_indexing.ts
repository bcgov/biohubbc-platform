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
 * left null — the column is optional metadata for historical rows, so there is no guard and nothing is dropped.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Use timestamptz for submission_feature lifecycle columns.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_feature
      ALTER COLUMN record_effective_date TYPE timestamptz(6) USING record_effective_date::timestamptz(6),
      ALTER COLUMN record_end_date TYPE timestamptz(6) USING record_end_date::timestamptz(6);

    ----------------------------------------------------------------------------------------
    -- 2. Add a composite uniqueness constraint on blueprint_feature_type_property.
    --
    -- This is not a key change; it only gives the canonical property tables a composite
    -- FK target so each stored Blueprint assignment must match the stored feature_type_property_id.
    ----------------------------------------------------------------------------------------
    ALTER TABLE blueprint_feature_type_property
      ADD CONSTRAINT blueprint_feature_type_property_uk2
      UNIQUE (feature_type_property_id, blueprint_feature_type_property_id);

    ----------------------------------------------------------------------------------------
    -- 3. Add Blueprint provenance to upload-scoped staging tables.
    --
    -- Existing staging tables are UNLOGGED working tables. Columns are nullable in the migration
    -- so the migration cannot fail on any transient rows present during deployment; the indexing
    -- pipeline only forwards rows whose Blueprint assignment resolved.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_upload_staging_resolved_property
      ADD COLUMN blueprint_feature_type_property_id integer;

    ALTER TABLE submission_upload_staging_typed_property_value
      ADD COLUMN blueprint_feature_type_property_id integer;

    ALTER TABLE submission_upload_staging_datetime_candidate
      ADD COLUMN blueprint_feature_type_property_id integer;

    ALTER TABLE submission_upload_staging_spatial_candidate
      ADD COLUMN blueprint_feature_type_property_id integer;

    ALTER TABLE submission_upload_staging_code_candidate
      ADD COLUMN blueprint_feature_type_property_id integer;

    ALTER TABLE submission_upload_staging_taxon_candidate
      ADD COLUMN blueprint_feature_type_property_id integer;

    ALTER TABLE submission_upload_staging_artifact_candidate
      ADD COLUMN blueprint_feature_type_property_id integer;

    ALTER TABLE submission_upload_staging_feature_candidate
      ADD COLUMN blueprint_feature_type_property_id integer;

    CREATE INDEX sf_resolved_work_idx5
      ON submission_upload_staging_resolved_property (submission_upload_id, blueprint_feature_type_property_id);
    CREATE INDEX sf_property_value_work_idx5
      ON submission_upload_staging_typed_property_value (submission_upload_id, blueprint_feature_type_property_id);
    CREATE INDEX sf_datetime_candidate_work_idx3
      ON submission_upload_staging_datetime_candidate (submission_upload_id, blueprint_feature_type_property_id);
    CREATE INDEX sf_spatial_candidate_work_idx3
      ON submission_upload_staging_spatial_candidate (submission_upload_id, blueprint_feature_type_property_id);
    CREATE INDEX sf_code_candidate_work_idx3
      ON submission_upload_staging_code_candidate (submission_upload_id, blueprint_feature_type_property_id);
    CREATE INDEX sf_taxon_candidate_work_idx3
      ON submission_upload_staging_taxon_candidate (submission_upload_id, blueprint_feature_type_property_id);
    CREATE INDEX sf_artifact_candidate_work_idx3
      ON submission_upload_staging_artifact_candidate (submission_upload_id, blueprint_feature_type_property_id);
    CREATE INDEX sf_feature_candidate_work_idx3
      ON submission_upload_staging_feature_candidate (submission_upload_id, blueprint_feature_type_property_id);

    COMMENT ON COLUMN submission_upload_staging_resolved_property.blueprint_feature_type_property_id IS
      'Resolved Blueprint property assignment identifier when mapping exists.';
    COMMENT ON COLUMN submission_upload_staging_typed_property_value.blueprint_feature_type_property_id IS
      'Resolved Blueprint property assignment identifier.';
    COMMENT ON COLUMN submission_upload_staging_datetime_candidate.blueprint_feature_type_property_id IS
      'Resolved Blueprint datetime property assignment identifier.';
    COMMENT ON COLUMN submission_upload_staging_spatial_candidate.blueprint_feature_type_property_id IS
      'Resolved Blueprint spatial property assignment identifier.';
    COMMENT ON COLUMN submission_upload_staging_code_candidate.blueprint_feature_type_property_id IS
      'Resolved Blueprint code property assignment identifier.';
    COMMENT ON COLUMN submission_upload_staging_taxon_candidate.blueprint_feature_type_property_id IS
      'Resolved Blueprint taxon property assignment identifier.';
    COMMENT ON COLUMN submission_upload_staging_artifact_candidate.blueprint_feature_type_property_id IS
      'Resolved Blueprint artifact property assignment identifier.';
    COMMENT ON COLUMN submission_upload_staging_feature_candidate.blueprint_feature_type_property_id IS
      'Resolved Blueprint feature-reference property assignment identifier.';

    ----------------------------------------------------------------------------------------
    -- 4. Add Blueprint provenance to canonical typed property tables.
    --
    -- Historical rows are backfilled best-effort. Rows whose old property assignment cannot
    -- be resolved remain null; new indexing carries the resolved Blueprint assignment through
    -- staging and writes it with each canonical value.
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
        EXECUTE format('ALTER TABLE %I ADD COLUMN blueprint_feature_type_property_id integer', tbl);

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

        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (feature_type_property_id, blueprint_feature_type_property_id) REFERENCES blueprint_feature_type_property(feature_type_property_id, blueprint_feature_type_property_id)',
          tbl, tbl || '_bftp_fk'
        );

        EXECUTE format('CREATE INDEX %I ON %I (blueprint_feature_type_property_id)', tbl || '_bftp_idx', tbl);

        EXECUTE format(
          $c$COMMENT ON COLUMN %I.blueprint_feature_type_property_id IS 'Foreign key to blueprint_feature_type_property: the Blueprint assignment used to validate/index this property. feature_type_property_id remains the primary property reference used by search and data access.'$c$,
          tbl
        );
      END LOOP;
    END
    $do$;
  `);
}

/**
 * Drop the provenance column and its FK from each property table.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Drop Blueprint provenance from canonical typed property tables.
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
        EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS blueprint_feature_type_property_id', tbl);
      END LOOP;
    END
    $do$;

    ----------------------------------------------------------------------------------------
    -- 2. Drop Blueprint provenance from upload-scoped staging tables.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_upload_staging_feature_candidate
      DROP COLUMN IF EXISTS blueprint_feature_type_property_id;
    ALTER TABLE submission_upload_staging_artifact_candidate
      DROP COLUMN IF EXISTS blueprint_feature_type_property_id;
    ALTER TABLE submission_upload_staging_taxon_candidate
      DROP COLUMN IF EXISTS blueprint_feature_type_property_id;
    ALTER TABLE submission_upload_staging_code_candidate
      DROP COLUMN IF EXISTS blueprint_feature_type_property_id;
    ALTER TABLE submission_upload_staging_spatial_candidate
      DROP COLUMN IF EXISTS blueprint_feature_type_property_id;
    ALTER TABLE submission_upload_staging_datetime_candidate
      DROP COLUMN IF EXISTS blueprint_feature_type_property_id;
    ALTER TABLE submission_upload_staging_typed_property_value
      DROP COLUMN IF EXISTS blueprint_feature_type_property_id;
    ALTER TABLE submission_upload_staging_resolved_property
      DROP COLUMN IF EXISTS blueprint_feature_type_property_id;

    ----------------------------------------------------------------------------------------
    -- 3. Drop the composite uniqueness constraint from blueprint_feature_type_property.
    ----------------------------------------------------------------------------------------
    ALTER TABLE blueprint_feature_type_property
      DROP CONSTRAINT IF EXISTS blueprint_feature_type_property_uk2;

    ----------------------------------------------------------------------------------------
    -- 4. Restore submission_feature lifecycle columns to their previous date type.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_feature
      ALTER COLUMN record_effective_date TYPE date USING record_effective_date::date,
      ALTER COLUMN record_end_date TYPE date USING record_end_date::date;
  `);
}
