import { Knex } from 'knex';

/**
 * Add the `paragraph` feature property type for long free-form text, such as abstracts.
 *
 * Paragraph values are stored, validated, searched and evaluated like `string` values, with their own
 * `submission_feature_property_paragraph` storage table and `predicate_paragraph` predicate payload table.
 * Unlike `string`, the value is unbounded `text` and is not part of any btree index: btree entries are
 * limited to roughly 2.7 KB, so indexing long values would fail inserts. Value predicates on paragraphs
 * therefore filter the property's rows found through the assignment and feature indexes.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Register the property type.
    ----------------------------------------------------------------------------------------
    INSERT INTO feature_property_type (name, description)
    VALUES ('paragraph', 'A long-form text type');

    ----------------------------------------------------------------------------------------
    -- 2. Create the paragraph property storage table.
    ----------------------------------------------------------------------------------------
    CREATE TABLE submission_feature_property_paragraph (
      submission_feature_property_paragraph_id   integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id                      integer           NOT NULL,
      blueprint_feature_type_property_id         integer           NOT NULL,
      value                                      text              NOT NULL,
      create_date                                timestamptz(6)    DEFAULT now() NOT NULL,
      create_user                                integer           NOT NULL,
      update_date                                timestamptz(6),
      update_user                                integer,
      revision_count                             integer           DEFAULT 0 NOT NULL,
      CONSTRAINT submission_feature_property_paragraph_pk PRIMARY KEY (submission_feature_property_paragraph_id)
    );

    COMMENT ON TABLE submission_feature_property_paragraph IS 'Canonical typed paragraph (long-form text) property values.';
    COMMENT ON COLUMN submission_feature_property_paragraph.submission_feature_property_paragraph_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_feature_property_paragraph.submission_feature_id IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN submission_feature_property_paragraph.blueprint_feature_type_property_id IS 'Foreign key to blueprint_feature_type_property: the Blueprint assignment this value was stored under. Identifies the property, its feature type and its Blueprint; retained when the assignment is later retired.';
    COMMENT ON COLUMN submission_feature_property_paragraph.value IS 'The paragraph property value.';
    COMMENT ON COLUMN submission_feature_property_paragraph.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_property_paragraph.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_property_paragraph.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN submission_feature_property_paragraph.update_user IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_property_paragraph.revision_count IS 'Revision count used for concurrency control.';

    ALTER TABLE submission_feature_property_paragraph ADD CONSTRAINT submission_feature_property_paragraph_fk1
      FOREIGN KEY (submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    ALTER TABLE submission_feature_property_paragraph ADD CONSTRAINT submission_feature_property_paragraph_bftp_fk
      FOREIGN KEY (blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id);

    -- Feature lookup: a feature, then its assignments. The value is not included (see migration JSDoc).
    CREATE INDEX submission_feature_property_paragraph_presence_idx
      ON submission_feature_property_paragraph (submission_feature_id, blueprint_feature_type_property_id);

    -- Property predicate and count lookup: one assignment, then the owning feature.
    CREATE INDEX submission_feature_property_paragraph_count_idx
      ON submission_feature_property_paragraph (blueprint_feature_type_property_id, submission_feature_id);

    -- Paragraph rows are high volume like the other typed property tables, so they carry an audit trigger
    -- but no journal trigger.
    CREATE TRIGGER audit_submission_feature_property_paragraph
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature_property_paragraph
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();

    ----------------------------------------------------------------------------------------
    -- 3. Require paragraph values to use paragraph-typed Blueprint assignments.
    ----------------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION tr_validate_submission_feature_property_assignment()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      expected_type text;
      assignment record;
    BEGIN
      -- The property type each storage table holds. Three names differ from their table suffix:
      -- timestamp/datetime, geometry/spatial, artifact/artifact_key.
      expected_type := CASE TG_TABLE_NAME
        WHEN 'submission_feature_property_string' THEN 'string'
        WHEN 'submission_feature_property_paragraph' THEN 'paragraph'
        WHEN 'submission_feature_property_number' THEN 'number'
        WHEN 'submission_feature_property_boolean' THEN 'boolean'
        WHEN 'submission_feature_property_timestamp' THEN 'datetime'
        WHEN 'submission_feature_property_code' THEN 'code'
        WHEN 'submission_feature_property_taxon' THEN 'taxon'
        WHEN 'submission_feature_property_geometry' THEN 'spatial'
        WHEN 'submission_feature_property_feature' THEN 'feature'
        WHEN 'submission_feature_property_artifact' THEN 'artifact_key'
      END;

      SELECT
        bft.feature_type_id AS assigned_feature_type_id,
        bft.blueprint_id AS assigned_blueprint_id,
        sf.feature_type_id AS owning_feature_type_id,
        su.blueprint_id AS owning_blueprint_id,
        fpt.name AS declared_type
      INTO assignment
      FROM submission_feature sf
      JOIN submission_upload su
        ON su.submission_upload_id = sf.submission_upload_id
      JOIN blueprint_feature_type_property bftp
        ON bftp.blueprint_feature_type_property_id = NEW.blueprint_feature_type_property_id
      JOIN blueprint_feature_type bft
        ON bft.blueprint_feature_type_id = bftp.blueprint_feature_type_id
      JOIN feature_property fp
        ON fp.feature_property_id = bftp.feature_property_id
      JOIN feature_property_type fpt
        ON fpt.feature_property_type_id = fp.feature_property_type_id
      WHERE sf.submission_feature_id = NEW.submission_feature_id;

      IF NOT FOUND OR assignment.assigned_feature_type_id <> assignment.owning_feature_type_id THEN
        RAISE EXCEPTION
          'blueprint_feature_type_property_id % does not belong to the feature type for submission_feature_id %',
          NEW.blueprint_feature_type_property_id,
          NEW.submission_feature_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF assignment.assigned_blueprint_id <> assignment.owning_blueprint_id THEN
        RAISE EXCEPTION
          'blueprint_feature_type_property_id % belongs to blueprint %, but submission_feature_id % was uploaded under blueprint %',
          NEW.blueprint_feature_type_property_id,
          assignment.assigned_blueprint_id,
          NEW.submission_feature_id,
          assignment.owning_blueprint_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF assignment.declared_type <> expected_type THEN
        RAISE EXCEPTION
          '% stores % properties, but blueprint_feature_type_property_id % is declared as %',
          TG_TABLE_NAME,
          expected_type,
          NEW.blueprint_feature_type_property_id,
          assignment.declared_type
          USING ERRCODE = 'datatype_mismatch';
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER validate_submission_feature_property_assignment
      BEFORE INSERT OR UPDATE OF submission_feature_id, blueprint_feature_type_property_id
      ON submission_feature_property_paragraph
      FOR EACH ROW EXECUTE FUNCTION tr_validate_submission_feature_property_assignment();

    ----------------------------------------------------------------------------------------
    -- 4. Create the paragraph predicate payload table. Comparison values are short search
    --    terms, so they keep the string predicate's bounded, indexed value column.
    ----------------------------------------------------------------------------------------
    CREATE TABLE predicate_paragraph (
      predicate_paragraph_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
      predicate_id uuid NOT NULL,
      value varchar(250),
      operator string_operator_type NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT predicate_paragraph_pk PRIMARY KEY (predicate_paragraph_id),
      CONSTRAINT predicate_paragraph_fk1
        FOREIGN KEY (predicate_id)
        REFERENCES predicate(predicate_id)
        ON DELETE CASCADE,
      CONSTRAINT predicate_paragraph_ck1 CHECK (
        (operator = 'Exists' AND value IS NULL) OR
        (operator <> 'Exists' AND value IS NOT NULL)
      )
    );

    CREATE UNIQUE INDEX predicate_paragraph_nuk1
      ON predicate_paragraph(predicate_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX predicate_paragraph_idx1 ON predicate_paragraph(predicate_id);
    CREATE INDEX predicate_paragraph_idx2 ON predicate_paragraph(operator);
    CREATE INDEX predicate_paragraph_idx3 ON predicate_paragraph(value);
    CREATE INDEX predicate_paragraph_idx4
      ON predicate_paragraph(operator, value)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE predicate_paragraph IS 'Typed predicate payload table for paragraph comparisons.';
    COMMENT ON COLUMN predicate_paragraph.predicate_paragraph_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN predicate_paragraph.predicate_id IS 'Foreign key to predicate table.';
    COMMENT ON COLUMN predicate_paragraph.value IS 'Paragraph comparison value; null only when operator is Exists.';
    COMMENT ON COLUMN predicate_paragraph.operator IS 'Comparison operator for the paragraph predicate.';
    COMMENT ON COLUMN predicate_paragraph.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN predicate_paragraph.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN predicate_paragraph.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN predicate_paragraph.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN predicate_paragraph.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN predicate_paragraph.revision_count IS 'Revision count used for concurrency control.';

    CREATE TRIGGER audit_predicate_paragraph
      BEFORE INSERT OR UPDATE OR DELETE ON predicate_paragraph
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_predicate_paragraph
      AFTER INSERT OR UPDATE OR DELETE ON predicate_paragraph
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();
  `);
}

/**
 * Remove the `paragraph` feature property type, its storage and predicate tables, and its storage-type mapping.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS journal_predicate_paragraph ON predicate_paragraph;
    DROP TRIGGER IF EXISTS audit_predicate_paragraph ON predicate_paragraph;
    DROP TABLE IF EXISTS predicate_paragraph;

    DROP TRIGGER IF EXISTS validate_submission_feature_property_assignment ON submission_feature_property_paragraph;
    DROP TRIGGER IF EXISTS audit_submission_feature_property_paragraph ON submission_feature_property_paragraph;
    DROP TABLE IF EXISTS submission_feature_property_paragraph;

    CREATE OR REPLACE FUNCTION tr_validate_submission_feature_property_assignment()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      expected_type text;
      assignment record;
    BEGIN
      -- The property type each storage table holds. Three names differ from their table suffix:
      -- timestamp/datetime, geometry/spatial, artifact/artifact_key.
      expected_type := CASE TG_TABLE_NAME
        WHEN 'submission_feature_property_string' THEN 'string'
        WHEN 'submission_feature_property_number' THEN 'number'
        WHEN 'submission_feature_property_boolean' THEN 'boolean'
        WHEN 'submission_feature_property_timestamp' THEN 'datetime'
        WHEN 'submission_feature_property_code' THEN 'code'
        WHEN 'submission_feature_property_taxon' THEN 'taxon'
        WHEN 'submission_feature_property_geometry' THEN 'spatial'
        WHEN 'submission_feature_property_feature' THEN 'feature'
        WHEN 'submission_feature_property_artifact' THEN 'artifact_key'
      END;

      SELECT
        bft.feature_type_id AS assigned_feature_type_id,
        bft.blueprint_id AS assigned_blueprint_id,
        sf.feature_type_id AS owning_feature_type_id,
        su.blueprint_id AS owning_blueprint_id,
        fpt.name AS declared_type
      INTO assignment
      FROM submission_feature sf
      JOIN submission_upload su
        ON su.submission_upload_id = sf.submission_upload_id
      JOIN blueprint_feature_type_property bftp
        ON bftp.blueprint_feature_type_property_id = NEW.blueprint_feature_type_property_id
      JOIN blueprint_feature_type bft
        ON bft.blueprint_feature_type_id = bftp.blueprint_feature_type_id
      JOIN feature_property fp
        ON fp.feature_property_id = bftp.feature_property_id
      JOIN feature_property_type fpt
        ON fpt.feature_property_type_id = fp.feature_property_type_id
      WHERE sf.submission_feature_id = NEW.submission_feature_id;

      IF NOT FOUND OR assignment.assigned_feature_type_id <> assignment.owning_feature_type_id THEN
        RAISE EXCEPTION
          'blueprint_feature_type_property_id % does not belong to the feature type for submission_feature_id %',
          NEW.blueprint_feature_type_property_id,
          NEW.submission_feature_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF assignment.assigned_blueprint_id <> assignment.owning_blueprint_id THEN
        RAISE EXCEPTION
          'blueprint_feature_type_property_id % belongs to blueprint %, but submission_feature_id % was uploaded under blueprint %',
          NEW.blueprint_feature_type_property_id,
          assignment.assigned_blueprint_id,
          NEW.submission_feature_id,
          assignment.owning_blueprint_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF assignment.declared_type <> expected_type THEN
        RAISE EXCEPTION
          '% stores % properties, but blueprint_feature_type_property_id % is declared as %',
          TG_TABLE_NAME,
          expected_type,
          NEW.blueprint_feature_type_property_id,
          assignment.declared_type
          USING ERRCODE = 'datatype_mismatch';
      END IF;

      RETURN NEW;
    END;
    $$;

    DELETE FROM feature_property_type WHERE name = 'paragraph';
  `);
}
