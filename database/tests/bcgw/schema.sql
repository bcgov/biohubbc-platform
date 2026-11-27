-- Minimal isolated schema for the BCGW query contract.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA biohub;
SET search_path = biohub, public;
CREATE TABLE feature_type (feature_type_id integer PRIMARY KEY, name text, record_end_date timestamptz);
CREATE TABLE submission_feature (
  submission_feature_id integer PRIMARY KEY, feature_type_id integer, submission_id integer DEFAULT 1,
  submission_upload_id uuid DEFAULT '00000000-0000-0000-0000-000000000001',
  parent_submission_feature_id integer, data jsonb DEFAULT '{"properties":{}}',
  record_end_date timestamptz, record_effective_date timestamptz DEFAULT now() - interval '1 year'
);
CREATE TABLE submission_feature_closure (
  source_submission_feature_id integer NOT NULL, target_submission_feature_id integer NOT NULL,
  is_ancestor boolean NOT NULL, PRIMARY KEY (source_submission_feature_id, target_submission_feature_id)
);
CREATE TABLE submission_feature_security (submission_feature_id integer, record_end_date timestamptz);
CREATE TABLE submission_feature_feature (source_feature_id integer NOT NULL, target_feature_id integer NOT NULL);
CREATE TABLE submission_upload (submission_upload_id uuid, submission_id integer, record_end_date timestamptz);
CREATE TABLE submission (submission_id integer, name text, contributor_id integer);
CREATE TABLE contributor (contributor_id integer, client_id text, record_end_date timestamptz);
CREATE TABLE contributor_codeset_code (contributor_codeset_code_id integer, label text);
CREATE TABLE taxon (
  taxon_id integer PRIMARY KEY, itis_tsn integer, parent_taxon_id integer,
  itis_scientific_name text, common_name text, record_end_date timestamptz
);
CREATE TABLE biohub.feature_property_type (feature_property_type_id integer PRIMARY KEY, name text, record_end_date timestamptz);
CREATE TABLE biohub.feature_property (feature_property_id integer PRIMARY KEY, feature_property_type_id integer, name text, record_end_date timestamptz);
CREATE TABLE biohub.feature_type_property (feature_type_property_id integer PRIMARY KEY, feature_type_id integer, feature_property_id integer, record_end_date timestamptz);
CREATE TABLE biohub.submission_feature_property_string (
 submission_feature_property_string_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 submission_feature_id integer, feature_type_property_id integer, value varchar(250) NOT NULL);
CREATE TABLE biohub.submission_feature_property_number (
 submission_feature_property_number_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 submission_feature_id integer, feature_type_property_id integer, value numeric NOT NULL);
CREATE TABLE biohub.submission_feature_property_timestamp (
 submission_feature_property_timestamp_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 submission_feature_id integer, feature_type_property_id integer, date_value date, time_value time);
CREATE TABLE biohub.submission_feature_property_geometry (
 submission_feature_property_geometry_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 submission_feature_id integer, feature_type_property_id integer, value geometry NOT NULL);
CREATE TABLE biohub.submission_feature_property_taxon (
 submission_feature_property_taxon_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 submission_feature_id integer, feature_type_property_id integer, taxon_id integer NOT NULL);
CREATE TABLE biohub.submission_feature_property_code (
 submission_feature_property_code_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 submission_feature_id integer, feature_type_property_id integer, contributor_codeset_code_id integer NOT NULL);
ALTER TABLE biohub.contributor_codeset_code ADD COLUMN contributor_codeset_id integer DEFAULT 1;
ALTER TABLE biohub.contributor_codeset_code ADD COLUMN record_end_date timestamptz;
CREATE TABLE biohub.contributor_codeset (contributor_codeset_id integer PRIMARY KEY, record_end_date timestamptz);
CREATE FUNCTION biohub.try_geom_from_geojson(value text) RETURNS geometry LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN RETURN public.ST_GeomFromGeoJSON(value); EXCEPTION WHEN OTHERS THEN RETURN NULL; END $$;
