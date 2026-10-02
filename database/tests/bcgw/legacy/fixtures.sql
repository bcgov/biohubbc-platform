-- Isolated query fixtures: only columns consumed by the historical BCGW SQL.
-- Production-schema compatibility is checked separately against the local database.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA biohub;
SET search_path = biohub, public;
CREATE TABLE feature_type (feature_type_id integer PRIMARY KEY, name text);
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
INSERT INTO feature_type VALUES (1,'species_observation'),(2,'sample_site'),(3,'sample_period'),
 (4,'telemetry'),(5,'telemetry_deployment'),(6,'animal'),(7,'ecological_unit'),(8,'survey');
INSERT INTO submission VALUES (1,'BCGW fixtures',1);
INSERT INTO submission_upload VALUES ('00000000-0000-0000-0000-000000000001',1,NULL);
INSERT INTO contributor VALUES (1,'FiXtUrE',NULL);
INSERT INTO contributor_codeset_code VALUES (1,'Female'),(2,'Adult'),(3,'Seen');

-- Observations 1-21: security, eligibility, site selection and timestamp fallback.
INSERT INTO submission_feature (submission_feature_id,feature_type_id,data)
SELECT id,1,jsonb_build_object('properties',jsonb_build_object(
 'timestamp','2020-06-01T12:34:56Z','taxon_id',900000,'observation_id','group',
 'sex','1','life_stage','2','sign','code::observation_sign::3','count',4,'subcount_count',2))
FROM generate_series(1,21) id;
INSERT INTO submission_feature (submission_feature_id,feature_type_id) VALUES (200,8),(201,8);
INSERT INTO submission_feature (submission_feature_id,feature_type_id,data,record_effective_date,record_end_date) VALUES
 (100,2,'{"properties":{"geometry":{"type":"Point","coordinates":[-121,51]}}}',now()-interval '1 year',NULL),
 (101,2,'{"properties":{"geometry":{"type":"Point","coordinates":[-122,52]}}}',now()-interval '1 year',NULL),
 (102,2,'{"properties":{}}',now()+interval '1 day',NULL),
 (103,2,'{"properties":{}}',now()-interval '1 year',now()),
 (104,2,'{"properties":{"geometry":{"type":"garbage"}}}',now()-interval '1 year',NULL),
 (110,3,'{"properties":{"start_date":"2019-01-01T01:02:03Z"}}',now()-interval '1 year',NULL),
 (111,3,'{"properties":{"start_date":"2018-02-03T04:05:06Z"}}',now()-interval '1 year',NULL);
INSERT INTO submission_feature_closure SELECT submission_feature_id,submission_feature_id,true FROM submission_feature
 WHERE submission_feature_id NOT IN (5,6);
INSERT INTO submission_feature_closure VALUES
 (1,100,true),(2,100,true),(3,100,true),(3,200,true),(4,100,true),(4,201,false),(5,100,true),
 (7,102,true),(8,103,true),(9,100,false),(9,101,true),(10,104,true),
 (11,110,false),(11,111,true),(12,100,true),(12,101,true),(13,110,true),(13,111,true),
 (14,100,true),(15,100,true),(16,100,true),(17,100,true),(18,100,true),(19,100,true),(20,100,true);
INSERT INTO submission_feature_security VALUES (2,NULL),(200,NULL),(201,NULL);
UPDATE submission_feature SET data = jsonb_set(data,'{properties,timestamp}','null') WHERE submission_feature_id IN (11,13);
UPDATE submission_feature SET data = jsonb_set(data,'{properties,geometry}',
 '{"type":"LineString","coordinates":[[-123,53],[-124,54]]}') WHERE submission_feature_id = 14;
UPDATE submission_feature SET data = jsonb_set(data,'{properties,geometry}',
 '{"type":"MultiLineString","coordinates":[[[-124,54],[-125,55]]]}') WHERE submission_feature_id = 15;
UPDATE submission_feature SET data = jsonb_set(data,'{properties,geometry}',
 '{"type":"Polygon","coordinates":[[[0,0],[2,0],[2,2],[0,2],[0,0]]]}') WHERE submission_feature_id = 16;
UPDATE submission_feature SET data = jsonb_set(data,'{properties,geometry}',
 '{"type":"Feature","geometry":{"type":"Point","coordinates":[-125,55]}}') WHERE submission_feature_id = 17;
UPDATE submission_feature SET data = jsonb_set(data,'{properties,geometry}',
 '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[-126,56]}},{"type":"Feature","geometry":{"type":"Point","coordinates":[0,0]}}]}') WHERE submission_feature_id = 18;
UPDATE submission_feature SET data = jsonb_set(data,'{properties}',data->'properties' ||
 '{"latitude":57,"longitude":-127,"geometry":{"type":"Point","coordinates":[0,0]}}') WHERE submission_feature_id = 19;
UPDATE submission_feature SET data = jsonb_set(data,'{properties,geometry}','{"type":"invalid"}') WHERE submission_feature_id=20;

-- Taxonomy covers every excluded root, descendants, Tetrapoda, missing/inactive parents and cycles.
INSERT INTO taxon VALUES
 (1,900000,NULL,'Land species','Land',NULL),
 (2,161061,NULL,'Actinopterygii',NULL,NULL),(3,161048,NULL,'Sarcopterygii',NULL,NULL),
 (4,914181,3,'Tetrapoda',NULL,NULL),(5,159785,NULL,'Chondrichthyes',NULL,NULL),
 (6,914178,NULL,'Agnatha',NULL,NULL),(7,900007,2,'Ray fish',NULL,NULL),
 (8,900008,3,'Lobe fish',NULL,NULL),(9,900009,4,'Tetrapod',NULL,NULL),
 (10,900010,5,'Cartilaginous fish',NULL,NULL),(11,900011,6,'Jawless fish',NULL,NULL),
 (12,900012,999,'Incomplete',NULL,NULL),(13,900013,14,'Cycle one',NULL,NULL),
 (14,900014,13,'Cycle two',NULL,NULL),(15,900015,16,'Fish cycle',NULL,NULL),
 (16,161061,15,'Fish cycle root',NULL,NULL),(17,900017,2,'Inactive start',NULL,now()),
 (18,900018,19,'Inactive parent',NULL,NULL),(19,161061,NULL,'Inactive root',NULL,now()),
 (20,900020,NULL,'Historical duplicate',NULL,now()),(21,900020,NULL,'Active duplicate',NULL,NULL);
INSERT INTO submission_feature (submission_feature_id,feature_type_id,data)
SELECT 300+taxon_id,1,jsonb_build_object('properties',jsonb_build_object('taxon_id',itis_tsn))
FROM taxon WHERE taxon_id IN (2,3,4,5,6,7,8,9,10,11,12,13,15,17,18,20);
INSERT INTO submission_feature (submission_feature_id,feature_type_id,data)
VALUES (399,1,'{"properties":{"taxon_id":999999}}');
INSERT INTO submission_feature_closure SELECT submission_feature_id,submission_feature_id,true FROM submission_feature
WHERE submission_feature_id >= 300;

-- Telemetry: cutoff boundary, missing deployment, duplicate animals and ecological units.
INSERT INTO submission_feature (submission_feature_id,feature_type_id,parent_submission_feature_id,data)
VALUES (500,5,200,'{"properties":{"animal_identifier":"A","device_key":"vendor::device"}}'),
 (501,6,200,'{"properties":{"animal_identifier":"A","taxon_id":900000,"sex":"1"}}'),
 (502,6,200,'{"properties":{"animal_identifier":"A","taxon_id":900000,"sex":"1"}}'),
 (510,7,501,'{"properties":{"ecological_unit_type":"B","ecological_unit_value":"2"}}'),
 (511,7,NULL,'{"properties":{"ecological_unit_type":"A","ecological_unit_value":"1"}}'),
 (512,7,502,'{"properties":{"ecological_unit_type":"A","ecological_unit_value":"1"}}');
INSERT INTO submission_feature_feature VALUES (501,511),(511,502),(501,510);
INSERT INTO submission_feature (submission_feature_id,feature_type_id,parent_submission_feature_id,data)
SELECT id,4,CASE WHEN id=603 THEN 999 ELSE 500 END,
 jsonb_build_object('properties',jsonb_build_object('timestamp',
 now()-interval '3 months'+CASE WHEN id=601 THEN interval '1 microsecond' WHEN id=602 THEN interval '-1 microsecond' ELSE interval '0' END,
 'geometry',jsonb_build_object('type','Point','coordinates',jsonb_build_array(-120,50)),'dop',1.5))
FROM generate_series(600,611) id;
UPDATE submission_feature SET data=jsonb_set(data,'{properties,geometry}','{"type":"invalid"}') WHERE submission_feature_id=607;
UPDATE submission_feature SET data=jsonb_set(data,'{properties,geometry}',
 '{"type":"Feature","geometry":{"type":"Point","coordinates":[-119,49]}}') WHERE submission_feature_id=608;
UPDATE submission_feature SET data=jsonb_set(data,'{properties,geometry}',
 '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[-118,48]}}]}') WHERE submission_feature_id=609;
UPDATE submission_feature SET data=jsonb_set(data,'{properties,timestamp}','null') WHERE submission_feature_id=611;
INSERT INTO submission_feature_closure SELECT submission_feature_id,submission_feature_id,true FROM submission_feature
WHERE submission_feature_id >= 500 AND submission_feature_id NOT IN (606,610);
INSERT INTO submission_feature_closure VALUES (604,201,false),(605,200,true),(606,500,true);
INSERT INTO submission_feature_security VALUES (602,NULL);
