-- Direct normalized fixtures; JSON is deliberately empty.
INSERT INTO feature_type(feature_type_id,name) VALUES (1,'species_observation'),(2,'sample_site'),(3,'sample_period'),
 (4,'telemetry'),(5,'telemetry_deployment'),(6,'animal'),(7,'ecological_unit'),(8,'survey');
INSERT INTO submission VALUES (1,'BCGW fixtures',1);
INSERT INTO submission_upload VALUES ('00000000-0000-0000-0000-000000000001',1,NULL);
INSERT INTO contributor VALUES (1,'FiXtUrE',NULL);
INSERT INTO contributor_codeset_code(contributor_codeset_code_id,label) VALUES (1,'Female'),(2,'Adult'),(3,'Seen');

-- Observations 1-21: security, eligibility, site selection and timestamp fallback.
INSERT INTO submission_feature (submission_feature_id,feature_type_id)
SELECT id,1 FROM generate_series(1,21) id;
INSERT INTO submission_feature (submission_feature_id,feature_type_id) VALUES
 (200,8),(201,8),(100,2),(101,2),(102,2),(103,2),(104,2),(110,3),(111,3);
UPDATE submission_feature SET record_effective_date=now()+interval '1 day' WHERE submission_feature_id=102;
UPDATE submission_feature SET record_end_date=now() WHERE submission_feature_id=103;
INSERT INTO submission_feature_closure SELECT submission_feature_id,submission_feature_id,true FROM submission_feature
 WHERE submission_feature_id NOT IN (5,6);
INSERT INTO submission_feature_closure VALUES
 (1,100,true),(2,100,true),(3,100,true),(3,200,true),(4,100,true),(4,201,false),(5,100,true),
 (7,102,true),(8,103,true),(9,100,false),(9,101,true),(10,104,true),
 (11,110,false),(11,111,true),(12,100,true),(12,101,true),(13,110,true),(13,111,true),
 (14,100,true),(15,100,true),(16,100,true),(17,100,true),(18,100,true),(19,100,true),(20,100,true);
INSERT INTO submission_feature_security VALUES (2,NULL),(200,NULL),(201,NULL);
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
INSERT INTO submission_feature (submission_feature_id,feature_type_id)
SELECT 300+id,1 FROM unnest(ARRAY[2,3,4,5,6,7,8,9,10,11,12,13,15,17,18,20,99]) id;
INSERT INTO submission_feature_closure SELECT submission_feature_id,submission_feature_id,true FROM submission_feature
WHERE submission_feature_id >= 300;

-- Telemetry: cutoff boundary, missing deployment, duplicate animals and ecological units.
INSERT INTO submission_feature (submission_feature_id,feature_type_id,parent_submission_feature_id)
VALUES (500,5,200),(501,6,200),(502,6,200),(510,7,501),(511,7,NULL),(512,7,502);
INSERT INTO submission_feature_feature VALUES (501,511),(511,502),(501,510);
INSERT INTO submission_feature (submission_feature_id,feature_type_id,parent_submission_feature_id)
SELECT id,4,CASE WHEN id=603 THEN 999 ELSE 500 END FROM generate_series(600,611) id;
INSERT INTO submission_feature_closure SELECT submission_feature_id,submission_feature_id,true FROM submission_feature
WHERE submission_feature_id >= 500 AND submission_feature_id NOT IN (606,610);
INSERT INTO submission_feature_closure VALUES (604,201,false),(605,200,true),(606,500,true);
INSERT INTO submission_feature_security VALUES (602,NULL);
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
INSERT INTO biohub.contributor_codeset VALUES (1,NULL);
-- Observation values: stable property-row ordering, independent of ingestion JSON.
INSERT INTO submission_feature_property_string(submission_feature_id,feature_type_property_id,value)
SELECT id,110,'group' FROM generate_series(1,21) id;
INSERT INTO submission_feature_property_number(submission_feature_id,feature_type_property_id,value)
SELECT id,p.property_id,p.value FROM generate_series(1,21) id CROSS JOIN (VALUES (107,4),(108,2)) p(property_id,value);
INSERT INTO submission_feature_property_number(submission_feature_id,feature_type_property_id,value)
VALUES (19,105,57),(19,106,-127);
INSERT INTO submission_feature_property_code(submission_feature_id,feature_type_property_id,contributor_codeset_code_id)
SELECT id,p.property_id,p.code FROM generate_series(1,21) id CROSS JOIN (VALUES (115,3),(116,1),(117,2)) p(property_id,code);
INSERT INTO submission_feature_property_timestamp(submission_feature_id,feature_type_property_id,date_value,time_value)
SELECT id,102,DATE '2020-06-01',TIME '12:34:56' FROM generate_series(1,21) id WHERE id NOT IN (11,13);
INSERT INTO submission_feature_property_timestamp(submission_feature_id,feature_type_property_id,date_value,time_value)
VALUES (110,303,'2019-01-01','01:02:03'),(111,303,'2018-02-03','04:05:06');
INSERT INTO submission_feature_property_geometry(submission_feature_id,feature_type_property_id,value)
SELECT id,property_id,ST_GeomFromText(wkt) FROM (VALUES
 (100,204,'POINT(-121 51)'),(101,204,'POINT(-122 52)'),
 (14,104,'LINESTRING(-123 53,-124 54)'),(15,104,'MULTILINESTRING((-124 54,-125 55))'),
 (16,104,'POLYGON((0 0,2 0,2 2,0 2,0 0))'),(17,104,'POINT(-125 55)'),
 (18,104,'POINT(-126 56)'),(19,104,'POINT(0 0)')) p(id,property_id,wkt);
INSERT INTO submission_feature_property_taxon(submission_feature_id,feature_type_property_id,taxon_id)
SELECT id,101,1 FROM generate_series(1,21) id;
INSERT INTO submission_feature_property_taxon(submission_feature_id,feature_type_property_id,taxon_id)
VALUES (302,101,2),(303,101,3),(304,101,4),(305,101,5),(306,101,6),(307,101,7),
 (308,101,8),(309,101,9),(310,101,10),(311,101,11),(312,101,12),(313,101,13),
 (315,101,15),(318,101,18),(320,101,21);
-- Telemetry: two matching animals and direct ecological-unit links.
INSERT INTO submission_feature_property_string(submission_feature_id,feature_type_property_id,value)
VALUES (500,511,'A'),(500,512,'vendor::device'),(501,611,'A'),(502,611,'A'),
 (510,713,'B'),(510,714,'2'),(511,713,'A'),(511,714,'1'),(512,713,'A'),(512,714,'1');
INSERT INTO submission_feature_property_taxon(submission_feature_id,feature_type_property_id,taxon_id)
VALUES (501,601,1),(502,601,1);
INSERT INTO submission_feature_property_code(submission_feature_id,feature_type_property_id,contributor_codeset_code_id)
VALUES (501,616,1),(502,616,1);
INSERT INTO submission_feature_property_timestamp(submission_feature_id,feature_type_property_id,date_value,time_value)
SELECT id,402,stamp::date,stamp::time FROM (
 SELECT id,localtimestamp-interval '3 months'+CASE WHEN id=601 THEN interval '1 microsecond'
 WHEN id=602 THEN interval '-1 microsecond' ELSE interval '0' END AS stamp
 FROM generate_series(600,610) id) dates;
INSERT INTO submission_feature_property_number(submission_feature_id,feature_type_property_id,value)
SELECT id,409,1.5 FROM generate_series(600,611) id;
INSERT INTO submission_feature_property_geometry(submission_feature_id,feature_type_property_id,value)
SELECT id,404,CASE id WHEN 608 THEN ST_MakePoint(-119,49) WHEN 609 THEN ST_MakePoint(-118,48)
 ELSE ST_MakePoint(-120,50) END FROM generate_series(600,611) id WHERE id<>607;
-- Presence indexes mirror the existing July 13 migration.
CREATE INDEX ON biohub.submission_feature_property_string(submission_feature_id,feature_type_property_id);
CREATE INDEX ON biohub.submission_feature_property_number(submission_feature_id,feature_type_property_id);
CREATE INDEX ON biohub.submission_feature_property_timestamp(submission_feature_id,feature_type_property_id);
CREATE INDEX ON biohub.submission_feature_property_geometry(submission_feature_id,feature_type_property_id);
CREATE INDEX ON biohub.submission_feature_property_taxon(submission_feature_id,feature_type_property_id);
CREATE INDEX ON biohub.submission_feature_property_code(submission_feature_id,feature_type_property_id);
ANALYZE;
