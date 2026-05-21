import { Knex } from 'knex';

/**
 * Create the `access_key` table and supporting indexes and triggers.
 *
 * Domain intent:
 * - `access_key` stores hashed API keys for non-interactive access to API-key-gated routes.
 * - The plaintext key is returned exactly once at creation and is never stored.
 * - `key_prefix` is stored in plaintext for display, lookup, and debugging.
 * - `key_hash` (scrypt hex digest, keyed with `key_prefix` as salt) is used for verification only; the original key cannot be recovered.
 * - Each key expires 6 months after creation.
 * - Revocation is captured by setting `revoked_at`; the key is then immediately invalid.
 *
 * Schema intent:
 * - `record_end_date` follows the BioHub soft-delete convention used by other tables.
 * - `key_prefix` has a partial unique index on active rows to prevent collisions.
 *
 * @param {Knex} knex - Knex database client.
 * @return {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Create the access_key table.
    ----------------------------------------------------------------------------------------
    CREATE TABLE access_key (
      access_key_id   uuid DEFAULT gen_random_uuid() NOT NULL,
      system_user_id  integer NOT NULL,
      name            text NOT NULL,
      key_prefix      text NOT NULL,
      key_hash        text NOT NULL,
      expires_at      timestamptz(6) NOT NULL,
      revoked_at      timestamptz(6),
      last_used_at    timestamptz(6),
      record_end_date timestamptz(6),
      create_date     timestamptz(6) DEFAULT now() NOT NULL,
      create_user     integer NOT NULL,
      update_date     timestamptz(6),
      update_user     integer,
      revision_count  integer DEFAULT 0 NOT NULL,
      CONSTRAINT access_key_pk PRIMARY KEY (access_key_id),
      CONSTRAINT access_key_system_user_fk FOREIGN KEY (system_user_id) REFERENCES "system_user"(system_user_id)
    );

    ----------------------------------------------------------------------------------------
    -- 2. Create indexes.
    ----------------------------------------------------------------------------------------
    CREATE INDEX access_key_system_user_idx ON access_key(system_user_id);

    -- Lookup by prefix during authentication; only one active row per prefix.
    CREATE UNIQUE INDEX access_key_prefix_nuk1 ON access_key(key_prefix) WHERE record_end_date IS NULL;

    ----------------------------------------------------------------------------------------
    -- 3. Add table and column comments.
    ----------------------------------------------------------------------------------------
    COMMENT ON TABLE access_key IS 'User-scoped API keys for non-interactive access to API-key-gated routes.';
    COMMENT ON COLUMN access_key.access_key_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN access_key.system_user_id IS 'Foreign key to the system_user who owns this key.';
    COMMENT ON COLUMN access_key.name IS 'Human-readable label for the key (e.g. "My script key").';
    COMMENT ON COLUMN access_key.key_prefix IS 'Short plaintext prefix of the key (e.g. biohub_AbCdEfGh) used for display and lookup.';
    COMMENT ON COLUMN access_key.key_hash IS 'Scrypt hex digest of the full plaintext key (salted with key_prefix); used for verification only.';
    COMMENT ON COLUMN access_key.expires_at IS 'Timestamp after which the key is no longer valid.';
    COMMENT ON COLUMN access_key.revoked_at IS 'Timestamp at which the key was revoked; null when the key is still active.';
    COMMENT ON COLUMN access_key.last_used_at IS 'Timestamp of the most recent successful authentication using this key.';
    COMMENT ON COLUMN access_key.record_end_date IS 'Timestamp for soft delete; null when the record is active.';
    COMMENT ON COLUMN access_key.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN access_key.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN access_key.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN access_key.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN access_key.revision_count IS 'Revision count used for concurrency control.';
    COMMENT ON INDEX access_key_prefix_nuk1 IS 'Ensures one active row per key_prefix; allows re-creation after soft delete.';

    ----------------------------------------------------------------------------------------
    -- 4. Attach standard audit + journal triggers.
    ----------------------------------------------------------------------------------------
    CREATE TRIGGER audit_access_key
      BEFORE INSERT OR UPDATE OR DELETE ON access_key
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_access_key
      AFTER INSERT OR UPDATE OR DELETE ON access_key
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

/**
 * Roll back the `access_key` table and all associated objects.
 *
 * Rollback order:
 * - drop triggers (bound to the table),
 * - then indexes,
 * - then the table itself.
 *
 * @param {Knex} knex - Knex database client.
 * @return {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Drop triggers bound to access_key.
    ----------------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS journal_access_key ON access_key;
    DROP TRIGGER IF EXISTS audit_access_key ON access_key;

    ----------------------------------------------------------------------------------------
    -- 2. Drop indexes.
    ----------------------------------------------------------------------------------------
    DROP INDEX IF EXISTS access_key_prefix_nuk1;
    DROP INDEX IF EXISTS access_key_system_user_idx;

    ----------------------------------------------------------------------------------------
    -- 3. Drop the table.
    ----------------------------------------------------------------------------------------
    DROP TABLE IF EXISTS access_key;
  `);
}
