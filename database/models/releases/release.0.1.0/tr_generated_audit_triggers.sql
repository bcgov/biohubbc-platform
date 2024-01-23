 create trigger audit_submission_message before insert or update or delete on biohub.submission_message for each row execute procedure tr_audit_trigger();
 create trigger audit_system_constant before insert or update or delete on biohub.system_constant for each row execute procedure tr_audit_trigger();
 create trigger audit_submission_status before insert or update or delete on biohub.submission_status for each row execute procedure tr_audit_trigger();
 create trigger audit_submission_message_type before insert or update or delete on biohub.submission_message_type for each row execute procedure tr_audit_trigger();
 create trigger audit_submission_message_class before insert or update or delete on biohub.submission_message_class for each row execute procedure tr_audit_trigger();
 create trigger audit_submission_status_type before insert or update or delete on biohub.submission_status_type for each row execute procedure tr_audit_trigger();
 create trigger audit_system_metadata_constant before insert or update or delete on biohub.system_metadata_constant for each row execute procedure tr_audit_trigger();
 create trigger audit_system_user_role before insert or update or delete on biohub.system_user_role for each row execute procedure tr_audit_trigger();
 create trigger audit_system_role before insert or update or delete on biohub.system_role for each row execute procedure tr_audit_trigger();
 create trigger audit_submission before insert or update or delete on biohub.submission for each row execute procedure tr_audit_trigger();
 create trigger audit_occurrence before insert or update or delete on biohub.occurrence for each row execute procedure tr_audit_trigger();
 create trigger audit_user_identity_source before insert or update or delete on biohub.user_identity_source for each row execute procedure tr_audit_trigger();
 create trigger audit_system_user before insert or update or delete on biohub.system_user for each row execute procedure tr_audit_trigger();

