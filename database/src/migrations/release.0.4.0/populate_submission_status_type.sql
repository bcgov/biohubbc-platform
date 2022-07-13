-- populate_submission_status_type.sql

insert into submission_status_type (name, record_effective_date, description) values ('Published', now(), 'The submission has been publised.');
insert into submission_status_type (name, record_effective_date, description) values ('Rejected', now(), 'The submission has been rejected.');
insert into submission_status_type (name, record_effective_date, description) values ('Out Dated Record', now(), 'Submission record has been updated to new record');
insert into submission_status_type (name, record_effective_date, description) values ('Ingested', now(), 'Submission data ingested');
insert into submission_status_type (name, record_effective_date, description) values ('Uploaded', now(), 'Submission data uploaded to S3');
insert into submission_status_type (name, record_effective_date, description) values ('Validated', now(), 'Submission data validated');
insert into submission_status_type (name, record_effective_date, description) values ('Secured', now(), 'Submission data secured');
insert into submission_status_type (name, record_effective_date, description) values ('EML Ingested', now(), 'Submission EML ingested');
insert into submission_status_type (name, record_effective_date, description) values ('EML To JSON', now(), 'EML transformed to JSON');
insert into submission_status_type (name, record_effective_date, description) values ('Metadata To ES', now(), 'Metadata uploaded to ES');
insert into submission_status_type (name, record_effective_date, description) values ('Normalized', now(), 'Submission data normalized');
insert into submission_status_type (name, record_effective_date, description) values ('Spatial Transform Unsecure', now(), 'Transformed unsecure spatial data');
insert into submission_status_type (name, record_effective_date, description) values ('Spatial Transform Secure', now(), 'Transformed secure spatial data');
insert into submission_status_type (name, record_effective_date, description) values ('Failed Ingestion', now(), 'Submission data failed to ingest');
insert into submission_status_type (name, record_effective_date, description) values ('Failed Upload', now(), 'Submission data failed to upload to S3');
insert into submission_status_type (name, record_effective_date, description) values ('Failed Validation', now(), 'Submission data failed to validate');
insert into submission_status_type (name, record_effective_date, description) values ('Failed Security', now(), 'Submission data failed secure');
insert into submission_status_type (name, record_effective_date, description) values ('Failed EML Ingestion', now(), 'Submission EML failed to ingest');
insert into submission_status_type (name, record_effective_date, description) values ('Failed EML To JSON', now(), 'EML transform to JSON failed');
insert into submission_status_type (name, record_effective_date, description) values ('Failed Metadata To ES', now(), 'Metadata failed to upload');
insert into submission_status_type (name, record_effective_date, description) values ('Failed Normalization', now(), 'Submission data failed to normalize');
insert into submission_status_type (name, record_effective_date, description) values ('Failed Spatial Transform Unsecure', now(), 'Transform failed on unsecure spatial data');
insert into submission_status_type (name, record_effective_date, description) values ('Failed Spatial Transform Secure', now(), 'Transform failed on secure spatial data');
