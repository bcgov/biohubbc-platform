-- run as db super user
-- smoketest_release.0.1.0.sql
\c biohub
set role postgres;
set search_path=biohub;

do $$
declare
  _count integer = 0;
  _system_user system_user%rowtype;
  _system_user_id system_user.system_user_id%type;
begin
  select * into _system_user from system_user where user_identifier = 'myIDIR';
  if _system_user.system_user_id is not null then
    delete from system_user_role where system_user_id = _system_user.system_user_id;
    delete from system_user where system_user_id = _system_user.system_user_id;
  end if;

  insert into system_user (user_identity_source_id, user_identifier, record_effective_date) values ((select user_identity_source_id from user_identity_source where name = 'IDIR' and record_end_date is null), 'myIDIR', now()) returning system_user_id into _system_user_id;
  insert into system_user_role (system_user_id, system_role_id) values (_system_user_id, (select system_role_id from system_role where name =  'System Administrator'));

  select count(1) into _count from system_user;
  assert _count > 1, 'FAIL system_user';
  select count(1) into _count from audit_log;
  assert _count > 1, 'FAIL audit_log';

  -- drop security context for subsequent roles to instantiate
  drop table biohub_context_temp;

  raise notice 'smoketest_release(1): PASS';
end
$$;

set role biohub_api;
set search_path to biohub_dapi_v1, biohub, public, topology;
do $$
declare
  _count integer = 0;
  _system_user_id system_user.system_user_id%type;
  _submission_id submission.submission_id%type;
  _submission_status_id submission_status.submission_status_id%type;
  _geography occurrence.geography%type;
begin
  -- set security context
  select api_set_context('myIDIR', 'IDIR') into _system_user_id;
  --select api_set_context('biohub_api', 'DATABASE') into _system_user_id;

  select st_GeomFromEWKT('SRID=4326;POINT(-123.920288 48.592142)') into _geography;

  -- occurrence
  -- occurrence submission 1
  insert into submission (source, event_timestamp) values ('BIOHUB', now()-interval '1 day') returning submission_id into _submission_id;
  select count(1) into _count from submission;
  assert _count = 1, 'FAIL submission';
  insert into occurrence (submission_id, taxonid, lifestage, eventdate, sex) values (_submission_id, 'M-ALAL', 'Adult', now()-interval '10 day', 'male');
  select count(1) into _count from occurrence;
  assert _count = 1, 'FAIL occurrence';
  insert into submission_status (submission_id, submission_status_type_id, event_timestamp) values (_submission_id, (select submission_status_type_id from submission_status_type where name = 'Submitted'), now()-interval '1 day') returning submission_status_id into _submission_status_id;
  -- transpose comments on next three lines to test deletion of published surveys by system administrator
  insert into submission_status (submission_id, submission_status_type_id, event_timestamp) values (_submission_id, (select submission_status_type_id from submission_status_type where name = 'Awaiting Curration'), now()-interval '1 day') returning submission_status_id into _submission_status_id;
  insert into submission_status (submission_id, submission_status_type_id, event_timestamp) values (_submission_id, (select submission_status_type_id from submission_status_type where name = 'Published'), now()-interval '1 day') returning submission_status_id into _submission_status_id;
  --insert into system_user_role (system_user_id, system_role_id) values (_system_user_id, (select system_role_id from system_role where name = 'System Administrator'));
  
  -- occurrence submission 2
  insert into submission (source, event_timestamp) values ('BIOHUB', now()) returning submission_id into _submission_id;
  select count(1) into _count from submission;
  assert _count = 2, 'FAIL submission';
  insert into occurrence (submission_id, taxonid, lifestage, eventdate, sex) values (_submission_id, 'M-ALAL', 'Adult', now()-interval '5 day', 'female');
  select count(1) into _count from occurrence;
  assert _count = 2, 'FAIL occurrence';
  insert into submission_status (submission_id, submission_status_type_id, event_timestamp) values (_submission_id, (select submission_status_type_id from submission_status_type where name = 'Submitted'), now()) returning submission_status_id into _submission_status_id;
  insert into submission_status (submission_id, submission_status_type_id, event_timestamp) values (_submission_id, (select submission_status_type_id from submission_status_type where name = 'Rejected'), now()) returning submission_status_id into _submission_status_id;
  insert into submission_message (submission_status_id, submission_message_type_id, event_timestamp, message) values (_submission_status_id, (select submission_message_type_id from submission_message_type where name = 'Missing Required Field'), now(), 'Some required field was not supplied.');
  select count(1) into _count from submission_status;
  assert _count = 5, 'FAIL submission_status';
  select count(1) into _count from submission_message;
  assert _count = 1, 'FAIL submission_message';  

  raise notice 'smoketest_release(2): PASS';
end
$$;
