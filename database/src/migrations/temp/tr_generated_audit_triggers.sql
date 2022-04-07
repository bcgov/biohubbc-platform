 create trigger audit_administrative_activity_status_type before insert or update or delete on biohub.administrative_activity_status_type for each row execute procedure tr_audit_trigger();
 create trigger audit_system_constant before insert or update or delete on biohub.system_constant for each row execute procedure tr_audit_trigger();
 create trigger audit_system_metadata_constant before insert or update or delete on biohub.system_metadata_constant for each row execute procedure tr_audit_trigger();
 create trigger audit_system_user_role before insert or update or delete on biohub.system_user_role for each row execute procedure tr_audit_trigger();
 create trigger audit_system_role before insert or update or delete on biohub.system_role for each row execute procedure tr_audit_trigger();
 create trigger audit_system_user before insert or update or delete on biohub.system_user for each row execute procedure tr_audit_trigger();
 create trigger audit_administrative_activity before insert or update or delete on biohub.administrative_activity for each row execute procedure tr_audit_trigger();
 create trigger audit_administrative_activity_type before insert or update or delete on biohub.administrative_activity_type for each row execute procedure tr_audit_trigger();
 create trigger audit_user_identity_source before insert or update or delete on biohub.user_identity_source for each row execute procedure tr_audit_trigger();

