import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- POLICY LIFECYCLE
    --------------------------------------------------------------------------------
    CREATE TYPE policy_status AS ENUM (
      'requested',
      'reviewed',
      'approved',
      'denied'
    );

    ALTER TABLE policy
      ADD COLUMN status policy_status NOT NULL DEFAULT 'requested';

    COMMENT ON COLUMN policy.status IS 'Lifecycle status of a policy: requested, reviewed, approved, or denied.';

    --------------------------------------------------------------------------------
    -- DATA REQUEST POLICY LINK
    --------------------------------------------------------------------------------
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

    --------------------------------------------------------------------------------
    -- REMOVE LEGACY DATA REQUEST STATUS HISTORY
    --------------------------------------------------------------------------------
    ALTER TABLE data_request
      DROP COLUMN IF EXISTS status;

    DROP TABLE IF EXISTS data_request_status;

    DROP TYPE IF EXISTS request_status;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- RESTORE LEGACY DATA REQUEST STATUS HISTORY
    --------------------------------------------------------------------------------
    CREATE TYPE request_status AS ENUM (
      'REQUESTED',
      'APPROVED',
      'DENIED'
    );

    CREATE TABLE data_request_status (
      data_request_status_id uuid DEFAULT gen_random_uuid() NOT NULL,
      data_request_id uuid NOT NULL,
      comment_id uuid,
      request_status request_status NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT data_request_status_pk PRIMARY KEY (data_request_status_id),
      CONSTRAINT data_request_status_data_request_fk
        FOREIGN KEY (data_request_id)
        REFERENCES data_request(data_request_id),
      CONSTRAINT data_request_status_comment_fk
        FOREIGN KEY (comment_id)
        REFERENCES comment(comment_id)
    );

    CREATE INDEX data_request_status_data_request_idx ON data_request_status(data_request_id);
    CREATE INDEX data_request_status_comment_idx ON data_request_status(comment_id);

    CREATE TRIGGER audit_data_request_status
      BEFORE INSERT OR UPDATE OR DELETE ON data_request_status
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_data_request_status
      AFTER INSERT OR UPDATE OR DELETE ON data_request_status
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- REMOVE DATA REQUEST POLICY LINK
    --------------------------------------------------------------------------------
    ALTER TABLE data_request
      ALTER COLUMN policy_id DROP NOT NULL;

    DROP INDEX IF EXISTS idx_data_request_policy_id;

    ALTER TABLE data_request
      DROP CONSTRAINT IF EXISTS data_request_policy_unique;

    ALTER TABLE data_request
      DROP CONSTRAINT IF EXISTS data_request_policy_fk;

    ALTER TABLE data_request
      DROP COLUMN IF EXISTS policy_id;

    --------------------------------------------------------------------------------
    -- REMOVE POLICY LIFECYCLE
    --------------------------------------------------------------------------------
    ALTER TABLE policy
      DROP COLUMN IF EXISTS status;

    DROP TYPE IF EXISTS policy_status;
  `);
}
