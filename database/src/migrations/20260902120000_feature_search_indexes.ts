import type { Knex } from 'knex';

/**
 * Add the indexes used by feature search.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- DROP REPLACED PROPERTY INDEXES
    --------------------------------------------------------------------------------

    DROP INDEX IF EXISTS submission_feature_property_string_idx1;
    DROP INDEX IF EXISTS submission_feature_property_string_idx2;
    DROP INDEX IF EXISTS submission_feature_property_string_idx3;
    DROP INDEX IF EXISTS submission_feature_property_string_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_number_idx1;
    DROP INDEX IF EXISTS submission_feature_property_number_idx2;
    DROP INDEX IF EXISTS submission_feature_property_number_idx3;
    DROP INDEX IF EXISTS submission_feature_property_number_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_boolean_idx1;
    DROP INDEX IF EXISTS submission_feature_property_boolean_idx2;
    DROP INDEX IF EXISTS submission_feature_property_boolean_idx3;
    DROP INDEX IF EXISTS submission_feature_property_boolean_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_idx1;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_idx2;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_idx3;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_idx4;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_geometry_idx1;
    DROP INDEX IF EXISTS submission_feature_property_geometry_idx2;
    DROP INDEX IF EXISTS submission_feature_property_code_idx1;
    DROP INDEX IF EXISTS submission_feature_property_code_idx2;
    DROP INDEX IF EXISTS submission_feature_property_code_idx3;
    DROP INDEX IF EXISTS submission_feature_property_code_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_taxon_idx1;
    DROP INDEX IF EXISTS submission_feature_property_taxon_idx2;
    DROP INDEX IF EXISTS submission_feature_property_taxon_idx3;
    DROP INDEX IF EXISTS submission_feature_property_taxon_presence_idx;

    --------------------------------------------------------------------------------
    -- DROP REPLACED FEATURE INDEXES
    --------------------------------------------------------------------------------

    DROP INDEX IF EXISTS submission_feature_idx2;

    --------------------------------------------------------------------------------
    -- PROPERTY PREDICATE INDEXES
    --------------------------------------------------------------------------------

    -- Evidence-first expression queries constrain a concrete property assignment and value,
    -- then return the owning feature ID. The assignment prefix also serves metadata probes.
    CREATE INDEX submission_feature_property_string_idx2
      ON submission_feature_property_string (feature_type_property_id, value, submission_feature_id);
    CREATE INDEX submission_feature_property_number_idx2
      ON submission_feature_property_number (feature_type_property_id, value, submission_feature_id);
    CREATE INDEX submission_feature_property_boolean_idx2
      ON submission_feature_property_boolean (feature_type_property_id, value, submission_feature_id);
    CREATE INDEX submission_feature_property_timestamp_idx2
      ON submission_feature_property_timestamp (feature_type_property_id, date_value, submission_feature_id);
    CREATE INDEX submission_feature_property_timestamp_idx5
      ON submission_feature_property_timestamp (feature_type_property_id, time_value, submission_feature_id);
    CREATE INDEX submission_feature_property_timestamp_idx6
      ON submission_feature_property_timestamp
        (feature_type_property_id, (date_value + time_value), submission_feature_id)
      WHERE date_value IS NOT NULL AND time_value IS NOT NULL;
    CREATE INDEX submission_feature_property_geometry_idx2
      ON submission_feature_property_geometry (feature_type_property_id, submission_feature_id);
    CREATE INDEX submission_feature_property_code_idx2
      ON submission_feature_property_code (feature_type_property_id, contributor_codeset_code_id, submission_feature_id);
    CREATE INDEX submission_feature_property_taxon_idx2
      ON submission_feature_property_taxon (feature_type_property_id, taxon_id, submission_feature_id);

    --------------------------------------------------------------------------------
    -- PROPERTY FEATURE-LOOKUP INDEXES
    --------------------------------------------------------------------------------

    -- Correlated expression probes and page hydration start with a feature ID. Included values
    -- allow expression probes to remain index-only when no referenced-value lookup is required.
    CREATE INDEX submission_feature_property_string_presence_idx
      ON submission_feature_property_string (submission_feature_id, feature_type_property_id)
      INCLUDE (value);
    CREATE INDEX submission_feature_property_number_presence_idx
      ON submission_feature_property_number (submission_feature_id, feature_type_property_id)
      INCLUDE (value);
    CREATE INDEX submission_feature_property_boolean_presence_idx
      ON submission_feature_property_boolean (submission_feature_id, feature_type_property_id)
      INCLUDE (value);
    CREATE INDEX submission_feature_property_timestamp_presence_idx
      ON submission_feature_property_timestamp (submission_feature_id, feature_type_property_id)
      INCLUDE (date_value, time_value);
    CREATE INDEX submission_feature_property_code_presence_idx
      ON submission_feature_property_code (submission_feature_id, feature_type_property_id)
      INCLUDE (contributor_codeset_code_id);
    CREATE INDEX submission_feature_property_taxon_presence_idx
      ON submission_feature_property_taxon (submission_feature_id, feature_type_property_id)
      INCLUDE (taxon_id);

    --------------------------------------------------------------------------------
    -- PROPERTY COUNT INDEXES
    --------------------------------------------------------------------------------

    -- Broad predicates such as Exists and NotEquals scan one property assignment and deduplicate
    -- feature IDs. Keeping the feature ID before the included value avoids an additional sort.
    CREATE INDEX submission_feature_property_string_count_idx
      ON submission_feature_property_string (feature_type_property_id, submission_feature_id)
      INCLUDE (value);
    CREATE INDEX submission_feature_property_number_count_idx
      ON submission_feature_property_number (feature_type_property_id, submission_feature_id)
      INCLUDE (value);
    CREATE INDEX submission_feature_property_boolean_count_idx
      ON submission_feature_property_boolean (feature_type_property_id, submission_feature_id)
      INCLUDE (value);
    CREATE INDEX submission_feature_property_timestamp_count_idx
      ON submission_feature_property_timestamp (feature_type_property_id, submission_feature_id)
      INCLUDE (date_value, time_value);
    CREATE INDEX submission_feature_property_code_count_idx
      ON submission_feature_property_code (feature_type_property_id, submission_feature_id)
      INCLUDE (contributor_codeset_code_id);
    CREATE INDEX submission_feature_property_taxon_count_idx
      ON submission_feature_property_taxon (feature_type_property_id, submission_feature_id)
      INCLUDE (taxon_id);

    --------------------------------------------------------------------------------
    -- FEATURE SEARCH ORDERING INDEXES
    --------------------------------------------------------------------------------

    CREATE INDEX submission_feature_search_type_id_idx
      ON submission_feature (feature_type_id, submission_feature_id);
    CREATE INDEX submission_feature_search_type_create_date_idx
      ON submission_feature (feature_type_id, create_date DESC, submission_feature_id DESC);

    --------------------------------------------------------------------------------
    -- CLOSURE SEARCH AND AUTHORIZATION INDEXES
    --------------------------------------------------------------------------------

    -- Closure readiness probes only need reflexive rows.
    CREATE INDEX submission_feature_closure_self_idx
      ON submission_feature_closure (source_submission_feature_id)
      WHERE (source_submission_feature_id = target_submission_feature_id) IS TRUE;

    -- Per-feature security checks start with a candidate and walk to secured ancestors.
    CREATE INDEX submission_feature_closure_ancestor_source_idx
      ON submission_feature_closure (source_submission_feature_id, target_submission_feature_id)
      WHERE is_ancestor = true;

    -- Set-oriented security and scope expansion starts with an ancestor and returns descendants.
    CREATE INDEX submission_feature_closure_ancestor_target_idx
      ON submission_feature_closure (target_submission_feature_id, source_submission_feature_id)
      WHERE is_ancestor = true;
  `);
}

/**
 * Remove the feature-search indexes.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- DROP CLOSURE SEARCH AND AUTHORIZATION INDEXES
    --------------------------------------------------------------------------------

    DROP INDEX IF EXISTS submission_feature_closure_ancestor_target_idx;
    DROP INDEX IF EXISTS submission_feature_closure_ancestor_source_idx;
    DROP INDEX IF EXISTS submission_feature_closure_self_idx;

    --------------------------------------------------------------------------------
    -- DROP FEATURE SEARCH ORDERING INDEXES
    --------------------------------------------------------------------------------

    DROP INDEX IF EXISTS submission_feature_search_type_create_date_idx;
    DROP INDEX IF EXISTS submission_feature_search_type_id_idx;

    --------------------------------------------------------------------------------
    -- DROP PROPERTY COUNT INDEXES
    --------------------------------------------------------------------------------

    DROP INDEX IF EXISTS submission_feature_property_taxon_count_idx;
    DROP INDEX IF EXISTS submission_feature_property_code_count_idx;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_count_idx;
    DROP INDEX IF EXISTS submission_feature_property_boolean_count_idx;
    DROP INDEX IF EXISTS submission_feature_property_number_count_idx;
    DROP INDEX IF EXISTS submission_feature_property_string_count_idx;

    --------------------------------------------------------------------------------
    -- DROP PROPERTY FEATURE-LOOKUP INDEXES
    --------------------------------------------------------------------------------

    DROP INDEX IF EXISTS submission_feature_property_taxon_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_code_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_boolean_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_number_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_string_presence_idx;

    --------------------------------------------------------------------------------
    -- DROP PROPERTY PREDICATE INDEXES
    --------------------------------------------------------------------------------

    DROP INDEX IF EXISTS submission_feature_property_taxon_idx2;
    DROP INDEX IF EXISTS submission_feature_property_code_idx2;
    DROP INDEX IF EXISTS submission_feature_property_geometry_idx2;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_idx6;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_idx5;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_idx2;
    DROP INDEX IF EXISTS submission_feature_property_boolean_idx2;
    DROP INDEX IF EXISTS submission_feature_property_number_idx2;
    DROP INDEX IF EXISTS submission_feature_property_string_idx2;

    --------------------------------------------------------------------------------
    -- RESTORE PROPERTY INDEXES
    --------------------------------------------------------------------------------

    CREATE INDEX submission_feature_property_string_idx1 ON submission_feature_property_string (submission_feature_id);
    CREATE INDEX submission_feature_property_string_idx2 ON submission_feature_property_string (feature_type_property_id);
    CREATE INDEX submission_feature_property_string_idx3 ON submission_feature_property_string (value);
    CREATE INDEX submission_feature_property_string_presence_idx
      ON submission_feature_property_string (submission_feature_id, feature_type_property_id);

    CREATE INDEX submission_feature_property_number_idx1 ON submission_feature_property_number (submission_feature_id);
    CREATE INDEX submission_feature_property_number_idx2 ON submission_feature_property_number (feature_type_property_id);
    CREATE INDEX submission_feature_property_number_idx3 ON submission_feature_property_number (value);
    CREATE INDEX submission_feature_property_number_presence_idx
      ON submission_feature_property_number (submission_feature_id, feature_type_property_id);

    CREATE INDEX submission_feature_property_boolean_idx1 ON submission_feature_property_boolean (submission_feature_id);
    CREATE INDEX submission_feature_property_boolean_idx2 ON submission_feature_property_boolean (feature_type_property_id);
    CREATE INDEX submission_feature_property_boolean_idx3 ON submission_feature_property_boolean (value);
    CREATE INDEX submission_feature_property_boolean_presence_idx
      ON submission_feature_property_boolean (submission_feature_id, feature_type_property_id);

    CREATE INDEX submission_feature_property_timestamp_idx1 ON submission_feature_property_timestamp (submission_feature_id);
    CREATE INDEX submission_feature_property_timestamp_idx2 ON submission_feature_property_timestamp (feature_type_property_id);
    CREATE INDEX submission_feature_property_timestamp_idx3 ON submission_feature_property_timestamp (date_value);
    CREATE INDEX submission_feature_property_timestamp_idx4 ON submission_feature_property_timestamp (time_value);
    CREATE INDEX submission_feature_property_timestamp_presence_idx
      ON submission_feature_property_timestamp (submission_feature_id, feature_type_property_id);

    CREATE INDEX submission_feature_property_geometry_idx1 ON submission_feature_property_geometry (submission_feature_id);
    CREATE INDEX submission_feature_property_geometry_idx2 ON submission_feature_property_geometry (feature_type_property_id);

    CREATE INDEX submission_feature_property_code_idx1 ON submission_feature_property_code (submission_feature_id);
    CREATE INDEX submission_feature_property_code_idx2 ON submission_feature_property_code (feature_type_property_id);
    CREATE INDEX submission_feature_property_code_idx3 ON submission_feature_property_code (contributor_codeset_code_id);
    CREATE INDEX submission_feature_property_code_presence_idx
      ON submission_feature_property_code (submission_feature_id, feature_type_property_id);

    CREATE INDEX submission_feature_property_taxon_idx1 ON submission_feature_property_taxon (submission_feature_id);
    CREATE INDEX submission_feature_property_taxon_idx2 ON submission_feature_property_taxon (feature_type_property_id);
    CREATE INDEX submission_feature_property_taxon_idx3 ON submission_feature_property_taxon (taxon_id);
    CREATE INDEX submission_feature_property_taxon_presence_idx
      ON submission_feature_property_taxon (submission_feature_id, feature_type_property_id);

    --------------------------------------------------------------------------------
    -- RESTORE FEATURE INDEXES
    --------------------------------------------------------------------------------

    CREATE INDEX submission_feature_idx2 ON submission_feature (feature_type_id);
  `);
}
