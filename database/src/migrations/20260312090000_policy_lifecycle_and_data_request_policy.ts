import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    CREATE TYPE policy_status AS ENUM (
      'draft',
      'approved',
      'active',
      'denied',
      'revoked',
      'expired'
    );

    ALTER TYPE policy_status RENAME VALUE 'approved' TO 'reviewed';

    ALTER TABLE policy
      ADD COLUMN status policy_status NOT NULL DEFAULT 'active';

    COMMENT ON COLUMN policy.status IS 'Lifecycle status of a policy: draft, reviewed, active, denied, revoked, or expired.';

    ALTER TABLE data_request
      ADD COLUMN policy_id uuid;

    ALTER TABLE data_request
      ADD CONSTRAINT data_request_policy_fk
      FOREIGN KEY (policy_id)
      REFERENCES policy(policy_id);

    ALTER TABLE data_request
      ADD CONSTRAINT data_request_policy_unique UNIQUE (policy_id);

    CREATE INDEX idx_data_request_policy_id ON data_request(policy_id);

    ALTER TABLE data_request
      ALTER COLUMN policy_id SET NOT NULL;

    COMMENT ON COLUMN data_request.policy_id IS 'Foreign key to the policy associated with this data request.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE data_request
      ALTER COLUMN policy_id DROP NOT NULL;

    DROP INDEX IF EXISTS idx_data_request_policy_id;

    ALTER TABLE data_request
      DROP CONSTRAINT IF EXISTS data_request_policy_unique;

    ALTER TABLE data_request
      DROP CONSTRAINT IF EXISTS data_request_policy_fk;

    ALTER TABLE data_request
      DROP COLUMN IF EXISTS policy_id;

    ALTER TABLE policy
      DROP COLUMN IF EXISTS status;

    DROP TYPE IF EXISTS policy_status;
  `);
}
