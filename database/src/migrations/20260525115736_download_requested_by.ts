import { Knex } from 'knex';

/**
 * Adds download.requested_by: the create-time security identity an export is
 * built with. Set to the requesting user for authenticated downloads, NULL for
 * anonymous public-by-link downloads. Backfills existing rows from create_user,
 * which predate anonymous downloads and so identify the authenticated requester.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Add download.requested_by: the create-time security identity (NULL = anonymous).
    --------------------------------------------------------------------------------
    ALTER TABLE download ADD COLUMN requested_by integer;

    --------------------------------------------------------------------------------
    -- Backfill requested_by from create_user.
    --
    -- Every existing row predates anonymous downloads, so under the old flow its
    -- audit create_user IS the authenticated requester. Seed requested_by from it.
    --------------------------------------------------------------------------------
    UPDATE download SET requested_by = create_user WHERE requested_by IS NULL;

    --------------------------------------------------------------------------------
    -- Add the requested_by FK + supporting index.
    --------------------------------------------------------------------------------
    ALTER TABLE download ADD CONSTRAINT download_requested_by_fk
      FOREIGN KEY (requested_by) REFERENCES "system_user"(system_user_id);

    CREATE INDEX download_requested_by_idx ON download(requested_by);

    COMMENT ON COLUMN download.requested_by IS 'Security identity the export is built with: the requesting user for authenticated downloads, NULL for anonymous public-by-link downloads. Snapshot at creation — never derived from live team state — so a later claim cannot retroactively widen what an anonymous download packaged. Distinct from create_user, which records who inserted the row.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Drop download.requested_by and its supporting index/constraint.
    --------------------------------------------------------------------------------
    DROP INDEX IF EXISTS download_requested_by_idx;
    ALTER TABLE download DROP CONSTRAINT IF EXISTS download_requested_by_fk;
    ALTER TABLE download DROP COLUMN IF EXISTS requested_by;
  `);
}
