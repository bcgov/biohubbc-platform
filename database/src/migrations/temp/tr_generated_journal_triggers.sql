 create trigger journal_administrative_activity_status_type after insert or update or delete on biohub.administrative_activity_status_type for each row execute procedure tr_journal_trigger();
 create trigger journal_system_constant after insert or update or delete on biohub.system_constant for each row execute procedure tr_journal_trigger();
 create trigger journal_system_metadata_constant after insert or update or delete on biohub.system_metadata_constant for each row execute procedure tr_journal_trigger();
 create trigger journal_system_user_role after insert or update or delete on biohub.system_user_role for each row execute procedure tr_journal_trigger();
 create trigger journal_system_role after insert or update or delete on biohub.system_role for each row execute procedure tr_journal_trigger();
 create trigger journal_system_user after insert or update or delete on biohub.system_user for each row execute procedure tr_journal_trigger();
 create trigger journal_administrative_activity after insert or update or delete on biohub.administrative_activity for each row execute procedure tr_journal_trigger();
 create trigger journal_administrative_activity_type after insert or update or delete on biohub.administrative_activity_type for each row execute procedure tr_journal_trigger();
 create trigger journal_user_identity_source after insert or update or delete on biohub.user_identity_source for each row execute procedure tr_journal_trigger();

