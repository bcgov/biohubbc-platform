import { Knex } from 'knex';

/**
 * Backfill the Blueprint-assignment provenance column on seeded property rows.
 *
 * The durable `submission_feature_property_*` tables carry a nullable `blueprint_feature_type_property_id`
 * recording which Blueprint assignment the indexing job used. The seeds insert property rows directly
 * (bypassing the indexing job), so this runs last — after every seed that creates property rows — and
 * populates the column for all of them, mirroring what the indexing job records on real uploads.
 *
 * Mapping is the same as the migration backfill: `feature_type_property_id` -> the assignment in the
 * feature's pinned Blueprint (`submission_feature` -> `submission_upload.blueprint_id`). The column is
 * nullable, so any row that does not resolve simply stays null. Idempotent — safe to re-run.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = 'biohub','public';

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
            AND p.blueprint_feature_type_property_id IS NULL
        $q$, tbl);
      END LOOP;
    END
    $do$;
  `);
}
