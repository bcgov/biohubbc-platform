import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- SUBMISSION_TEAM
    --------------------------------------------------------------------------------

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

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_submission_team
      BEFORE INSERT OR UPDATE OR DELETE ON submission_team
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_submission_team
      AFTER INSERT OR UPDATE OR DELETE ON submission_team
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    -- Drop submission_team triggers
    DROP TRIGGER IF EXISTS journal_submission_team ON submission_team;
    DROP TRIGGER IF EXISTS audit_submission_team ON submission_team;

    -- Drop submission_team indexes
    DROP INDEX IF EXISTS submission_team_nuk1;
    DROP INDEX IF EXISTS submission_team_idx2;
    DROP INDEX IF EXISTS submission_team_idx1;

    -- Drop submission_team table
    DROP TABLE IF EXISTS submission_team;
  `);
}
