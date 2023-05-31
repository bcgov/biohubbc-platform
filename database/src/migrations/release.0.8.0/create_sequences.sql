-- create_sequences.sql

create sequence if not exists artifact_seq;
grant usage, select on sequence artifact_seq to biohub_api;
create sequence if not exists submission_job_queue_seq;
grant usage, select on sequence submission_job_queue_seq to biohub_api;