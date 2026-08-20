import type { Knex } from 'knex';

/**
 * Add active-row lookup indexes for resolving taxa by TSN and case-insensitive scientific name.
 *
 * User-facing taxon lookup only resolves active taxa. Ingestion paths that need to resolve legacy
 * soft-deleted taxa should use explicit include-inactive queries instead of these active partial indexes.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE INDEX IF NOT EXISTS taxon_itis_tsn_idx
      ON taxon (itis_tsn)
      WHERE record_end_date IS NULL;

    CREATE INDEX IF NOT EXISTS taxon_scientific_name_lower_idx
      ON taxon (LOWER(itis_scientific_name))
      WHERE record_end_date IS NULL;
  `);
}

/**
 * Remove the active-row taxon lookup indexes.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS taxon_scientific_name_lower_idx;
    DROP INDEX IF EXISTS taxon_itis_tsn_idx;
  `);
}
