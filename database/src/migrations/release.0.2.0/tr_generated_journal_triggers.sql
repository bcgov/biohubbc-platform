 create trigger journal_source_transform after insert or update or delete on biohub.source_transform for each row execute procedure tr_journal_trigger();
 create trigger journal_submission_message_type after insert or update or delete on biohub.submission_message_type for each row execute procedure tr_journal_trigger();
 create trigger journal_submission_message_class after insert or update or delete on biohub.submission_message_class for each row execute procedure tr_journal_trigger();
 create trigger journal_submission_status_type after insert or update or delete on biohub.submission_status_type for each row execute procedure tr_journal_trigger();
 create trigger journal_system_constant after insert or update or delete on biohub.system_constant for each row execute procedure tr_journal_trigger();
 create trigger journal_system_metadata_constant after insert or update or delete on biohub.system_metadata_constant for each row execute procedure tr_journal_trigger();
 create trigger journal_system_user_role after insert or update or delete on biohub.system_user_role for each row execute procedure tr_journal_trigger();
 create trigger journal_user_identity_source after insert or update or delete on biohub.user_identity_source for each row execute procedure tr_journal_trigger();
 create trigger journal_system_role after insert or update or delete on biohub.system_role for each row execute procedure tr_journal_trigger();
 create trigger journal_submission after insert or update or delete on biohub.submission for each row execute procedure tr_journal_trigger();
 create trigger journal_occurrence after insert or update or delete on biohub.occurrence for each row execute procedure tr_journal_trigger();
 create trigger journal_system_user after insert or update or delete on biohub.system_user for each row execute procedure tr_journal_trigger();
 create trigger journal_submission_status after insert or update or delete on biohub.submission_status for each row execute procedure tr_journal_trigger();
 create trigger journal_submission_message after insert or update or delete on biohub.submission_message for each row execute procedure tr_journal_trigger();

