import type { Knex } from 'knex';

// SIMSBIOHUB-863: team_feature is a cache table, not a source table.
// No surrogate PK, no audit columns, no triggers, no FKs.
// Derived data — always rebuildable from team_policy + policy_statement.
// Audit infrastructure (tr_audit_trigger, tr_journal_trigger, create_user, etc.)
// is omitted because it adds O(N) per-row overhead on bulk refresh with no value:
// the source of truth (team_policy, policy_statement) is already audited upstream.

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Create team_feature cache table
    --------------------------------------------------------------------------------

    CREATE TABLE team_feature (
      team_id               uuid NOT NULL,
      submission_feature_id integer NOT NULL,
      CONSTRAINT team_feature_pk PRIMARY KEY (team_id, submission_feature_id)
    );

    --------------------------------------------------------------------------------
    -- Table and column comments
    --------------------------------------------------------------------------------

    COMMENT ON TABLE team_feature IS 'Materialized cache mapping teams to the secured submission features they can access. Rebuilt via delete+insert from team_policy + policy_statement URN resolution whenever policies change. Cache table — no audit columns or triggers (source of truth is audited upstream).';
    COMMENT ON COLUMN team_feature.team_id IS 'The team UUID. Leading column in composite PK — supports lookups by team_id used in buildUserAccessFilter.';
    COMMENT ON COLUMN team_feature.submission_feature_id IS 'The submission feature ID granted to the team by policy resolution.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TABLE IF EXISTS team_feature;
  `);
}
