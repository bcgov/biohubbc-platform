import type { Knex } from 'knex';

/**
 * Remove the global feature-type/property pairing.
 *
 * `feature_type_property` said which properties a feature type may carry, independently of any
 * Blueprint. Since `20260616120000` a Blueprint says that for itself, and since `20260921120000` its
 * assignment references the property directly. The preceding migrations moved every remaining reader of
 * the pairing onto the assignment: stored values, ingestion errors, predicates and allowed reference
 * targets (`20260923120000`), with stored values then validated and indexed by assignment
 * (`20260923130000`). Nothing in the schema depends on the pairing any more, so this drops it together
 * with every column, key, index and trigger that carried its identifier.
 *
 * The Martin tile functions in `database/src/procedures/` are plpgsql and are re-created from source after
 * every migration run, so the versions that read the pairing are replaced in the same deploy.
 *
 * Order matters: triggers whose `UPDATE OF` lists name the column go first, then the constraints that
 * reference `blueprint_feature_type_property_uk2`, then the columns, then the table.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. The assignment no longer derives from, or is checked against, a pairing.
    ----------------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS validate_blueprint_feature_type_property ON blueprint_feature_type_property;
    DROP FUNCTION IF EXISTS tr_validate_blueprint_feature_type_property();

    ----------------------------------------------------------------------------------------
    -- 2. Stored values are keyed on the assignment alone.
    ----------------------------------------------------------------------------------------
    DO $do$
    DECLARE
      tbl text;
    BEGIN
      FOREACH tbl IN ARRAY ARRAY[
        'submission_feature_property_string',
        'submission_feature_property_number',
        'submission_feature_property_boolean',
        'submission_feature_property_timestamp',
        'submission_feature_property_code',
        'submission_feature_property_taxon',
        'submission_feature_property_geometry',
        'submission_feature_property_feature',
        'submission_feature_property_artifact'
      ]
      LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', tbl, tbl || '_fk2');
        EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS feature_type_property_id', tbl);
      END LOOP;
    END
    $do$;

    ----------------------------------------------------------------------------------------
    -- 3. The assignment identifies its property by feature_property_id only.
    ----------------------------------------------------------------------------------------
    ALTER TABLE blueprint_feature_type_property
      DROP CONSTRAINT IF EXISTS blueprint_feature_type_property_uk2,
      DROP CONSTRAINT IF EXISTS blueprint_feature_type_property_ftp_pairing_fk,
      DROP CONSTRAINT IF EXISTS blueprint_feature_type_property_feature_type_property_fk;
    DROP INDEX IF EXISTS blueprint_feature_type_property_feature_type_property_id_idx;
    ALTER TABLE blueprint_feature_type_property DROP COLUMN IF EXISTS feature_type_property_id;

    COMMENT ON TABLE blueprint_feature_type_property IS 'The properties a Blueprint assigns to each of its feature types. The assignment owns the property reference, whether it is required, whether it allows multiple values, its ordering and its lifecycle, and is the identity every stored value, ingestion error and predicate refers to.';
    COMMENT ON COLUMN blueprint_feature_type_property.feature_property_id IS 'Foreign key to the feature_property table; the reusable property definition this Blueprint feature type is assigned.';

    ----------------------------------------------------------------------------------------
    -- 4. Ingestion errors, predicates and allowed reference targets.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_feature_error DROP CONSTRAINT IF EXISTS submission_feature_error_fk2;
    DROP INDEX IF EXISTS submission_feature_error_idx3;
    ALTER TABLE submission_feature_error DROP COLUMN IF EXISTS feature_type_property_id;

    ALTER TABLE predicate DROP CONSTRAINT IF EXISTS predicate_fk1;
    DROP INDEX IF EXISTS predicate_idx1;
    DROP INDEX IF EXISTS predicate_idx2;
    ALTER TABLE predicate DROP COLUMN IF EXISTS feature_type_property_id;

    ALTER TABLE feature_type_property_feature DROP CONSTRAINT IF EXISTS feature_type_property_feature_fk1;
    ALTER TABLE feature_type_property_feature DROP COLUMN IF EXISTS feature_type_property_id;

    ----------------------------------------------------------------------------------------
    -- 5. Upload-scoped staging carries the assignment only.
    ----------------------------------------------------------------------------------------
    DROP INDEX IF EXISTS sf_resolved_work_idx2;
    ALTER TABLE submission_upload_staging_resolved_property DROP COLUMN IF EXISTS feature_type_property_id;

    DROP INDEX IF EXISTS sf_property_value_work_idx2;
    DROP INDEX IF EXISTS sf_property_value_work_idx4;
    ALTER TABLE submission_upload_staging_typed_property_value DROP COLUMN IF EXISTS feature_type_property_id;
    CREATE INDEX sf_property_value_work_idx4
      ON submission_upload_staging_typed_property_value (
        submission_upload_id,
        submission_feature_id,
        blueprint_feature_type_property_id,
        property_name
      );

    DROP INDEX IF EXISTS sf_datetime_candidate_work_idx2;
    ALTER TABLE submission_upload_staging_datetime_candidate DROP COLUMN IF EXISTS feature_type_property_id;
    DROP INDEX IF EXISTS sf_spatial_candidate_work_idx2;
    ALTER TABLE submission_upload_staging_spatial_candidate DROP COLUMN IF EXISTS feature_type_property_id;
    DROP INDEX IF EXISTS sf_code_candidate_work_idx2;
    ALTER TABLE submission_upload_staging_code_candidate DROP COLUMN IF EXISTS feature_type_property_id;
    DROP INDEX IF EXISTS sf_taxon_candidate_work_idx2;
    ALTER TABLE submission_upload_staging_taxon_candidate DROP COLUMN IF EXISTS feature_type_property_id;
    DROP INDEX IF EXISTS sf_artifact_candidate_work_idx2;
    ALTER TABLE submission_upload_staging_artifact_candidate DROP COLUMN IF EXISTS feature_type_property_id;
    DROP INDEX IF EXISTS sf_feature_candidate_work_idx2;
    ALTER TABLE submission_upload_staging_feature_candidate DROP COLUMN IF EXISTS feature_type_property_id;

    ----------------------------------------------------------------------------------------
    -- 6. The pairing itself.
    ----------------------------------------------------------------------------------------
    DROP TABLE feature_type_property;
  `);
}

/**
 * Reverses {@link up} as far as the data allows.
 *
 * The pairing is rebuilt from the assignments, one per distinct (feature type, property), with the
 * requiredness, multiplicity and ordering of the assignments merged. Its original identifiers, effective
 * dates and history do not round-trip. Every dropped column returns nullable and is repopulated through
 * the assignment; the composite keys of the stored value tables are restored by `20260923120000`'s down.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Rebuild the pairing from the assignments.
    ----------------------------------------------------------------------------------------
    CREATE TABLE feature_type_property(
      feature_type_property_id           integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      feature_type_id                    integer           NOT NULL,
      feature_property_id                integer           NOT NULL,
      required_value                     boolean           DEFAULT false,
      allow_multiple                     boolean           DEFAULT false NOT NULL,
      sort                               integer,
      record_effective_date              date              DEFAULT now() NOT NULL,
      record_end_date                    date,
      create_date                        timestamptz(6)    DEFAULT now() NOT NULL,
      create_user                        integer           NOT NULL,
      update_date                        timestamptz(6),
      update_user                        integer,
      revision_count                     integer           DEFAULT 0 NOT NULL,
      CONSTRAINT feature_type_property_pk PRIMARY KEY (feature_type_property_id),
      CONSTRAINT feature_type_property_fk1 FOREIGN KEY (feature_type_id) REFERENCES feature_type(feature_type_id),
      CONSTRAINT feature_type_property_fk2 FOREIGN KEY (feature_property_id) REFERENCES feature_property(feature_property_id),
      CONSTRAINT feature_type_property_uk2 UNIQUE (feature_type_property_id, feature_property_id)
    );
    CREATE UNIQUE INDEX feature_type_property_nuk1 ON feature_type_property(feature_type_id, feature_property_id, (record_end_date is NULL)) where record_end_date is null;
    CREATE INDEX feature_type_property_idx1 ON feature_type_property(feature_type_id);
    CREATE INDEX feature_type_property_idx2 ON feature_type_property(feature_property_id);
    COMMENT ON TABLE feature_type_property IS 'A join table on feature type and feature_property. Defines which properties can be used by a given feature type.';
    CREATE TRIGGER audit_feature_type_property BEFORE INSERT OR UPDATE OR DELETE ON feature_type_property FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_feature_type_property AFTER INSERT OR UPDATE OR DELETE ON feature_type_property FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value, allow_multiple, sort, create_user)
    SELECT bft.feature_type_id, bftp.feature_property_id, bool_or(bftp.required_value), bool_or(bftp.allow_multiple), min(bftp.sort), min(bftp.create_user)
    FROM blueprint_feature_type_property bftp
    JOIN blueprint_feature_type bft ON bft.blueprint_feature_type_id = bftp.blueprint_feature_type_id
    GROUP BY bft.feature_type_id, bftp.feature_property_id;

    ----------------------------------------------------------------------------------------
    -- 2. Assignments point at their pairing again.
    ----------------------------------------------------------------------------------------
    ALTER TABLE blueprint_feature_type_property ADD COLUMN feature_type_property_id integer;
    UPDATE blueprint_feature_type_property bftp
    SET feature_type_property_id = ftp.feature_type_property_id
    FROM blueprint_feature_type bft, feature_type_property ftp
    WHERE bft.blueprint_feature_type_id = bftp.blueprint_feature_type_id
      AND ftp.feature_type_id = bft.feature_type_id
      AND ftp.feature_property_id = bftp.feature_property_id;
    ALTER TABLE blueprint_feature_type_property ALTER COLUMN feature_type_property_id SET NOT NULL;
    ALTER TABLE blueprint_feature_type_property
      ADD CONSTRAINT blueprint_feature_type_property_feature_type_property_fk FOREIGN KEY (feature_type_property_id) REFERENCES feature_type_property(feature_type_property_id),
      ADD CONSTRAINT blueprint_feature_type_property_uk2 UNIQUE (feature_type_property_id, blueprint_feature_type_property_id),
      ADD CONSTRAINT blueprint_feature_type_property_ftp_pairing_fk FOREIGN KEY (feature_type_property_id, feature_property_id) REFERENCES feature_type_property(feature_type_property_id, feature_property_id);
    CREATE INDEX blueprint_feature_type_property_feature_type_property_id_idx ON blueprint_feature_type_property(feature_type_property_id);
    COMMENT ON COLUMN blueprint_feature_type_property.feature_type_property_id IS 'Compatibility reference to the global feature_type_property pairing. Must name the same property as feature_property_id and belong to the feature type of the parent blueprint_feature_type.';

    CREATE OR REPLACE FUNCTION tr_validate_blueprint_feature_type_property()
      RETURNS trigger
      LANGUAGE plpgsql
    AS $$
    DECLARE
      pairing record;
      owning_feature_type_id integer;
    BEGIN
      SELECT ftp.feature_type_id, ftp.feature_property_id
      INTO pairing
      FROM feature_type_property ftp
      WHERE ftp.feature_type_property_id = NEW.feature_type_property_id;

      IF NOT FOUND THEN
        RETURN NEW;
      END IF;

      IF TG_OP = 'INSERT' AND NEW.feature_property_id IS NULL THEN
        NEW.feature_property_id := pairing.feature_property_id;
      END IF;

      SELECT bft.feature_type_id
      INTO owning_feature_type_id
      FROM blueprint_feature_type bft
      WHERE bft.blueprint_feature_type_id = NEW.blueprint_feature_type_id;

      IF FOUND AND pairing.feature_type_id <> owning_feature_type_id THEN
        RAISE EXCEPTION
          'feature_type_property_id % does not belong to the feature type of blueprint_feature_type_id %',
          NEW.feature_type_property_id,
          NEW.blueprint_feature_type_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER validate_blueprint_feature_type_property
      BEFORE INSERT OR UPDATE OF blueprint_feature_type_id, feature_type_property_id, feature_property_id
      ON blueprint_feature_type_property
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_validate_blueprint_feature_type_property();

    ----------------------------------------------------------------------------------------
    -- 3. Every other carrier of the pairing identifier, repopulated through the assignment.
    ----------------------------------------------------------------------------------------
    DO $do$
    DECLARE
      tbl text;
    BEGIN
      FOREACH tbl IN ARRAY ARRAY[
        'submission_feature_property_string',
        'submission_feature_property_number',
        'submission_feature_property_boolean',
        'submission_feature_property_timestamp',
        'submission_feature_property_code',
        'submission_feature_property_taxon',
        'submission_feature_property_geometry',
        'submission_feature_property_feature',
        'submission_feature_property_artifact',
        'submission_feature_error',
        'predicate',
        'feature_type_property_feature',
        'submission_upload_staging_resolved_property',
        'submission_upload_staging_typed_property_value',
        'submission_upload_staging_datetime_candidate',
        'submission_upload_staging_spatial_candidate',
        'submission_upload_staging_code_candidate',
        'submission_upload_staging_taxon_candidate',
        'submission_upload_staging_artifact_candidate',
        'submission_upload_staging_feature_candidate'
      ]
      LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN feature_type_property_id integer', tbl);
        EXECUTE format($q$
          UPDATE %I t
          SET feature_type_property_id = bftp.feature_type_property_id
          FROM blueprint_feature_type_property bftp
          WHERE bftp.blueprint_feature_type_property_id = t.blueprint_feature_type_property_id
        $q$, tbl);
      END LOOP;

      FOREACH tbl IN ARRAY ARRAY[
        'submission_feature_property_string',
        'submission_feature_property_number',
        'submission_feature_property_boolean',
        'submission_feature_property_timestamp',
        'submission_feature_property_code',
        'submission_feature_property_taxon',
        'submission_feature_property_geometry',
        'submission_feature_property_feature',
        'submission_feature_property_artifact'
      ]
      LOOP
        EXECUTE format('ALTER TABLE %I ALTER COLUMN feature_type_property_id SET NOT NULL', tbl);
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (feature_type_property_id) REFERENCES feature_type_property(feature_type_property_id)',
          tbl, tbl || '_fk2'
        );
      END LOOP;
    END
    $do$;

    ALTER TABLE submission_feature_error ADD CONSTRAINT submission_feature_error_fk2 FOREIGN KEY (feature_type_property_id) REFERENCES feature_type_property(feature_type_property_id);
    CREATE INDEX submission_feature_error_idx3 ON submission_feature_error(submission_upload_id, feature_type_property_id);

    ALTER TABLE predicate ADD CONSTRAINT predicate_fk1 FOREIGN KEY (feature_type_property_id) REFERENCES feature_type_property(feature_type_property_id);
    CREATE INDEX predicate_idx1 ON predicate(feature_type_property_id);
    CREATE INDEX predicate_idx2 ON predicate(feature_type_property_id) WHERE record_end_date IS NULL;

    ALTER TABLE feature_type_property_feature ALTER COLUMN feature_type_property_id SET NOT NULL;
    ALTER TABLE feature_type_property_feature ADD CONSTRAINT feature_type_property_feature_fk1 FOREIGN KEY (feature_type_property_id) REFERENCES feature_type_property(feature_type_property_id);

    CREATE INDEX sf_resolved_work_idx2 ON submission_upload_staging_resolved_property (submission_upload_id, feature_type_property_id);
    DROP INDEX IF EXISTS sf_property_value_work_idx4;
    CREATE INDEX sf_property_value_work_idx2 ON submission_upload_staging_typed_property_value (submission_upload_id, feature_type_property_id);
    CREATE INDEX sf_property_value_work_idx4 ON submission_upload_staging_typed_property_value (submission_upload_id, submission_feature_id, feature_type_property_id, property_name);
    CREATE INDEX sf_datetime_candidate_work_idx2 ON submission_upload_staging_datetime_candidate (submission_upload_id, feature_type_property_id);
    CREATE INDEX sf_spatial_candidate_work_idx2 ON submission_upload_staging_spatial_candidate (submission_upload_id, feature_type_property_id);
    CREATE INDEX sf_code_candidate_work_idx2 ON submission_upload_staging_code_candidate (submission_upload_id, feature_type_property_id);
    CREATE INDEX sf_taxon_candidate_work_idx2 ON submission_upload_staging_taxon_candidate (submission_upload_id, feature_type_property_id);
    CREATE INDEX sf_artifact_candidate_work_idx2 ON submission_upload_staging_artifact_candidate (submission_upload_id, feature_type_property_id);
    CREATE INDEX sf_feature_candidate_work_idx2 ON submission_upload_staging_feature_candidate (submission_upload_id, feature_type_property_id);
  `);
}
