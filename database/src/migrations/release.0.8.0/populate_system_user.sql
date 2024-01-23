-- populate_system_user.sql

insert into system_user (user_identity_source_id, user_identifier, user_guid, record_effective_date, create_date, create_user)
  values ((select user_identity_source_id from user_identity_source where name = 'DATABASE' and record_end_date is null), 'postgres', 'postgres', now(), now(), 1);

insert into system_user (user_identity_source_id, user_identifier, user_guid,record_effective_date, create_date, create_user)
  values ((select user_identity_source_id from user_identity_source where name = 'DATABASE' and record_end_date is null), 'biohub_api', 'biohub_api', now(), now(), 1);

insert into system_user (user_identity_source_id, user_identifier, user_guid, record_effective_date, create_date, create_user)
  values ((select user_identity_source_id from user_identity_source where name = 'SYSTEM' and record_end_date is null), 'SIMS', 'service-account-sims-svc-4464', now(), now(), 1);
