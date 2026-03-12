import type { Knex } from 'knex';

/**
 * Consolidated migration for:
 * 1) policy lifecycle enum simplification (including requested)
 * 2) policy.status default reset to requested
 * 3) removal of data_request canonical/status-history legacy objects
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    --------------------------------------------------------------------------------
    -- 1) Remove legacy canonical status column from data_request
    --------------------------------------------------------------------------------
    ALTER TABLE biohub.data_request DROP COLUMN IF EXISTS status;

    --------------------------------------------------------------------------------
    -- 2) Recreate policy_status enum with simplified lifecycle
    --------------------------------------------------------------------------------
    ALTER TYPE biohub.policy_status RENAME TO policy_status_old;

    CREATE TYPE biohub.policy_status AS ENUM (
      'requested',
      'reviewed',
      'approved',
      'denied'
    );

    ALTER TABLE biohub.policy
      ALTER COLUMN status DROP DEFAULT,
      ALTER COLUMN status TYPE biohub.policy_status
      USING (
        CASE
          WHEN status::text = 'active' THEN 'approved'
          WHEN status::text = 'revoked' THEN 'denied'
          WHEN status::text = 'expired' THEN 'denied'
          WHEN status::text = 'draft' THEN 'requested'
          ELSE status::text
        END::biohub.policy_status
      ),
      ALTER COLUMN status SET DEFAULT 'requested';

    DROP TYPE biohub.policy_status_old;

    --------------------------------------------------------------------------------
    -- 3) Remove request-status history table + triggers/types
    --------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS journal_data_request_status ON biohub.data_request_status;
    DROP TRIGGER IF EXISTS audit_data_request_status ON biohub.data_request_status;

    DROP TABLE IF EXISTS biohub.data_request_status;

    DROP TYPE IF EXISTS biohub.request_status;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    --------------------------------------------------------------------------------
    -- 1) Recreate request_status enum + data_request_status history table
    --------------------------------------------------------------------------------
    CREATE TYPE biohub.request_status AS ENUM (
      'REQUESTED',
      'APPROVED',
      'DENIED'
    );

    CREATE TABLE biohub.data_request_status (
      data_request_status_id uuid DEFAULT gen_random_uuid() NOT NULL,
      data_request_id uuid NOT NULL,
      comment_id uuid,
      request_status biohub.request_status NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT data_request_status_pk PRIMARY KEY (data_request_status_id),
      CONSTRAINT data_request_status_data_request_fk
        FOREIGN KEY (data_request_id)
        REFERENCES biohub.data_request(data_request_id),
      CONSTRAINT data_request_status_comment_fk
        FOREIGN KEY (comment_id)
        REFERENCES biohub.comment(comment_id)
    );

    CREATE INDEX data_request_status_data_request_idx ON biohub.data_request_status(data_request_id);
    CREATE INDEX data_request_status_comment_idx ON biohub.data_request_status(comment_id);

    CREATE TRIGGER audit_data_request_status
      BEFORE INSERT OR UPDATE OR DELETE ON biohub.data_request_status
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_data_request_status
      AFTER INSERT OR UPDATE OR DELETE ON biohub.data_request_status
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- 2) Backfill request history rows from current policy status
    --------------------------------------------------------------------------------
    INSERT INTO biohub.data_request_status (data_request_id, request_status, create_user)
    SELECT
      dr.data_request_id,
      CASE
        WHEN p.status = 'approved'::biohub.policy_status THEN 'APPROVED'::biohub.request_status
        WHEN p.status = 'denied'::biohub.policy_status THEN 'DENIED'::biohub.request_status
        ELSE 'REQUESTED'::biohub.request_status
      END,
      COALESCE(dr.update_user, dr.create_user, 1)
    FROM biohub.data_request dr
    JOIN biohub.policy p ON p.policy_id = dr.policy_id
    WHERE dr.record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- 3) Restore legacy policy_status enum shape and defaults
    --------------------------------------------------------------------------------
    ALTER TYPE biohub.policy_status RENAME TO policy_status_new;

    CREATE TYPE biohub.policy_status AS ENUM (
      'draft',
      'reviewed',
      'active',
      'denied',
      'revoked',
      'expired'
    );

    ALTER TABLE biohub.policy
      ALTER COLUMN status DROP DEFAULT,
      ALTER COLUMN status TYPE biohub.policy_status
      USING (
        CASE
          WHEN status::text = 'approved' THEN 'active'
          WHEN status::text = 'requested' THEN 'draft'
          ELSE status::text
        END::biohub.policy_status
      ),
      ALTER COLUMN status SET DEFAULT 'active';

    DROP TYPE biohub.policy_status_new;
  `);
}
