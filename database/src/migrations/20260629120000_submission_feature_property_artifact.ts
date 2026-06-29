import type { Knex } from 'knex';

/**
 * Adds the canonical typed-property table for artifact_key property values.
 *
 * This table stores resolved artifact references as artifact_id FKs while preserving the
 * feature property and Blueprint assignment that produced the value.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE TABLE submission_feature_property_artifact (
      submission_feature_property_artifact_id integer GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id integer NOT NULL,
      feature_type_property_id integer NOT NULL,
      blueprint_feature_type_property_id integer NOT NULL,
      artifact_id uuid NOT NULL,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT submission_feature_property_artifact_pk PRIMARY KEY (submission_feature_property_artifact_id),
      CONSTRAINT submission_feature_property_artifact_fk1
        FOREIGN KEY (submission_feature_id)
        REFERENCES submission_feature(submission_feature_id),
      CONSTRAINT submission_feature_property_artifact_fk2
        FOREIGN KEY (feature_type_property_id)
        REFERENCES feature_type_property(feature_type_property_id),
      CONSTRAINT submission_feature_property_artifact_fk3
        FOREIGN KEY (feature_type_property_id, blueprint_feature_type_property_id)
        REFERENCES blueprint_feature_type_property(feature_type_property_id, blueprint_feature_type_property_id),
      CONSTRAINT submission_feature_property_artifact_fk4
        FOREIGN KEY (artifact_id)
        REFERENCES artifact(artifact_id),
      CONSTRAINT submission_feature_property_artifact_uk1
        UNIQUE (submission_feature_id, feature_type_property_id, artifact_id)
    );

    CREATE INDEX submission_feature_property_artifact_idx1
      ON submission_feature_property_artifact (submission_feature_id, feature_type_property_id);
    CREATE INDEX submission_feature_property_artifact_idx2
      ON submission_feature_property_artifact (feature_type_property_id, artifact_id, submission_feature_id);
    CREATE INDEX submission_feature_property_artifact_idx3
      ON submission_feature_property_artifact (artifact_id);
    CREATE INDEX submission_feature_property_artifact_bftp_idx
      ON submission_feature_property_artifact (blueprint_feature_type_property_id);

    COMMENT ON TABLE submission_feature_property_artifact IS
      'Canonical typed artifact property values. Each row records that one submission_feature has a typed property whose value resolves to an artifact.';
    COMMENT ON COLUMN submission_feature_property_artifact.submission_feature_property_artifact_id IS
      'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_feature_property_artifact.submission_feature_id IS
      'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN submission_feature_property_artifact.feature_type_property_id IS
      'Foreign key to the feature_type_property table.';
    COMMENT ON COLUMN submission_feature_property_artifact.blueprint_feature_type_property_id IS
      'Foreign key to blueprint_feature_type_property: the Blueprint assignment used to validate/index this property.';
    COMMENT ON COLUMN submission_feature_property_artifact.artifact_id IS
      'Foreign key to the artifact table.';
    COMMENT ON COLUMN submission_feature_property_artifact.create_date IS
      'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_property_artifact.create_user IS
      'The id of the user who created the record.';
    COMMENT ON COLUMN submission_feature_property_artifact.update_date IS
      'The datetime the record was updated.';
    COMMENT ON COLUMN submission_feature_property_artifact.update_user IS
      'The id of the user who updated the record.';
    COMMENT ON COLUMN submission_feature_property_artifact.revision_count IS
      'Revision count used for concurrency control.';

    CREATE TRIGGER audit_submission_feature_property_artifact
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature_property_artifact
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_submission_feature_property_artifact
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_property_artifact
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();
  `);
}

/**
 * Drops the canonical typed-property artifact table.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS journal_submission_feature_property_artifact ON submission_feature_property_artifact;
    DROP TRIGGER IF EXISTS audit_submission_feature_property_artifact ON submission_feature_property_artifact;
    DROP TABLE IF EXISTS submission_feature_property_artifact;
  `);
}
