import { Knex } from 'knex';

/**
 * Migration to create the team_feature cache table.
 *
 * team_feature is a materialized cache that maps team_id to submission_feature_id
 * by resolving URN wildcards from policy_statement. This allows the search query
 * to use simple JOINs instead of per-row URN matching when filtering secured
 * features by user access.
 *
 * The cache is rebuilt (delete + reinsert) whenever policies or team-policy
 * associations change. It is not a source of truth — it can always be
 * reconstructed from team_policy → policy_statement → submission_feature.
 *
 * See: SIMSBIOHUB-863
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Create team_feature cache table
    --------------------------------------------------------------------------------
    CREATE TABLE team_feature (
      team_feature_id       integer GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      team_id               uuid NOT NULL,
      submission_feature_id integer NOT NULL,
      create_date           timestamptz(6) DEFAULT now() NOT NULL,
      create_user           integer NOT NULL,
      update_date           timestamptz(6),
      update_user           integer,
      revision_count        integer DEFAULT 0 NOT NULL,
      CONSTRAINT team_feature_pk PRIMARY KEY (team_feature_id)
    );

    --------------------------------------------------------------------------------
    -- Create team_feature indexes and constraints
    --------------------------------------------------------------------------------
    CREATE INDEX team_feature_idx1 ON team_feature(team_id);
    CREATE INDEX team_feature_idx2 ON team_feature(submission_feature_id);

    CREATE UNIQUE INDEX team_feature_nuk1
      ON team_feature(team_id, submission_feature_id);

    ALTER TABLE team_feature ADD CONSTRAINT team_feature_fk1
      FOREIGN KEY (team_id) REFERENCES team(team_id);

    ALTER TABLE team_feature ADD CONSTRAINT team_feature_fk2
      FOREIGN KEY (submission_feature_id) REFERENCES submission_feature(submission_feature_id);

    --------------------------------------------------------------------------------
    -- Create team_feature triggers
    --------------------------------------------------------------------------------
    CREATE TRIGGER audit_team_feature
      BEFORE INSERT OR UPDATE OR DELETE ON team_feature
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_team_feature
      AFTER INSERT OR UPDATE OR DELETE ON team_feature
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- Table and column comments
    --------------------------------------------------------------------------------
    COMMENT ON TABLE team_feature IS 'Materialized cache mapping teams to the secured submission features they can access. Rebuilt from team_policy + policy_statement URN resolution whenever policies change.';
    COMMENT ON COLUMN team_feature.team_feature_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN team_feature.team_id IS 'Foreign key to the team table.';
    COMMENT ON COLUMN team_feature.submission_feature_id IS 'Foreign key to the submission_feature table.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS journal_team_feature ON team_feature;
    DROP TRIGGER IF EXISTS audit_team_feature ON team_feature;

    DROP TABLE IF EXISTS team_feature;
  `);
}
