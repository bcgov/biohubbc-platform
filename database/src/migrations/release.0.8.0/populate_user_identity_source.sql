-- populate_user_identity_source.sql
delete from system_user;
delete from user_identity_source;

insert into user_identity_source(name, record_effective_date, description, create_date, create_user) values ('DATABASE', now(), 'A machine user for internal use only.', now(), 1);
insert into user_identity_source(name, record_effective_date, description, create_date, create_user) values ('IDIR', now(), 'A human user who authenticates via IDIR.', now(), 1);
insert into user_identity_source(name, record_effective_date, description, create_date, create_user) values ('BCEIDBASIC', now(), 'A human user who authenticates via BCEID BASIC.', now(), 1);
insert into user_identity_source(name, record_effective_date, description, create_date, create_user) values ('BCEIDBUSINESS', now(), 'A human user who authenticates via BCEID BUSINESS.', now(), 1);
insert into user_identity_source(name, record_effective_date, description, create_date, create_user) values ('SYSTEM', now(), 'A machine user for external platform applications who authenticate via Keycloak Service Client.', now(), 1);

insert into system_user (user_identity_source_id, user_identifier, user_guid, record_effective_date, create_date, create_user)
  values ((select user_identity_source_id from user_identity_source where name = 'DATABASE' and record_end_date is null), 'postgres', 'postgres', now(), now(), 1);

insert into system_user (user_identity_source_id, user_identifier, user_guid,record_effective_date, create_date, create_user)
  values ((select user_identity_source_id from user_identity_source where name = 'DATABASE' and record_end_date is null), 'biohub_api', 'biohub_api', now(), now(), 1);

insert into system_user (user_identity_source_id, user_identifier, user_guid, record_effective_date, create_date, create_user)
  values ((select user_identity_source_id from user_identity_source where name = 'SYSTEM' and record_end_date is null), 'SIMS', 'service-account-sims-svc-4464', now(), now(), 1);
