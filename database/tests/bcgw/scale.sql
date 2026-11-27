-- Optional deterministic scale fixture, applied before any views are built.
-- 2,000 site-linked observations and 1,000 telemetry fixes with two matching animals.
INSERT INTO biohub.submission_feature(submission_feature_id,feature_type_id,parent_submission_feature_id,data)
SELECT 10000+i,1,NULL,sf.data FROM generate_series(1,2000) i CROSS JOIN biohub.submission_feature sf WHERE sf.submission_feature_id=1;
INSERT INTO biohub.submission_feature(submission_feature_id,feature_type_id,parent_submission_feature_id,data)
SELECT 20000+i,4,500,sf.data FROM generate_series(1,1000) i CROSS JOIN biohub.submission_feature sf WHERE sf.submission_feature_id=600;
INSERT INTO biohub.submission_feature_closure
SELECT submission_feature_id,submission_feature_id,true FROM biohub.submission_feature WHERE submission_feature_id>10000;
INSERT INTO biohub.submission_feature_closure SELECT 10000+i,100,true FROM generate_series(1,2000) i;
INSERT INTO biohub.submission_feature_property_number(submission_feature_id,feature_type_property_id,value)
SELECT 10000+i,feature_type_property_id,value FROM generate_series(1,2000) i CROSS JOIN biohub.submission_feature_property_number WHERE submission_feature_id=1;
INSERT INTO biohub.submission_feature_property_string(submission_feature_id,feature_type_property_id,value)
SELECT 10000+i,feature_type_property_id,value FROM generate_series(1,2000) i CROSS JOIN biohub.submission_feature_property_string WHERE submission_feature_id=1;
INSERT INTO biohub.submission_feature_property_code(submission_feature_id,feature_type_property_id,contributor_codeset_code_id)
SELECT 10000+i,feature_type_property_id,contributor_codeset_code_id FROM generate_series(1,2000) i CROSS JOIN biohub.submission_feature_property_code WHERE submission_feature_id=1;
INSERT INTO biohub.submission_feature_property_taxon(submission_feature_id,feature_type_property_id,taxon_id)
SELECT 10000+i,feature_type_property_id,taxon_id FROM generate_series(1,2000) i CROSS JOIN biohub.submission_feature_property_taxon WHERE submission_feature_id=1;
INSERT INTO biohub.submission_feature_property_timestamp(submission_feature_id,feature_type_property_id,date_value,time_value)
SELECT 10000+i,feature_type_property_id,date_value,time_value FROM generate_series(1,2000) i CROSS JOIN biohub.submission_feature_property_timestamp WHERE submission_feature_id=1;
INSERT INTO biohub.submission_feature_property_timestamp(submission_feature_id,feature_type_property_id,date_value,time_value)
SELECT 20000+i,feature_type_property_id,date_value,time_value FROM generate_series(1,1000) i CROSS JOIN biohub.submission_feature_property_timestamp WHERE submission_feature_id=600;
INSERT INTO biohub.submission_feature_property_geometry(submission_feature_id,feature_type_property_id,value)
SELECT 20000+i,feature_type_property_id,value FROM generate_series(1,1000) i CROSS JOIN biohub.submission_feature_property_geometry WHERE submission_feature_id=600;
INSERT INTO biohub.submission_feature_property_number(submission_feature_id,feature_type_property_id,value)
SELECT 20000+i,feature_type_property_id,value FROM generate_series(1,1000) i CROSS JOIN biohub.submission_feature_property_number WHERE submission_feature_id=600;
ANALYZE;
