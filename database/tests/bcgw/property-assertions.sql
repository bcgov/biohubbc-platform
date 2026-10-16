-- Configured properties are metadata rows, not physical export columns.
SAVEPOINT missing_property;
UPDATE biohub.feature_property SET record_end_date=now() WHERE name='life_stage';
REFRESH MATERIALIZED VIEW bcgw.wld_observations_public;
DO $$ BEGIN
 ASSERT EXISTS(SELECT FROM bcgw.wld_observations_public
   WHERE feature_id=1 AND life_stage IS NULL AND sex='Female'), 'deleted life stage leaves a NULL export column';
END $$;
ROLLBACK TO SAVEPOINT missing_property;

SAVEPOINT renamed_property;
UPDATE biohub.feature_property SET name='development_stage' WHERE name='life_stage';
REFRESH MATERIALIZED VIEW bcgw.wld_observations_public;
DO $$ BEGIN
 ASSERT EXISTS(SELECT FROM bcgw.wld_observations_public
   WHERE feature_id=1 AND life_stage IS NULL AND sex='Female'), 'renamed property leaves the existing export intact';
END $$;
ROLLBACK TO SAVEPOINT renamed_property;

-- No raw value may fill a missing typed property, even if JSON disagrees.
UPDATE biohub.submission_feature SET data='{"properties":{"taxon_id":161061,"count":9999,"timestamp":"1900-01-01","latitude":0,"longitude":0}}' WHERE submission_feature_id=1;
DELETE FROM biohub.submission_feature_property_taxon WHERE submission_feature_id=1;
REFRESH MATERIALIZED VIEW bcgw.wld_observations_public;
DO $$ BEGIN
 ASSERT EXISTS(SELECT FROM bcgw.wld_observations_public WHERE feature_id=1 AND taxon_id IS NULL AND count='2' AND latitude='51'), 'typed values authoritative';
 ASSERT EXISTS(SELECT FROM bcgw.wld_incidental_public WHERE feature_id=399 AND taxon_id IS NULL), 'missing taxon has no raw fallback';
END $$;
-- Multiple indexed values are serialized in property-row order, without multiplying the feature.
INSERT INTO biohub.submission_feature_property_number(submission_feature_id,feature_type_property_id,value) VALUES (1,108,3);
REFRESH MATERIALIZED VIEW bcgw.wld_observations_public;
DO $$ BEGIN ASSERT (SELECT count FROM bcgw.wld_observations_public WHERE feature_id=1)='2;3'; END $$;
-- A partial observation timestamp does not borrow the missing component from a period.
INSERT INTO biohub.submission_feature_property_timestamp(submission_feature_id,feature_type_property_id,date_value,time_value)
VALUES (11,102,'2021-01-01',NULL),(13,102,NULL,'06:07:08');
REFRESH MATERIALIZED VIEW bcgw.wld_incidental_public;
DO $$ BEGIN
 ASSERT EXISTS(SELECT FROM bcgw.wld_incidental_public WHERE feature_id=11 AND date='2021-01-01' AND time IS NULL);
 ASSERT EXISTS(SELECT FROM bcgw.wld_incidental_public WHERE feature_id=13 AND date IS NULL AND time='06:07:08' AND year IS NULL);
END $$;
-- Disabled metadata, wrong-feature-type assignments, inactive codes and code sets are ignored.
UPDATE biohub.feature_type_property SET record_end_date=now() WHERE feature_type_property_id=116;
INSERT INTO biohub.submission_feature_property_number(submission_feature_id,feature_type_property_id,value) VALUES (1,208,99);
UPDATE biohub.contributor_codeset_code SET record_end_date=now() WHERE contributor_codeset_code_id=3;
REFRESH MATERIALIZED VIEW bcgw.wld_observations_public;
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM bcgw.wld_observations_public WHERE feature_id=1)=1;
 ASSERT NOT EXISTS(SELECT FROM bcgw.wld_observations_public WHERE feature_id=1 AND (sex IS NOT NULL OR sign IS NOT NULL));
END $$;
UPDATE biohub.contributor_codeset SET record_end_date=now();
REFRESH MATERIALIZED VIEW bcgw.wld_observations_public;
DO $$ BEGIN ASSERT NOT EXISTS(SELECT FROM bcgw.wld_observations_public WHERE life_stage IS NOT NULL); END $$;
-- Free text is already typed text, never decoded as a contributor identifier.
UPDATE biohub.feature_property SET feature_property_type_id=1 WHERE name='sign';
INSERT INTO biohub.submission_feature_property_string(submission_feature_id,feature_type_property_id,value) VALUES (1,115,'tracks');
REFRESH MATERIALIZED VIEW bcgw.wld_observations_public;
DO $$ BEGIN ASSERT EXISTS(SELECT FROM bcgw.wld_observations_public WHERE feature_id=1 AND sign='tracks'); END $$;
-- Removing a related site's current membership changes classification, even with an active feature row.
DELETE FROM biohub.submission_feature_closure WHERE source_submission_feature_id=104;
REFRESH MATERIALIZED VIEW bcgw.wld_incidental_public;
DO $$ BEGIN ASSERT EXISTS(SELECT FROM bcgw.wld_incidental_public WHERE feature_id=10); END $$;
-- A telemetry timestamp with only time has no age; date-only values use midnight for the cutoff.
UPDATE biohub.submission_feature_property_timestamp SET date_value=NULL WHERE submission_feature_id=603;
UPDATE biohub.submission_feature_property_timestamp SET date_value=current_date-interval '1 year',time_value=NULL WHERE submission_feature_id=608;
REFRESH MATERIALIZED VIEW bcgw.wld_telemetry_public;
DO $$ BEGIN
 ASSERT NOT EXISTS(SELECT FROM bcgw.wld_telemetry_public WHERE feature_id=603);
 ASSERT EXISTS(SELECT FROM bcgw.wld_telemetry_public WHERE feature_id=608 AND time IS NULL);
END $$;
-- Search's active window includes a current feature whose end date is still in the future.
UPDATE biohub.submission_feature SET record_end_date=now()+interval '1 day' WHERE submission_feature_id=1;
REFRESH MATERIALIZED VIEW bcgw.wld_observations_public;
DO $$ BEGIN ASSERT EXISTS(SELECT FROM bcgw.wld_observations_public WHERE feature_id=1); END $$;
-- Stored date/time components are not reinterpreted from payload offsets on reads.
SET LOCAL TIME ZONE 'America/Vancouver';
REFRESH MATERIALIZED VIEW bcgw.wld_incidental_public;
DO $$ BEGIN ASSERT EXISTS(SELECT FROM bcgw.wld_incidental_public WHERE feature_id=11 AND date='2021-01-01' AND time IS NULL); END $$;
SET LOCAL TIME ZONE 'UTC';
-- Retiring a property definition invalidates its indexed rows without consulting JSON.
UPDATE biohub.feature_property SET record_end_date=now() WHERE name='geometry';
REFRESH MATERIALIZED VIEW bcgw.wld_observations_public;
DO $$ BEGIN ASSERT EXISTS(SELECT FROM bcgw.wld_observations_public WHERE feature_id=1 AND latitude IS NULL AND longitude IS NULL); END $$;
-- Exclude each taxon value independently, not the entire multivalued feature.
INSERT INTO biohub.submission_feature_property_taxon(submission_feature_id,feature_type_property_id,taxon_id)
VALUES (1,101,1),(1,101,2);
REFRESH MATERIALIZED VIEW bcgw.wld_observations_public;
REFRESH MATERIALIZED VIEW bcgw.wld_observations_all;
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM bcgw.wld_observations_public WHERE feature_id=1)=1;
 ASSERT (SELECT count(*) FROM bcgw.wld_observations_all WHERE feature_id=1)=1;
 ASSERT NOT EXISTS(SELECT FROM bcgw.wld_observations_all WHERE feature_id=1 AND taxon_id IS DISTINCT FROM '900000');
END $$;
-- Independent multivalued fields and repeated equal values retain their own order.
INSERT INTO biohub.submission_feature_property_string(submission_feature_id,feature_type_property_id,value)
VALUES (1,115,'prints'),(1,115,'tracks');
REFRESH MATERIALIZED VIEW bcgw.wld_observations_public;
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM bcgw.wld_observations_public WHERE feature_id=1)=1;
 ASSERT EXISTS(SELECT FROM bcgw.wld_observations_public WHERE feature_id=1 AND count='2;3' AND sign='tracks;prints;tracks');
 ASSERT EXISTS(SELECT FROM bcgw.wld_telemetry_all WHERE feature_id=600 AND taxon_id='900000;900000' AND sex='Female;Female');
END $$;
-- The fixed metadata lookup must reject an ambiguous assignment, never choose MAX(id).
DO $$ BEGIN
 INSERT INTO biohub.feature_type_property SELECT 99999,feature_type_id,feature_property_id,record_end_date
 FROM biohub.feature_type_property WHERE feature_type_property_id=108;
 BEGIN
   REFRESH MATERIALIZED VIEW bcgw.wld_observations_public;
   RAISE EXCEPTION 'expected ambiguous property assignment to fail';
 EXCEPTION WHEN cardinality_violation THEN NULL;
 END;
 DELETE FROM biohub.feature_type_property WHERE feature_type_property_id=99999;
END $$;
-- Partial datetime components are serialized independently; no fallback fills a missing component.
INSERT INTO biohub.submission_feature_property_timestamp(submission_feature_id,feature_type_property_id,date_value,time_value)
VALUES (11,102,'2022-02-03','12:34:56');
SET LOCAL DateStyle TO 'SQL, DMY';
REFRESH MATERIALIZED VIEW bcgw.wld_incidental_public;
DO $$ BEGIN
 ASSERT EXISTS(SELECT FROM bcgw.wld_incidental_public WHERE feature_id=11
   AND date='2021-01-01;2022-02-03' AND time='12:34:56' AND year='2021;2022');
END $$;
SET LOCAL DateStyle TO 'ISO, MDY';
-- Telemetry properties aggregate separately even when two fields contain multiple values.
INSERT INTO biohub.submission_feature_property_number(submission_feature_id,feature_type_property_id,value)
VALUES (600,409,2.5);
INSERT INTO biohub.submission_feature_property_timestamp(submission_feature_id,feature_type_property_id,date_value,time_value)
VALUES (600,402,'2020-01-02','03:04:05');
REFRESH MATERIALIZED VIEW bcgw.wld_telemetry_public;
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM bcgw.wld_telemetry_public WHERE feature_id=600)=1;
 ASSERT EXISTS(SELECT FROM bcgw.wld_telemetry_public WHERE feature_id=600 AND dop='1.5;2.5'
   AND date LIKE '%;2020-01-02' AND taxon_id='900000;900000');
END $$;

-- Related telemetry metadata must also come from closure-backed features.
DELETE FROM biohub.submission_feature_closure WHERE source_submission_feature_id IN (501,510,511);
REFRESH MATERIALIZED VIEW bcgw.wld_telemetry_public;
DO $$ BEGIN
 ASSERT EXISTS(SELECT FROM bcgw.wld_telemetry_public WHERE feature_id=600
   AND taxon_id='900000' AND eco_unit='A::1'), 'only closure-backed animals and units contribute';
END $$;
DELETE FROM biohub.submission_feature_closure WHERE source_submission_feature_id=500;
REFRESH MATERIALIZED VIEW bcgw.wld_telemetry_public;
DO $$ BEGIN
 ASSERT EXISTS(SELECT FROM bcgw.wld_telemetry_public WHERE feature_id=600
   AND animal_id IS NULL AND device_key IS NULL AND taxon_id IS NULL AND sex IS NULL AND eco_unit IS NULL),
   'missing closure deployment leaves telemetry without related metadata';
END $$;
