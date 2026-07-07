import type { Knex } from 'knex';

/**
 * Adds `submission_feature_log`: an append-only record of terminal submission_feature
 * lifecycle transitions.
 *
 * - `superseded`: written during upload reconciliation when a changed version replaces a
 *   published feature. Links the soft-ended predecessor to its replacement and snapshots
 *   both content hashes.
 * - `removed`: reserved for a future removal workflow; enforced by CHECK but not yet written.
 *
 * Not logged: new insertions (already carried by submission_feature.submission_upload_id),
 * unchanged re-uploads (counted by submission_upload_feature_reconciliation), and pending-row
 * soft-ends (never published). The pre-reconciliation dedupe soft-ends from 20260706120000 are
 * not backfilled — they lack an attributable upload and content hashes, so linking them would
 * corrupt chain resolution.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE TYPE submission_feature_log_action AS ENUM (
      'superseded',
      'removed'
    );

    CREATE TABLE submission_feature_log (
      submission_feature_log_id integer GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_id integer NOT NULL,
      submission_upload_id uuid,
      feature_type_id integer NOT NULL,
      source_id varchar(200),
      action submission_feature_log_action NOT NULL,
      previous_submission_feature_id integer NOT NULL,
      new_submission_feature_id integer,
      previous_content_hash varchar(64),
      new_content_hash varchar(64),
      details jsonb,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT submission_feature_log_pk PRIMARY KEY (submission_feature_log_id),
      CONSTRAINT submission_feature_log_fk1
        FOREIGN KEY (submission_id)
        REFERENCES submission(submission_id),
      CONSTRAINT submission_feature_log_fk2
        FOREIGN KEY (submission_upload_id)
        REFERENCES submission_upload(submission_upload_id),
      CONSTRAINT submission_feature_log_fk3
        FOREIGN KEY (feature_type_id)
        REFERENCES feature_type(feature_type_id),
      CONSTRAINT submission_feature_log_fk4
        FOREIGN KEY (previous_submission_feature_id)
        REFERENCES submission_feature(submission_feature_id),
      CONSTRAINT submission_feature_log_fk5
        FOREIGN KEY (new_submission_feature_id)
        REFERENCES submission_feature(submission_feature_id),
      CONSTRAINT submission_feature_log_ck1 CHECK (
        (
          action = 'superseded'
          AND new_submission_feature_id IS NOT NULL
          AND submission_upload_id IS NOT NULL
          AND source_id IS NOT NULL
        )
        OR (
          action = 'removed'
          AND new_submission_feature_id IS NULL
          AND new_content_hash IS NULL
        )
      ),
      CONSTRAINT submission_feature_log_ck2 CHECK (
        previous_submission_feature_id <> new_submission_feature_id
      )
    );

    CREATE UNIQUE INDEX submission_feature_log_uk1
      ON submission_feature_log (previous_submission_feature_id);

    COMMENT ON INDEX submission_feature_log_uk1 IS
      'At most one terminal transition per predecessor: version chains stay linear, and a conflicting replacement chain aborts the approval.';

    CREATE INDEX submission_feature_log_idx1
      ON submission_feature_log (new_submission_feature_id);
    CREATE INDEX submission_feature_log_idx2
      ON submission_feature_log (submission_id);
    CREATE INDEX submission_feature_log_idx3
      ON submission_feature_log (submission_upload_id);

    COMMENT ON TABLE submission_feature_log IS
      'Append-only log of terminal submission_feature transitions: superseded (a changed version replaced a published feature during reconciliation) and removed (reserved for a future workflow). New and unchanged features are not logged. Rows are never updated or deleted; corrections are new transitions from the active feature. Walk history via previous_submission_feature_id -> new_submission_feature_id; a removed row (new_submission_feature_id NULL) is terminal. The chain tip is NOT guaranteed live (denying an approved upload rewinds its rows without touching this log), so authoritative current state is always the active submission_feature row for the (submission_id, feature_type_id, source_id) key.';
    COMMENT ON COLUMN submission_feature_log.submission_feature_log_id IS
      'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_feature_log.submission_id IS
      'Foreign key to submission. Denormalized for submission-scoped history queries.';
    COMMENT ON COLUMN submission_feature_log.submission_upload_id IS
      'Foreign key to the submission_upload whose activation caused the transition. NULL allowed for removals not tied to an upload.';
    COMMENT ON COLUMN submission_feature_log.feature_type_id IS
      'Foreign key to the feature_type table.';
    COMMENT ON COLUMN submission_feature_log.source_id IS
      'Source-system identifier at transition time. Always set for superseded; nullable for removals of legacy rows without one.';
    COMMENT ON COLUMN submission_feature_log.action IS
      'Terminal transition kind: superseded (replaced by a changed version) or removed (no replacement; reserved for a future workflow).';
    COMMENT ON COLUMN submission_feature_log.previous_submission_feature_id IS
      'The soft-ended predecessor row that reached its terminal state.';
    COMMENT ON COLUMN submission_feature_log.new_submission_feature_id IS
      'The replacement row published in place of the predecessor. NOT NULL for superseded, NULL for removed.';
    COMMENT ON COLUMN submission_feature_log.previous_content_hash IS
      'content_hash of the predecessor at transition time. NULL for rows ingested before reconciliation support.';
    COMMENT ON COLUMN submission_feature_log.new_content_hash IS
      'content_hash of the replacement at transition time. NULL for removed, or replacements ingested before reconciliation support.';
    COMMENT ON COLUMN submission_feature_log.details IS
      'Optional structured context for the transition.';
    COMMENT ON COLUMN submission_feature_log.create_date IS
      'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_log.create_user IS
      'The id of the user who created the record.';
    COMMENT ON COLUMN submission_feature_log.update_date IS
      'The datetime the record was updated.';
    COMMENT ON COLUMN submission_feature_log.update_user IS
      'The id of the user who updated the record.';
    COMMENT ON COLUMN submission_feature_log.revision_count IS
      'Revision count used for concurrency control.';

    CREATE TRIGGER audit_submission_feature_log
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature_log
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_submission_feature_log
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_log
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();
  `);
}

/**
 * Drops the submission_feature_log table and its action enum.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS journal_submission_feature_log ON submission_feature_log;
    DROP TRIGGER IF EXISTS audit_submission_feature_log ON submission_feature_log;
    DROP TABLE IF EXISTS submission_feature_log;
    DROP TYPE IF EXISTS submission_feature_log_action;
  `);
}
