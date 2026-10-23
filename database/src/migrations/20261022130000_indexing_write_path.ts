import type { Knex } from 'knex';

const DB_USER_API = process.env.DB_USER_API;

/**
 * Reduce per-row trigger and staging overhead on the submission indexing write path.
 *
 * 1. The high-volume submission feature tables are written in bulk by system jobs during ingestion,
 *    reconciliation, indexing and approval. Their `audit_*` triggers called `tr_audit_trigger` once per row
 *    to maintain audit columns that nothing reads: attribution lives on the upload, no writer uses
 *    `revision_count` for optimistic concurrency, and their `journal_*` triggers were already dropped. The
 *    `audit_*` triggers are dropped along with the audit columns they maintained. `submission_feature`
 *    keeps `create_date` (from its column default), which feature search sorts on.
 *
 * 2. `tr_validate_submission_feature_property_assignment` ran a six-table lookup per inserted property
 *    row. Inserts are now validated by an AFTER INSERT statement-level trigger that checks the whole
 *    transition table in one set-based query and raises the same errors. Transition tables cannot be
 *    combined with an `UPDATE OF` column list, so updates keep the existing per-row trigger.
 *
 * 3. Upload property staging:
 *    - `submission_upload_staging_raw_property` is dropped: resolved staging now expands
 *      `submission_feature.data.properties` directly, removing one full copy of every property value.
 *    - `submission_upload_staging_content_reference` stores resolved `data.content` references once for
 *      both reference error recording and relationship insertion.
 *    - Staging indexes that no query filters or joins on are dropped. Every remaining staging query filters
 *      by `submission_upload_id`, which the kept indexes lead with.
 *    - The API user is granted MAINTAIN on the staging tables so indexing can `ANALYZE` them mid-transaction.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Drop audit triggers and audit columns from high-volume submission feature tables.
    ----------------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS audit_submission_feature ON submission_feature;

    ALTER TABLE submission_feature
      DROP COLUMN create_user,
      DROP COLUMN update_date,
      DROP COLUMN update_user,
      DROP COLUMN revision_count;

    -- DROP COLUMN only marks the columns dropped in the catalog; no table is rewritten.
    DO $do$
    DECLARE
      tbl text;
    BEGIN
      FOREACH tbl IN ARRAY ARRAY[
        'submission_feature_property_string',
        'submission_feature_property_paragraph',
        'submission_feature_property_number',
        'submission_feature_property_boolean',
        'submission_feature_property_timestamp',
        'submission_feature_property_code',
        'submission_feature_property_taxon',
        'submission_feature_property_geometry',
        'submission_feature_property_feature',
        'submission_feature_property_artifact',
        'submission_feature_feature',
        'submission_feature_error'
      ]
      LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'audit_' || tbl, tbl);
        EXECUTE format(
          'ALTER TABLE %I DROP COLUMN create_date, DROP COLUMN create_user, DROP COLUMN update_date, DROP COLUMN update_user, DROP COLUMN revision_count',
          tbl
        );
      END LOOP;
    END
    $do$;

    ----------------------------------------------------------------------------------------
    -- 2. Statement-level property assignment validation for inserts.
    ----------------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION tr_validate_submission_feature_property_assignment_statement()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      expected_type text;
      violation record;
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

      -- Find one inserted row that fails any check; each check below raises the same error as the
      -- per-row trigger. A row with no matching assignment has a null owning feature type.
      --
      -- The transition table is read once and each row's assignment is looked up through primary keys.
      -- Transition tables have no statistics, so joining new_rows to a second scan of itself lets the
      -- planner rescan the whole tuplestore per row, which is quadratic in the rows inserted.
      SELECT
        new_rows.submission_feature_id,
        new_rows.blueprint_feature_type_property_id,
        assignment.assigned_feature_type_id,
        assignment.assigned_blueprint_id,
        assignment.owning_feature_type_id,
        assignment.owning_blueprint_id,
        assignment.declared_type
      INTO violation
      FROM new_rows
      LEFT JOIN LATERAL (
        SELECT
          bft.feature_type_id AS assigned_feature_type_id,
          bft.blueprint_id AS assigned_blueprint_id,
          sf.feature_type_id AS owning_feature_type_id,
          su.blueprint_id AS owning_blueprint_id,
          fpt.name AS declared_type
        FROM submission_feature sf
        JOIN submission_upload su
          ON su.submission_upload_id = sf.submission_upload_id
        JOIN blueprint_feature_type_property bftp
          ON bftp.blueprint_feature_type_property_id = new_rows.blueprint_feature_type_property_id
        JOIN blueprint_feature_type bft
          ON bft.blueprint_feature_type_id = bftp.blueprint_feature_type_id
        JOIN feature_property fp
          ON fp.feature_property_id = bftp.feature_property_id
        JOIN feature_property_type fpt
          ON fpt.feature_property_type_id = fp.feature_property_type_id
        WHERE sf.submission_feature_id = new_rows.submission_feature_id
      ) assignment ON true
      WHERE assignment.owning_feature_type_id IS NULL
         OR assignment.assigned_feature_type_id <> assignment.owning_feature_type_id
         OR assignment.assigned_blueprint_id <> assignment.owning_blueprint_id
         OR assignment.declared_type <> expected_type
      LIMIT 1;

      IF NOT FOUND THEN
        RETURN NULL;
      END IF;

      IF violation.owning_feature_type_id IS NULL
        OR violation.assigned_feature_type_id <> violation.owning_feature_type_id THEN
        RAISE EXCEPTION
          'blueprint_feature_type_property_id % does not belong to the feature type for submission_feature_id %',
          violation.blueprint_feature_type_property_id,
          violation.submission_feature_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF violation.assigned_blueprint_id <> violation.owning_blueprint_id THEN
        RAISE EXCEPTION
          'blueprint_feature_type_property_id % belongs to blueprint %, but submission_feature_id % was uploaded under blueprint %',
          violation.blueprint_feature_type_property_id,
          violation.assigned_blueprint_id,
          violation.submission_feature_id,
          violation.owning_blueprint_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      RAISE EXCEPTION
        '% stores % properties, but blueprint_feature_type_property_id % is declared as %',
        TG_TABLE_NAME,
        expected_type,
        violation.blueprint_feature_type_property_id,
        violation.declared_type
        USING ERRCODE = 'datatype_mismatch';
    END;
    $$;

    DO $do$
    DECLARE
      tbl text;
    BEGIN
      FOREACH tbl IN ARRAY ARRAY[
        'submission_feature_property_string',
        'submission_feature_property_paragraph',
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
        EXECUTE format('DROP TRIGGER IF EXISTS validate_submission_feature_property_assignment ON %I', tbl);
        EXECUTE format(
          'CREATE TRIGGER validate_submission_feature_property_assignment BEFORE UPDATE OF submission_feature_id, blueprint_feature_type_property_id ON %I FOR EACH ROW EXECUTE PROCEDURE tr_validate_submission_feature_property_assignment()',
          tbl
        );
        EXECUTE format(
          'CREATE TRIGGER validate_submission_feature_property_assignment_insert AFTER INSERT ON %I REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE PROCEDURE tr_validate_submission_feature_property_assignment_statement()',
          tbl
        );
      END LOOP;
    END
    $do$;

    ----------------------------------------------------------------------------------------
    -- 3. Upload property staging.
    ----------------------------------------------------------------------------------------
    DROP TABLE IF EXISTS submission_upload_staging_raw_property;

    CREATE UNLOGGED TABLE submission_upload_staging_content_reference (
      submission_upload_id uuid NOT NULL,
      source_feature_id integer NOT NULL,
      target_feature_id integer
    );

    CREATE INDEX sf_content_reference_work_idx1
      ON submission_upload_staging_content_reference (submission_upload_id);

    COMMENT ON TABLE submission_upload_staging_content_reference IS
      'UNLOGGED upload-scoped data.content feature references with their resolved targets.';
    COMMENT ON COLUMN submission_upload_staging_content_reference.submission_upload_id IS
      'Upload scope identifier.';
    COMMENT ON COLUMN submission_upload_staging_content_reference.source_feature_id IS
      'Submission feature whose data.content holds the reference.';
    COMMENT ON COLUMN submission_upload_staging_content_reference.target_feature_id IS
      'Resolved referenced submission feature; null when the reference is unresolved.';

    DROP INDEX IF EXISTS sf_resolved_work_idx3;
    DROP INDEX IF EXISTS sf_resolved_work_idx4;
    DROP INDEX IF EXISTS sf_resolved_work_idx5;
    DROP INDEX IF EXISTS sf_property_value_work_idx3;
    DROP INDEX IF EXISTS sf_property_value_work_idx4;
    DROP INDEX IF EXISTS sf_property_value_work_idx5;
    DROP INDEX IF EXISTS sf_datetime_candidate_work_idx3;
    DROP INDEX IF EXISTS sf_spatial_candidate_work_idx3;
    DROP INDEX IF EXISTS sf_code_candidate_work_idx3;
    DROP INDEX IF EXISTS sf_taxon_candidate_work_idx3;
    DROP INDEX IF EXISTS sf_artifact_candidate_work_idx3;
    DROP INDEX IF EXISTS sf_feature_candidate_work_idx3;

    GRANT MAINTAIN ON
      submission_upload_staging_resolved_property,
      submission_upload_staging_typed_property_value,
      submission_upload_staging_datetime_candidate,
      submission_upload_staging_spatial_candidate,
      submission_upload_staging_code_candidate,
      submission_upload_staging_taxon_candidate,
      submission_upload_staging_artifact_candidate,
      submission_upload_staging_feature_candidate,
      submission_upload_staging_content_reference
    TO ${DB_USER_API};
  `);
}

/**
 * Restore per-row audit and property assignment validation triggers and the previous staging layout.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    REVOKE MAINTAIN ON
      submission_upload_staging_resolved_property,
      submission_upload_staging_typed_property_value,
      submission_upload_staging_datetime_candidate,
      submission_upload_staging_spatial_candidate,
      submission_upload_staging_code_candidate,
      submission_upload_staging_taxon_candidate,
      submission_upload_staging_artifact_candidate,
      submission_upload_staging_feature_candidate
    FROM ${DB_USER_API};

    CREATE INDEX IF NOT EXISTS sf_resolved_work_idx3
      ON submission_upload_staging_resolved_property (submission_upload_id, property_type_name);
    CREATE INDEX IF NOT EXISTS sf_resolved_work_idx4
      ON submission_upload_staging_resolved_property (submission_upload_id, feature_type_id, property_name);
    CREATE INDEX IF NOT EXISTS sf_resolved_work_idx5
      ON submission_upload_staging_resolved_property (submission_upload_id, blueprint_feature_type_property_id);
    CREATE INDEX IF NOT EXISTS sf_property_value_work_idx3
      ON submission_upload_staging_typed_property_value (submission_upload_id, submission_feature_id);
    CREATE INDEX IF NOT EXISTS sf_property_value_work_idx4
      ON submission_upload_staging_typed_property_value (
        submission_upload_id,
        submission_feature_id,
        blueprint_feature_type_property_id,
        property_name
      );
    CREATE INDEX IF NOT EXISTS sf_property_value_work_idx5
      ON submission_upload_staging_typed_property_value (submission_upload_id, blueprint_feature_type_property_id);
    CREATE INDEX IF NOT EXISTS sf_datetime_candidate_work_idx3
      ON submission_upload_staging_datetime_candidate (submission_upload_id, blueprint_feature_type_property_id);
    CREATE INDEX IF NOT EXISTS sf_spatial_candidate_work_idx3
      ON submission_upload_staging_spatial_candidate (submission_upload_id, blueprint_feature_type_property_id);
    CREATE INDEX IF NOT EXISTS sf_code_candidate_work_idx3
      ON submission_upload_staging_code_candidate (submission_upload_id, blueprint_feature_type_property_id);
    CREATE INDEX IF NOT EXISTS sf_taxon_candidate_work_idx3
      ON submission_upload_staging_taxon_candidate (submission_upload_id, blueprint_feature_type_property_id);
    CREATE INDEX IF NOT EXISTS sf_artifact_candidate_work_idx3
      ON submission_upload_staging_artifact_candidate (submission_upload_id, blueprint_feature_type_property_id);
    CREATE INDEX IF NOT EXISTS sf_feature_candidate_work_idx3
      ON submission_upload_staging_feature_candidate (submission_upload_id, blueprint_feature_type_property_id);

    DROP TABLE IF EXISTS submission_upload_staging_content_reference;

    CREATE UNLOGGED TABLE IF NOT EXISTS submission_upload_staging_raw_property (
      submission_feature_id integer NOT NULL,
      submission_upload_id uuid NOT NULL,
      feature_type_id integer NOT NULL,
      property_name text NOT NULL,
      value jsonb NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sfp_staging_work_idx1
      ON submission_upload_staging_raw_property (submission_upload_id, feature_type_id, property_name);
    CREATE INDEX IF NOT EXISTS sfp_staging_work_idx2
      ON submission_upload_staging_raw_property (submission_upload_id, submission_feature_id, property_name);

    COMMENT ON TABLE submission_upload_staging_raw_property IS
      'UNLOGGED upload-scoped raw property staging rows extracted from submission_feature.data.properties.';

    DO $do$
    DECLARE
      tbl text;
    BEGIN
      FOREACH tbl IN ARRAY ARRAY[
        'submission_feature_property_string',
        'submission_feature_property_paragraph',
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
        EXECUTE format('DROP TRIGGER IF EXISTS validate_submission_feature_property_assignment_insert ON %I', tbl);
        EXECUTE format('DROP TRIGGER IF EXISTS validate_submission_feature_property_assignment ON %I', tbl);
        EXECUTE format(
          'CREATE TRIGGER validate_submission_feature_property_assignment BEFORE INSERT OR UPDATE OF submission_feature_id, blueprint_feature_type_property_id ON %I FOR EACH ROW EXECUTE PROCEDURE tr_validate_submission_feature_property_assignment()',
          tbl
        );
      END LOOP;
    END
    $do$;

    DROP FUNCTION IF EXISTS tr_validate_submission_feature_property_assignment_statement();

    -- Rows written while the audit columns were absent are attributed to the database user running the
    -- rollback, so create_user can be made NOT NULL again.
    DO $do$
    DECLARE
      tbl text;
      _system_user_id integer;
    BEGIN
      SELECT a.system_user_id INTO STRICT _system_user_id
      FROM "system_user" a
      JOIN user_identity_source b ON a.user_identity_source_id = b.user_identity_source_id
      WHERE b.name = 'DATABASE'
        AND a.user_identifier = user;

      FOREACH tbl IN ARRAY ARRAY[
        'submission_feature',
        'submission_feature_property_string',
        'submission_feature_property_paragraph',
        'submission_feature_property_number',
        'submission_feature_property_boolean',
        'submission_feature_property_timestamp',
        'submission_feature_property_code',
        'submission_feature_property_taxon',
        'submission_feature_property_geometry',
        'submission_feature_property_feature',
        'submission_feature_property_artifact',
        'submission_feature_feature',
        'submission_feature_error'
      ]
      LOOP
        EXECUTE format(
          'ALTER TABLE %I ADD COLUMN IF NOT EXISTS create_date timestamptz(6) DEFAULT now() NOT NULL, ADD COLUMN create_user integer, ADD COLUMN update_date timestamptz(6), ADD COLUMN update_user integer, ADD COLUMN revision_count integer DEFAULT 0 NOT NULL',
          tbl
        );
        EXECUTE format('UPDATE %I SET create_user = $1', tbl) USING _system_user_id;
        EXECUTE format('ALTER TABLE %I ALTER COLUMN create_user SET NOT NULL', tbl);
        EXECUTE format(
          'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger()',
          'audit_' || tbl,
          tbl
        );
      END LOOP;
    END
    $do$;
  `);
}
