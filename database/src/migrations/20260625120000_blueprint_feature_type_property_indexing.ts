import { Knex } from 'knex';

/**
 * Point staged and indexed property rows at Blueprint property assignments.
 *
 * The feature-property indexing job previously carried the canonical `feature_type_property_id`
 * surrogate through its upload-scoped staging tables and into the durable `submission_feature_property_*`
 * tables. Now that Blueprints exist (see `20260616120000_add_blueprint_tables.ts`), these rows should
 * instead reference the Blueprint assignment (`blueprint_feature_type_property_id`) so an indexed value
 * can be traced back to the exact schema configuration the indexing job used. The canonical
 * `feature_type_property_id` remains reachable with a single join through `blueprint_feature_type_property`.
 *
 * This migration:
 * 1. Renames `feature_type_property_id` -> `blueprint_feature_type_property_id` on the UNLOGGED
 *    upload-scoped staging tables (no foreign keys exist on these columns).
 * 2. On the durable `submission_feature_property_*` tables, drops the existing FK to
 *    `feature_type_property`, renames the column, and adds a new FK to `blueprint_feature_type_property`.
 *
 * Note: this is a structural rename, not a value-preserving one — the old `feature_type_property_id`
 * integers are not equal to `blueprint_feature_type_property_id`. Environments holding previously indexed
 * rows would need a re-index rather than relying on this rename. On a fresh/dev database this is a non-issue.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Rename the surrogate on the UNLOGGED upload-scoped staging tables.
    --    These have no foreign key on the column, so a plain rename is sufficient; indexes
    --    referencing the column follow the rename automatically.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_upload_staging_resolved_property
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    COMMENT ON COLUMN submission_upload_staging_resolved_property.blueprint_feature_type_property_id IS
      'Resolved blueprint_feature_type_property identifier (the Blueprint assignment) when the selected Blueprint assigns the property.';

    ALTER TABLE submission_upload_staging_typed_property_value
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    COMMENT ON COLUMN submission_upload_staging_typed_property_value.blueprint_feature_type_property_id IS
      'Resolved blueprint_feature_type_property identifier (the Blueprint assignment).';

    ALTER TABLE submission_upload_staging_datetime_candidate
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    COMMENT ON COLUMN submission_upload_staging_datetime_candidate.blueprint_feature_type_property_id IS
      'Resolved datetime blueprint_feature_type_property identifier (the Blueprint assignment).';

    ALTER TABLE submission_upload_staging_spatial_candidate
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    COMMENT ON COLUMN submission_upload_staging_spatial_candidate.blueprint_feature_type_property_id IS
      'Resolved spatial blueprint_feature_type_property identifier (the Blueprint assignment).';

    ALTER TABLE submission_upload_staging_code_candidate
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    COMMENT ON COLUMN submission_upload_staging_code_candidate.blueprint_feature_type_property_id IS
      'Resolved code blueprint_feature_type_property identifier (the Blueprint assignment).';

    ALTER TABLE submission_upload_staging_taxon_candidate
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    COMMENT ON COLUMN submission_upload_staging_taxon_candidate.blueprint_feature_type_property_id IS
      'Resolved taxon blueprint_feature_type_property identifier (the Blueprint assignment).';

    ALTER TABLE submission_upload_staging_artifact_candidate
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    COMMENT ON COLUMN submission_upload_staging_artifact_candidate.blueprint_feature_type_property_id IS
      'Resolved artifact blueprint_feature_type_property identifier (the Blueprint assignment).';

    ALTER TABLE submission_upload_staging_feature_candidate
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    COMMENT ON COLUMN submission_upload_staging_feature_candidate.blueprint_feature_type_property_id IS
      'Resolved feature-reference blueprint_feature_type_property identifier (the Blueprint assignment).';

    ----------------------------------------------------------------------------------------
    -- 2. Repoint the durable submission_feature_property_* tables at the Blueprint assignment.
    --    For each: drop the FK to feature_type_property, rename the column, add a FK to
    --    blueprint_feature_type_property. Indexes/unique constraints on the column follow the rename.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_feature_property_string DROP CONSTRAINT submission_feature_property_string_fk2;
    ALTER TABLE submission_feature_property_string
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    ALTER TABLE submission_feature_property_string ADD CONSTRAINT submission_feature_property_string_fk2
      FOREIGN KEY (blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id);
    COMMENT ON COLUMN submission_feature_property_string.blueprint_feature_type_property_id IS 'Foreign key to the blueprint_feature_type_property table (the Blueprint assignment that produced this value).';

    ALTER TABLE submission_feature_property_number DROP CONSTRAINT submission_feature_property_number_fk2;
    ALTER TABLE submission_feature_property_number
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    ALTER TABLE submission_feature_property_number ADD CONSTRAINT submission_feature_property_number_fk2
      FOREIGN KEY (blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id);
    COMMENT ON COLUMN submission_feature_property_number.blueprint_feature_type_property_id IS 'Foreign key to the blueprint_feature_type_property table (the Blueprint assignment that produced this value).';

    ALTER TABLE submission_feature_property_boolean DROP CONSTRAINT submission_feature_property_boolean_fk2;
    ALTER TABLE submission_feature_property_boolean
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    ALTER TABLE submission_feature_property_boolean ADD CONSTRAINT submission_feature_property_boolean_fk2
      FOREIGN KEY (blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id);
    COMMENT ON COLUMN submission_feature_property_boolean.blueprint_feature_type_property_id IS 'Foreign key to the blueprint_feature_type_property table (the Blueprint assignment that produced this value).';

    ALTER TABLE submission_feature_property_timestamp DROP CONSTRAINT submission_feature_property_timestamp_fk2;
    ALTER TABLE submission_feature_property_timestamp
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    ALTER TABLE submission_feature_property_timestamp ADD CONSTRAINT submission_feature_property_timestamp_fk2
      FOREIGN KEY (blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id);
    COMMENT ON COLUMN submission_feature_property_timestamp.blueprint_feature_type_property_id IS 'Foreign key to the blueprint_feature_type_property table (the Blueprint assignment that produced this value).';

    ALTER TABLE submission_feature_property_code DROP CONSTRAINT submission_feature_property_code_fk2;
    ALTER TABLE submission_feature_property_code
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    ALTER TABLE submission_feature_property_code ADD CONSTRAINT submission_feature_property_code_fk2
      FOREIGN KEY (blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id);
    COMMENT ON COLUMN submission_feature_property_code.blueprint_feature_type_property_id IS 'Foreign key to the blueprint_feature_type_property table (the Blueprint assignment that produced this value).';

    ALTER TABLE submission_feature_property_taxon DROP CONSTRAINT submission_feature_property_taxon_fk2;
    ALTER TABLE submission_feature_property_taxon
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    ALTER TABLE submission_feature_property_taxon ADD CONSTRAINT submission_feature_property_taxon_fk2
      FOREIGN KEY (blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id);
    COMMENT ON COLUMN submission_feature_property_taxon.blueprint_feature_type_property_id IS 'Foreign key to the blueprint_feature_type_property table (the Blueprint assignment that produced this value).';

    ALTER TABLE submission_feature_property_geometry DROP CONSTRAINT submission_feature_property_geometry_fk2;
    ALTER TABLE submission_feature_property_geometry
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    ALTER TABLE submission_feature_property_geometry ADD CONSTRAINT submission_feature_property_geometry_fk2
      FOREIGN KEY (blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id);
    COMMENT ON COLUMN submission_feature_property_geometry.blueprint_feature_type_property_id IS 'Foreign key to the blueprint_feature_type_property table (the Blueprint assignment that produced this value).';

    ALTER TABLE submission_feature_property_feature DROP CONSTRAINT submission_feature_property_feature_fk2;
    ALTER TABLE submission_feature_property_feature
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    ALTER TABLE submission_feature_property_feature ADD CONSTRAINT submission_feature_property_feature_fk2
      FOREIGN KEY (blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id);
    COMMENT ON COLUMN submission_feature_property_feature.blueprint_feature_type_property_id IS 'Foreign key to the blueprint_feature_type_property table (the Blueprint assignment that produced this value).';

    ----------------------------------------------------------------------------------------
    -- 3. Repoint the indexing-engine error table at the Blueprint assignment as well, so reported
    --    errors trace to the same schema configuration as the staged/indexed rows they came from.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_feature_error DROP CONSTRAINT submission_feature_error_fk2;
    ALTER TABLE submission_feature_error
      RENAME COLUMN feature_type_property_id TO blueprint_feature_type_property_id;
    ALTER TABLE submission_feature_error ADD CONSTRAINT submission_feature_error_fk2
      FOREIGN KEY (blueprint_feature_type_property_id)
      REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id);
    COMMENT ON COLUMN submission_feature_error.blueprint_feature_type_property_id IS 'Foreign key to the blueprint_feature_type_property table (the Blueprint assignment the error pertains to); null for errors not tied to a resolved property assignment.';
  `);
}

/**
 * Reverse the rename: repoint staged and indexed property rows back at `feature_type_property_id`.
 *
 * For the durable tables: drop the FK to `blueprint_feature_type_property`, rename the column back, and
 * restore the FK to `feature_type_property`.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Restore the indexing-engine error table.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_feature_error DROP CONSTRAINT submission_feature_error_fk2;
    ALTER TABLE submission_feature_error
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_feature_error ADD CONSTRAINT submission_feature_error_fk2
      FOREIGN KEY (feature_type_property_id)
      REFERENCES feature_type_property(feature_type_property_id);

    ----------------------------------------------------------------------------------------
    -- 2. Restore the durable submission_feature_property_* tables.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_feature_property_feature DROP CONSTRAINT submission_feature_property_feature_fk2;
    ALTER TABLE submission_feature_property_feature
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_feature_property_feature ADD CONSTRAINT submission_feature_property_feature_fk2
      FOREIGN KEY (feature_type_property_id)
      REFERENCES feature_type_property(feature_type_property_id);

    ALTER TABLE submission_feature_property_geometry DROP CONSTRAINT submission_feature_property_geometry_fk2;
    ALTER TABLE submission_feature_property_geometry
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_feature_property_geometry ADD CONSTRAINT submission_feature_property_geometry_fk2
      FOREIGN KEY (feature_type_property_id)
      REFERENCES feature_type_property(feature_type_property_id);

    ALTER TABLE submission_feature_property_taxon DROP CONSTRAINT submission_feature_property_taxon_fk2;
    ALTER TABLE submission_feature_property_taxon
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_feature_property_taxon ADD CONSTRAINT submission_feature_property_taxon_fk2
      FOREIGN KEY (feature_type_property_id)
      REFERENCES feature_type_property(feature_type_property_id);

    ALTER TABLE submission_feature_property_code DROP CONSTRAINT submission_feature_property_code_fk2;
    ALTER TABLE submission_feature_property_code
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_feature_property_code ADD CONSTRAINT submission_feature_property_code_fk2
      FOREIGN KEY (feature_type_property_id)
      REFERENCES feature_type_property(feature_type_property_id);

    ALTER TABLE submission_feature_property_timestamp DROP CONSTRAINT submission_feature_property_timestamp_fk2;
    ALTER TABLE submission_feature_property_timestamp
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_feature_property_timestamp ADD CONSTRAINT submission_feature_property_timestamp_fk2
      FOREIGN KEY (feature_type_property_id)
      REFERENCES feature_type_property(feature_type_property_id);

    ALTER TABLE submission_feature_property_boolean DROP CONSTRAINT submission_feature_property_boolean_fk2;
    ALTER TABLE submission_feature_property_boolean
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_feature_property_boolean ADD CONSTRAINT submission_feature_property_boolean_fk2
      FOREIGN KEY (feature_type_property_id)
      REFERENCES feature_type_property(feature_type_property_id);

    ALTER TABLE submission_feature_property_number DROP CONSTRAINT submission_feature_property_number_fk2;
    ALTER TABLE submission_feature_property_number
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_feature_property_number ADD CONSTRAINT submission_feature_property_number_fk2
      FOREIGN KEY (feature_type_property_id)
      REFERENCES feature_type_property(feature_type_property_id);

    ALTER TABLE submission_feature_property_string DROP CONSTRAINT submission_feature_property_string_fk2;
    ALTER TABLE submission_feature_property_string
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_feature_property_string ADD CONSTRAINT submission_feature_property_string_fk2
      FOREIGN KEY (feature_type_property_id)
      REFERENCES feature_type_property(feature_type_property_id);

    ----------------------------------------------------------------------------------------
    -- 3. Restore the UNLOGGED upload-scoped staging tables.
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_upload_staging_feature_candidate
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_upload_staging_artifact_candidate
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_upload_staging_taxon_candidate
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_upload_staging_code_candidate
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_upload_staging_spatial_candidate
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_upload_staging_datetime_candidate
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_upload_staging_typed_property_value
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
    ALTER TABLE submission_upload_staging_resolved_property
      RENAME COLUMN blueprint_feature_type_property_id TO feature_type_property_id;
  `);
}
