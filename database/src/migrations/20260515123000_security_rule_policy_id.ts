import { Knex } from 'knex';

/**
 * Adds an optional policy reference to security rules.
 *
 * Notes:
 * - policy_id is nullable to support security rules that do not map to policies.
 * - No data backfill is performed; policy linkage is handled at runtime.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE security_rule
      ADD COLUMN policy_id uuid;

    ALTER TABLE security_rule
      ADD CONSTRAINT security_rule_policy_fk
        FOREIGN KEY (policy_id) REFERENCES policy(policy_id);

    CREATE INDEX idx_security_rule_policy_id ON security_rule(policy_id);

    COMMENT ON COLUMN security_rule.policy_id IS
      'Foreign key to the policy that defines feature-matching logic for this security rule.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS idx_security_rule_policy_id;

    ALTER TABLE security_rule
      DROP CONSTRAINT IF EXISTS security_rule_policy_fk,
      DROP COLUMN IF EXISTS policy_id;
  `);
}
