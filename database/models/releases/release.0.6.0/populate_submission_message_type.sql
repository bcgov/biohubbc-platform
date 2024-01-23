-- populate_submission_message_type.sql

-- term related
insert into submission_message_type (name, record_effective_date, description, submission_message_class_id) values ('Notice', now(), 'Notice', (select submission_message_class_id from submission_message_class where name = 'Class'));
insert into submission_message_type (name, record_effective_date, description, submission_message_class_id) values ('Error', now(), 'An error has occurred', (select submission_message_class_id from submission_message_class where name = 'Class'));
insert into submission_message_type (name, record_effective_date, description, submission_message_class_id) values ('Warning', now(), 'A warning has occurred', (select submission_message_class_id from submission_message_class where name = 'Class'));
insert into submission_message_type (name, record_effective_date, description, submission_message_class_id) values ('Debug', now(), 'A debug information', (select submission_message_class_id from submission_message_class where name = 'Class'));

