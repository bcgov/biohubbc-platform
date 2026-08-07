import type { Knex } from 'knex';

/**
 * Give each submission upload a single owning team.
 *
 * Existing uploads receive a dedicated empty team. New uploads create their team in the
 * application service before the upload record is inserted.
 *
 * @export
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Add nullable upload team ownership.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_upload
      ADD COLUMN team_id uuid;

    ----------------------------------------------------------------------------------------
    -- 2. Create an empty team for each existing submission upload.
    ----------------------------------------------------------------------------------------
    WITH submission_upload_team_backfill AS (
      SELECT
        submission_upload_id,
        upload_id,
        create_user,
        public.gen_random_uuid() AS team_id
      FROM submission_upload
    ),
    inserted_team AS (
      INSERT INTO team (
        team_id,
        name,
        description,
        create_user
      )
      SELECT
        team_id,
        'Submission Upload Team ' || team_id,
        'Auto-generated access team for submission upload ' || upload_id || '.',
        create_user
      FROM submission_upload_team_backfill
      RETURNING team_id
    )
    UPDATE submission_upload
    SET team_id = backfill.team_id
    FROM submission_upload_team_backfill backfill
    JOIN inserted_team
      ON inserted_team.team_id = backfill.team_id
    WHERE backfill.submission_upload_id = submission_upload.submission_upload_id;

    ----------------------------------------------------------------------------------------
    -- 3. Enforce upload team ownership after the backfill.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_upload
      ALTER COLUMN team_id SET NOT NULL,
      ADD CONSTRAINT submission_upload_team_fk
        FOREIGN KEY (team_id) REFERENCES team(team_id);

    CREATE INDEX submission_upload_team_idx
      ON submission_upload(team_id);

    COMMENT ON COLUMN submission_upload.team_id IS
      'Foreign key to the single team whose members may access this submission upload.';
  `);
}

/**
 * Remove upload-level team ownership.
 *
 * @export
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Remove the upload team ownership constraint.
    ----------------------------------------------------------------------------------------
    DROP INDEX IF EXISTS submission_upload_team_idx;

    ALTER TABLE submission_upload
      DROP CONSTRAINT IF EXISTS submission_upload_team_fk;

    ----------------------------------------------------------------------------------------
    -- 2. Remove teams that only supported upload ownership.
    ----------------------------------------------------------------------------------------
    DELETE FROM team_member
    WHERE team_id IN (
      SELECT team_id
      FROM submission_upload
    );

    DELETE FROM team
    WHERE team_id IN (
      SELECT team_id
      FROM submission_upload
    );

    ----------------------------------------------------------------------------------------
    -- 3. Remove upload team ownership from submission_upload.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_upload
      DROP COLUMN IF EXISTS team_id;
  `);
}
