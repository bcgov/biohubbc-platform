import { Knex } from 'knex';

/**
 * Migration to fix unique constraints on team_policy and team_member tables to properly support soft-delete.
 *
 * Problem:
 * The original migration (20250911100300_access_policies.ts) added both regular UNIQUE constraints
 * and partial unique indexes to team_policy and team_member tables. The regular UNIQUE constraints
 * prevent re-creating soft-deleted records, which breaks the soft-delete pattern.
 *
 * Fix:
 * - Drop `team_policy_unique` constraint (keep the partial index `team_policy_nuk1`)
 * - Drop `team_member_unique` constraint and add a partial unique index `team_member_nuk1`
 *
 * This aligns these junction tables with the pattern used by other tables (policy, team,
 * policy_statement, policy_statement_condition) which only use partial unique indexes.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Fix team_policy table: drop regular unique constraint (keep partial index)
    --------------------------------------------------------------------------------
    ALTER TABLE team_policy DROP CONSTRAINT team_policy_unique;

    --------------------------------------------------------------------------------
    -- Fix team_member table: drop regular unique constraint, add partial index
    --------------------------------------------------------------------------------
    ALTER TABLE team_member DROP CONSTRAINT team_member_unique;

    CREATE UNIQUE INDEX team_member_nuk1 ON team_member(system_user_id, team_id, (record_end_date IS NULL))
      WHERE record_end_date IS NULL;

    COMMENT ON INDEX team_member_nuk1 IS 'Ensures unique active team memberships while allowing soft-delete and re-creation.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Revert team_member: drop partial index, add back regular unique constraint
    --------------------------------------------------------------------------------
    DROP INDEX IF EXISTS team_member_nuk1;

    ALTER TABLE team_member ADD CONSTRAINT team_member_unique UNIQUE (system_user_id, team_id);

    --------------------------------------------------------------------------------
    -- Revert team_policy: add back regular unique constraint
    --------------------------------------------------------------------------------
    ALTER TABLE team_policy ADD CONSTRAINT team_policy_unique UNIQUE (team_id, policy_id);
  `);
}
