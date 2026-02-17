import { Knex } from 'knex';

/**
 * Add submission_feature_feature junction table for many-to-many relationships
 * between submission features (from content array in flat ingestion).
 * Uses source_feature_id/target_feature_id to support non-hierarchical relationships.
 * Unique index on (LEAST, GREATEST) prevents inverse pairs (A→B and B→A).
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- SUBMISSION_FEATURE_FEATURE (many-to-many feature relationships)
    --------------------------------------------------------------------------------

    CREATE TABLE submission_feature_feature (
      source_feature_id integer NOT NULL,
      target_feature_id integer NOT NULL,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT submission_feature_feature_pk
        PRIMARY KEY (source_feature_id, target_feature_id),
      CONSTRAINT submission_feature_feature_source_fk
        FOREIGN KEY (source_feature_id)
        REFERENCES submission_feature(submission_feature_id)
        ON DELETE CASCADE,
      CONSTRAINT submission_feature_feature_target_fk
        FOREIGN KEY (target_feature_id)
        REFERENCES submission_feature(submission_feature_id)
        ON DELETE CASCADE,
      CONSTRAINT submission_feature_feature_no_self_loop
        CHECK (source_feature_id != target_feature_id)
    );

    CREATE INDEX submission_feature_feature_source_idx
      ON submission_feature_feature(source_feature_id);

    CREATE INDEX submission_feature_feature_target_idx
      ON submission_feature_feature(target_feature_id);

    CREATE UNIQUE INDEX submission_feature_feature_no_inverse_idx
      ON submission_feature_feature (
        LEAST(source_feature_id, target_feature_id),
        GREATEST(source_feature_id, target_feature_id)
      );

    COMMENT ON TABLE submission_feature_feature IS 'Many-to-many relationships between submission features (from content array in flat ingestion).';
    COMMENT ON COLUMN submission_feature_feature.source_feature_id IS 'Foreign key to the source submission feature (e.g. feature that has content array).';
    COMMENT ON COLUMN submission_feature_feature.target_feature_id IS 'Foreign key to the target submission feature (e.g. feature referenced in content).';
    COMMENT ON COLUMN submission_feature_feature.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_feature.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN submission_feature_feature.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN submission_feature_feature.update_user IS 'The id of the user who updated the record.';
    COMMENT ON COLUMN submission_feature_feature.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_submission_feature_feature
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature_feature
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_submission_feature_feature
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_feature
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TRIGGER IF EXISTS journal_submission_feature_feature ON submission_feature_feature;
    DROP TRIGGER IF EXISTS audit_submission_feature_feature ON submission_feature_feature;

    DROP TABLE IF EXISTS submission_feature_feature;
  `);
}
