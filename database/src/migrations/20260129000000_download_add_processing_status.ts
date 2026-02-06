import { Knex } from 'knex';

/**
 * Migration to add 'processing' status to the download_status enum.
 *
 * This status indicates the download job is actively being processed.
 * Replaces the previous 'started' terminology for clarity.
 *
 * See: SIMSBIOHUB-823
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    -- Add 'processing' value to download_status enum
    ALTER TYPE download_status ADD VALUE IF NOT EXISTS 'processing' AFTER 'pending';

    -- Update comment to reflect new status
    COMMENT ON COLUMN download.download_status IS 'Download status: pending, processing, ready, downloaded, or failed.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  // PostgreSQL does not support removing values from an enum type.
  // The 'processing' value will remain but be unused if this migration is rolled back.
  // To fully remove it, you would need to recreate the type and migrate data.
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    -- Revert comment
    COMMENT ON COLUMN download.download_status IS 'Download status: pending, ready, downloaded, or failed.';
  `);
}
