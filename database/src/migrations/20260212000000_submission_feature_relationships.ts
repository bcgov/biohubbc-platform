import { Knex } from 'knex';

/**
 * Add submission_feature__feature junction table for many-to-many relationships
 * between submission features (from content array in flat ingestion).
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- SUBMISSION_FEATURE__FEATURE (many-to-many feature relationships)
    --------------------------------------------------------------------------------

    CREATE TABLE submission_feature__feature (
      parent_feature_id integer NOT NULL,
      child_feature_id integer NOT NULL,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT submission_feature__feature_pk
        PRIMARY KEY (parent_feature_id, child_feature_id),
      CONSTRAINT submission_feature__feature_parent_fk
        FOREIGN KEY (parent_feature_id)
        REFERENCES submission_feature(submission_feature_id)
        ON DELETE CASCADE,
      CONSTRAINT submission_feature__feature_child_fk
        FOREIGN KEY (child_feature_id)
        REFERENCES submission_feature(submission_feature_id)
        ON DELETE CASCADE,
      CONSTRAINT submission_feature__feature_no_self_loop
        CHECK (parent_feature_id != child_feature_id)
    );

    CREATE INDEX submission_feature__feature_parent_idx
      ON submission_feature__feature(parent_feature_id);

    CREATE INDEX submission_feature__feature_child_idx
      ON submission_feature__feature(child_feature_id);

    COMMENT ON TABLE submission_feature__feature IS 'Many-to-many relationships between submission features (from content array in flat ingestion).';
    COMMENT ON COLUMN submission_feature__feature.parent_feature_id IS 'Foreign key to the parent submission feature.';
    COMMENT ON COLUMN submission_feature__feature.child_feature_id IS 'Foreign key to the child submission feature.';
    COMMENT ON COLUMN submission_feature__feature.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature__feature.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN submission_feature__feature.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN submission_feature__feature.update_user IS 'The id of the user who updated the record.';
    COMMENT ON COLUMN submission_feature__feature.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_submission_feature__feature
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature__feature
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_submission_feature__feature
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature__feature
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TRIGGER IF EXISTS journal_submission_feature__feature ON submission_feature__feature;
    DROP TRIGGER IF EXISTS audit_submission_feature__feature ON submission_feature__feature;

    DROP TABLE IF EXISTS submission_feature__feature;
  `);
}
