import { Knex } from 'knex';

/**
 * Add submission_feature_artifact join table to explicitly link extracted submission features
 * to their source artifacts.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- SUBMISSION_FEATURE_ARTIFACT
    --------------------------------------------------------------------------------

    CREATE TABLE submission_feature_artifact (
      submission_feature_artifact_id integer GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id integer NOT NULL,
      artifact_id uuid NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT submission_feature_artifact_pk PRIMARY KEY (submission_feature_artifact_id),
      CONSTRAINT submission_feature_artifact_fk1
        FOREIGN KEY (submission_feature_id)
        REFERENCES submission_feature(submission_feature_id),
      CONSTRAINT submission_feature_artifact_fk2
        FOREIGN KEY (artifact_id)
        REFERENCES artifact(artifact_id)
    );

    CREATE INDEX submission_feature_artifact_idx1
      ON submission_feature_artifact(submission_feature_id);

    CREATE INDEX submission_feature_artifact_idx2
      ON submission_feature_artifact(artifact_id);

    CREATE UNIQUE INDEX submission_feature_artifact_nuk1
      ON submission_feature_artifact(submission_feature_id)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE submission_feature_artifact IS 'Explicit link between a submission feature and its source artifact.';
    COMMENT ON COLUMN submission_feature_artifact.submission_feature_artifact_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_feature_artifact.submission_feature_id IS 'Foreign key to the submission feature.';
    COMMENT ON COLUMN submission_feature_artifact.artifact_id IS 'Foreign key to the artifact.';
    COMMENT ON COLUMN submission_feature_artifact.record_end_date IS 'The end date of the record for soft deletes.';
    COMMENT ON COLUMN submission_feature_artifact.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_artifact.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN submission_feature_artifact.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN submission_feature_artifact.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN submission_feature_artifact.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_submission_feature_artifact
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_submission_feature_artifact
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TRIGGER IF EXISTS journal_submission_feature_artifact ON submission_feature_artifact;
    DROP TRIGGER IF EXISTS audit_submission_feature_artifact ON submission_feature_artifact;

    DROP INDEX IF EXISTS submission_feature_artifact_nuk1;
    DROP INDEX IF EXISTS submission_feature_artifact_idx2;
    DROP INDEX IF EXISTS submission_feature_artifact_idx1;

    DROP TABLE IF EXISTS submission_feature_artifact;
  `);
}
