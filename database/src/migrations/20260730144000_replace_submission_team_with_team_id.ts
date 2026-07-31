import type { Knex } from 'knex';

/**
 * Replace the submission-to-team many-to-many relationship with one team per submission.
 *
 * Existing submissions receive a dedicated empty team. New submissions create their team in the
 * application service before the submission record is inserted.
 *
 * @export
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Add nullable submission team ownership.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission
      ADD COLUMN team_id uuid;

    ----------------------------------------------------------------------------------------
    -- 2. Create an empty team for each existing submission.
    ----------------------------------------------------------------------------------------
    WITH submission_team_backfill AS (
      SELECT
        submission_id,
        uuid,
        create_user,
        public.gen_random_uuid() AS team_id
      FROM submission
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
        'Submission Team ' || team_id,
        'Auto-generated upload-creation team for submission ' || uuid || '.',
        create_user
      FROM submission_team_backfill
      RETURNING team_id
    )
    UPDATE submission
    SET team_id = backfill.team_id
    FROM submission_team_backfill backfill
    JOIN inserted_team
      ON inserted_team.team_id = backfill.team_id
    WHERE backfill.submission_id = submission.submission_id;

    ----------------------------------------------------------------------------------------
    -- 3. Enforce submission team ownership after the backfill.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission
      ALTER COLUMN team_id SET NOT NULL,
      ADD CONSTRAINT submission_team_fk
        FOREIGN KEY (team_id) REFERENCES team(team_id);

    CREATE INDEX submission_team_idx
      ON submission(team_id);

    COMMENT ON COLUMN submission.team_id IS
      'Foreign key to the team whose members may create uploads for this submission.';

    ----------------------------------------------------------------------------------------
    -- 4. Remove the superseded submission-to-team join table.
    ----------------------------------------------------------------------------------------
    DROP TABLE submission_team;
  `);
}

/**
 * Restore the submission_team join table and remove submission.team_id.
 *
 * @export
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Restore the submission-to-team join table.
    ----------------------------------------------------------------------------------------
    CREATE TABLE submission_team (
      submission_team_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
      submission_id integer NOT NULL,
      team_id uuid NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      CONSTRAINT submission_team_pk PRIMARY KEY (submission_team_id),
      CONSTRAINT submission_team_fk1 FOREIGN KEY (submission_id) REFERENCES submission(submission_id) ON DELETE CASCADE,
      CONSTRAINT submission_team_fk2 FOREIGN KEY (team_id) REFERENCES team(team_id)
    );

    CREATE UNIQUE INDEX submission_team_nuk1
      ON submission_team (submission_id, team_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX submission_team_idx1 ON submission_team(submission_id);
    CREATE INDEX submission_team_idx2 ON submission_team(team_id);

    COMMENT ON TABLE submission_team IS 'Join table linking submissions to teams for team-based access control.';
    COMMENT ON COLUMN submission_team.submission_team_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_team.submission_id IS 'Foreign key to the submission table.';
    COMMENT ON COLUMN submission_team.team_id IS 'Foreign key to the team table.';
    COMMENT ON COLUMN submission_team.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN submission_team.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_team.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN submission_team.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN submission_team.update_user IS 'The id of the user who last updated the record.';

    CREATE TRIGGER audit_submission_team
      BEFORE INSERT OR UPDATE OR DELETE ON submission_team
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_submission_team
      AFTER INSERT OR UPDATE OR DELETE ON submission_team
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- 2. Restore one legacy access mapping for each submission.
    ----------------------------------------------------------------------------------------
    INSERT INTO submission_team (
      submission_id,
      team_id,
      create_user
    )
    SELECT
      submission.submission_id,
      submission.team_id,
      submission.create_user
    FROM submission;

    ----------------------------------------------------------------------------------------
    -- 3. Remove submission team ownership.
    ----------------------------------------------------------------------------------------
    DROP INDEX IF EXISTS submission_team_idx;

    ALTER TABLE submission
      DROP CONSTRAINT IF EXISTS submission_team_fk,
      DROP COLUMN IF EXISTS team_id;
  `);
}
