-- Test adapter only: build indexed rows from the legacy fixture payloads so the old
-- query can remain an oracle where the two representations agree.
ALTER TABLE biohub.feature_type ADD COLUMN record_end_date timestamptz;
CREATE TABLE biohub.feature_property_type (feature_property_type_id integer PRIMARY KEY, name text, record_end_date timestamptz);
CREATE TABLE biohub.feature_property (feature_property_id integer PRIMARY KEY, feature_property_type_id integer, name text, record_end_date timestamptz);
CREATE TABLE biohub.feature_type_property (feature_type_property_id integer PRIMARY KEY, feature_type_id integer, feature_property_id integer, record_end_date timestamptz);
INSERT INTO biohub.feature_property_type VALUES (1,'string',NULL),(2,'number',NULL),(3,'datetime',NULL),(4,'spatial',NULL),(5,'taxon',NULL),(6,'code',NULL);
INSERT INTO biohub.feature_property VALUES
 (1,5,'taxon_id',NULL),(2,3,'timestamp',NULL),(3,3,'start_date',NULL),(4,4,'geometry',NULL),
 (5,2,'latitude',NULL),(6,2,'longitude',NULL),(7,2,'count',NULL),(8,2,'subcount_count',NULL),(9,2,'dop',NULL),
 (10,1,'observation_id',NULL),(11,1,'animal_identifier',NULL),(12,1,'device_key',NULL),
 (13,1,'ecological_unit_type',NULL),(14,1,'ecological_unit_value',NULL),
 (15,6,'sign',NULL),(16,6,'sex',NULL),(17,6,'life_stage',NULL);
INSERT INTO biohub.feature_type_property
SELECT ft.feature_type_id*100+fp.feature_property_id,ft.feature_type_id,fp.feature_property_id,NULL
FROM biohub.feature_type ft CROSS JOIN biohub.feature_property fp;
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
INSERT INTO biohub.contributor_codeset VALUES (1,NULL);
CREATE FUNCTION biohub.try_geom_from_geojson(value text) RETURNS geometry LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN RETURN public.ST_GeomFromGeoJSON(value); EXCEPTION WHEN OTHERS THEN RETURN NULL; END $$;
INSERT INTO biohub.submission_feature_property_string (submission_feature_id,feature_type_property_id,value)
SELECT sf.submission_feature_id,ftp.feature_type_property_id,sf.data->'properties'->>fp.name
FROM biohub.submission_feature sf JOIN biohub.feature_type_property ftp USING(feature_type_id)
JOIN biohub.feature_property fp USING(feature_property_id)
WHERE fp.feature_property_type_id=1 AND sf.data->'properties'->>fp.name IS NOT NULL;
INSERT INTO biohub.submission_feature_property_number (submission_feature_id,feature_type_property_id,value)
SELECT sf.submission_feature_id,ftp.feature_type_property_id,(sf.data->'properties'->>fp.name)::numeric
FROM biohub.submission_feature sf JOIN biohub.feature_type_property ftp USING(feature_type_id)
JOIN biohub.feature_property fp USING(feature_property_id)
WHERE fp.feature_property_type_id=2 AND sf.data->'properties'->>fp.name IS NOT NULL;
INSERT INTO biohub.submission_feature_property_timestamp (submission_feature_id,feature_type_property_id,date_value,time_value)
SELECT sf.submission_feature_id,ftp.feature_type_property_id,(sf.data->'properties'->>fp.name)::timestamptz::date,
 (sf.data->'properties'->>fp.name)::timestamptz::time
FROM biohub.submission_feature sf JOIN biohub.feature_type_property ftp USING(feature_type_id)
JOIN biohub.feature_property fp USING(feature_property_id)
WHERE fp.feature_property_type_id=3 AND NULLIF(sf.data->'properties'->>fp.name,'') IS NOT NULL;
INSERT INTO biohub.submission_feature_property_taxon (submission_feature_id,feature_type_property_id,taxon_id)
SELECT sf.submission_feature_id,ftp.feature_type_property_id,t.taxon_id
FROM biohub.submission_feature sf JOIN biohub.feature_type_property ftp USING(feature_type_id)
JOIN biohub.feature_property fp USING(feature_property_id)
JOIN LATERAL (SELECT taxon_id FROM biohub.taxon WHERE itis_tsn=(sf.data->'properties'->>fp.name)::int
 AND record_end_date IS NULL ORDER BY taxon_id LIMIT 1) t ON true
WHERE fp.feature_property_type_id=5;
INSERT INTO biohub.submission_feature_property_code (submission_feature_id,feature_type_property_id,contributor_codeset_code_id)
SELECT sf.submission_feature_id,ftp.feature_type_property_id,
 CASE WHEN fp.name='sign' THEN split_part(sf.data->'properties'->>fp.name,'::',3)::int ELSE (sf.data->'properties'->>fp.name)::int END
FROM biohub.submission_feature sf JOIN biohub.feature_type_property ftp USING(feature_type_id)
JOIN biohub.feature_property fp USING(feature_property_id)
WHERE fp.feature_property_type_id=6 AND sf.data->'properties'->>fp.name IS NOT NULL;
INSERT INTO biohub.submission_feature_property_geometry (submission_feature_id,feature_type_property_id,value)
SELECT sf.submission_feature_id,ftp.feature_type_property_id,g.value
FROM biohub.submission_feature sf JOIN biohub.feature_type_property ftp USING(feature_type_id)
JOIN biohub.feature_property fp USING(feature_property_id)
JOIN LATERAL (SELECT biohub.try_geom_from_geojson(CASE sf.data#>>'{properties,geometry,type}'
 WHEN 'Feature' THEN sf.data#>>'{properties,geometry,geometry}'
 WHEN 'FeatureCollection' THEN sf.data#>>'{properties,geometry,features,0,geometry}'
 ELSE sf.data#>>'{properties,geometry}' END) AS value) g ON g.value IS NOT NULL
WHERE fp.feature_property_type_id=4;
-- Presence indexes mirror the existing July 13 migration.
CREATE INDEX ON biohub.submission_feature_property_string(submission_feature_id,feature_type_property_id);
CREATE INDEX ON biohub.submission_feature_property_number(submission_feature_id,feature_type_property_id);
CREATE INDEX ON biohub.submission_feature_property_timestamp(submission_feature_id,feature_type_property_id);
CREATE INDEX ON biohub.submission_feature_property_geometry(submission_feature_id,feature_type_property_id);
CREATE INDEX ON biohub.submission_feature_property_taxon(submission_feature_id,feature_type_property_id);
CREATE INDEX ON biohub.submission_feature_property_code(submission_feature_id,feature_type_property_id);
ANALYZE;
