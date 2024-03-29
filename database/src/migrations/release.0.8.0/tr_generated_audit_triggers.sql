create trigger audit_submission before insert or update or delete on biohub.submission for each row execute procedure tr_audit_trigger();
create trigger audit_system_user before insert or update or delete on biohub.system_user for each row execute procedure tr_audit_trigger();
create trigger audit_system_constant before insert or update or delete on biohub.system_constant for each row execute procedure tr_audit_trigger();
create trigger audit_system_metadata_constant before insert or update or delete on biohub.system_metadata_constant for each row execute procedure tr_audit_trigger();
create trigger audit_system_user_role before insert or update or delete on biohub.system_user_role for each row execute procedure tr_audit_trigger();
create trigger audit_system_role before insert or update or delete on biohub.system_role for each row execute procedure tr_audit_trigger();
create trigger audit_submission_job_queue before insert or update or delete on biohub.submission_job_queue for each row execute procedure tr_audit_trigger();
create trigger audit_user_identity_source before insert or update or delete on biohub.user_identity_source for each row execute procedure tr_audit_trigger();
