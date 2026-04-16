import { Knex } from 'knex';

/**
 * Create durable upload-scoped working tables for submission feature property ingestion.
 *
 * These replace session-local temp tables so ingestion phases can run across multiple connections.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE TABLE IF NOT EXISTS submission_upload_staging_raw_property (
      submission_feature_property_staging_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      submission_feature_id integer NOT NULL,
      submission_upload_id uuid NOT NULL,
      feature_type_id integer NOT NULL,
      property_name text NOT NULL,
      value jsonb NOT NULL,
      create_date timestamptz(6) DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sfp_staging_work_idx1
      ON submission_upload_staging_raw_property (submission_upload_id, feature_type_id, property_name);
    CREATE INDEX IF NOT EXISTS sfp_staging_work_idx2
      ON submission_upload_staging_raw_property (submission_upload_id, property_name);

    CREATE TABLE IF NOT EXISTS submission_upload_staging_feature_type_property_map (
      submission_upload_staging_feature_type_property_map_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      submission_upload_id uuid NOT NULL,
      feature_type_id integer NOT NULL,
      property_name text NOT NULL,
      feature_type_property_id integer NOT NULL,
      allow_multiple boolean NOT NULL,
      required_value boolean NOT NULL,
      property_type_name text NOT NULL,
      create_date timestamptz(6) DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sf_ftp_map_work_idx1
      ON submission_upload_staging_feature_type_property_map (submission_upload_id, feature_type_id, property_name);
    CREATE INDEX IF NOT EXISTS sf_ftp_map_work_idx2
      ON submission_upload_staging_feature_type_property_map (submission_upload_id, feature_type_property_id);

    CREATE TABLE IF NOT EXISTS submission_upload_staging_resolved_property (
      submission_upload_staging_resolved_property_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      submission_feature_property_staging_id uuid NOT NULL,
      submission_feature_id integer NOT NULL,
      submission_upload_id uuid NOT NULL,
      feature_type_id integer NOT NULL,
      property_name text NOT NULL,
      value jsonb NOT NULL,
      feature_type_property_id integer,
      allow_multiple boolean,
      required_value boolean,
      property_type_name text,
      create_date timestamptz(6) DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sf_resolved_work_idx1
      ON submission_upload_staging_resolved_property (submission_upload_id, submission_feature_id);
    CREATE INDEX IF NOT EXISTS sf_resolved_work_idx2
      ON submission_upload_staging_resolved_property (submission_upload_id, feature_type_property_id);
    CREATE INDEX IF NOT EXISTS sf_resolved_work_idx3
      ON submission_upload_staging_resolved_property (submission_upload_id, property_type_name);

    CREATE TABLE IF NOT EXISTS submission_upload_staging_typed_property_value (
      submission_upload_staging_typed_property_value_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      submission_feature_id integer NOT NULL,
      submission_upload_id uuid NOT NULL,
      feature_type_id integer NOT NULL,
      feature_type_property_id integer NOT NULL,
      property_name text NOT NULL,
      property_type_name text NOT NULL,
      allow_multiple boolean NOT NULL,
      logical_value jsonb NOT NULL,
      create_date timestamptz(6) DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sf_property_value_work_idx1
      ON submission_upload_staging_typed_property_value (submission_upload_id, property_type_name);
    CREATE INDEX IF NOT EXISTS sf_property_value_work_idx2
      ON submission_upload_staging_typed_property_value (submission_upload_id, feature_type_property_id);
    CREATE INDEX IF NOT EXISTS sf_property_value_work_idx3
      ON submission_upload_staging_typed_property_value (submission_upload_id, submission_feature_id);

    CREATE TABLE IF NOT EXISTS submission_upload_staging_valid_property_value (
      submission_upload_staging_valid_property_value_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      submission_feature_id integer NOT NULL,
      submission_upload_id uuid NOT NULL,
      feature_type_id integer NOT NULL,
      feature_type_property_id integer NOT NULL,
      property_name text NOT NULL,
      property_type_name text NOT NULL,
      allow_multiple boolean NOT NULL,
      logical_value jsonb NOT NULL,
      create_date timestamptz(6) DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sf_valid_property_value_work_idx1
      ON submission_upload_staging_valid_property_value (submission_upload_id, property_type_name);
    CREATE INDEX IF NOT EXISTS sf_valid_property_value_work_idx2
      ON submission_upload_staging_valid_property_value (submission_upload_id, feature_type_property_id);

    CREATE TABLE IF NOT EXISTS submission_upload_staging_datetime_candidate (
      submission_upload_staging_datetime_candidate_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      submission_upload_id uuid NOT NULL,
      submission_feature_id integer NOT NULL,
      property_name text NOT NULL,
      feature_type_property_id integer NOT NULL,
      value_text text,
      raw_value jsonb NOT NULL,
      date_value date,
      time_value time without time zone,
      create_date timestamptz(6) DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sf_datetime_candidate_work_idx1
      ON submission_upload_staging_datetime_candidate (submission_upload_id, submission_feature_id);

    CREATE TABLE IF NOT EXISTS submission_upload_staging_spatial_candidate (
      submission_upload_staging_spatial_candidate_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      submission_upload_id uuid NOT NULL,
      submission_feature_id integer NOT NULL,
      property_name text NOT NULL,
      feature_type_property_id integer NOT NULL,
      logical_value jsonb NOT NULL,
      geometry_json jsonb,
      parsed_geom geometry,
      validity_reason text,
      is_valid boolean,
      create_date timestamptz(6) DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sf_spatial_candidate_work_idx1
      ON submission_upload_staging_spatial_candidate (submission_upload_id, submission_feature_id);

    CREATE TABLE IF NOT EXISTS submission_upload_staging_code_candidate (
      submission_upload_staging_code_candidate_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      submission_upload_id uuid NOT NULL,
      submission_feature_id integer NOT NULL,
      property_name text NOT NULL,
      feature_type_property_id integer NOT NULL,
      raw_value jsonb NOT NULL,
      is_format_valid boolean NOT NULL,
      normalized_slug text,
      contributor_codeset_code_id integer,
      create_date timestamptz(6) DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sf_code_candidate_work_idx1
      ON submission_upload_staging_code_candidate (submission_upload_id, is_format_valid);

    CREATE TABLE IF NOT EXISTS submission_upload_staging_taxon_candidate (
      submission_upload_staging_taxon_candidate_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      submission_upload_id uuid NOT NULL,
      submission_feature_id integer NOT NULL,
      property_name text NOT NULL,
      feature_type_property_id integer NOT NULL,
      raw_value jsonb NOT NULL,
      tsn integer,
      taxon_id integer,
      create_date timestamptz(6) DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sf_taxon_candidate_work_idx1
      ON submission_upload_staging_taxon_candidate (submission_upload_id, taxon_id);

    CREATE TABLE IF NOT EXISTS submission_upload_staging_artifact_candidate (
      submission_upload_staging_artifact_candidate_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      submission_upload_id uuid NOT NULL,
      submission_feature_id integer NOT NULL,
      property_name text NOT NULL,
      feature_type_property_id integer NOT NULL,
      raw_value jsonb NOT NULL,
      normalized_reference text,
      artifact_id uuid,
      create_date timestamptz(6) DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sf_artifact_candidate_work_idx1
      ON submission_upload_staging_artifact_candidate (submission_upload_id, artifact_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TABLE IF EXISTS submission_upload_staging_artifact_candidate;
    DROP TABLE IF EXISTS submission_upload_staging_taxon_candidate;
    DROP TABLE IF EXISTS submission_upload_staging_code_candidate;
    DROP TABLE IF EXISTS submission_upload_staging_spatial_candidate;
    DROP TABLE IF EXISTS submission_upload_staging_datetime_candidate;
    DROP TABLE IF EXISTS submission_upload_staging_valid_property_value;
    DROP TABLE IF EXISTS submission_upload_staging_typed_property_value;
    DROP TABLE IF EXISTS submission_upload_staging_resolved_property;
    DROP TABLE IF EXISTS submission_upload_staging_feature_type_property_map;
    DROP TABLE IF EXISTS submission_upload_staging_raw_property;
  `);
}
