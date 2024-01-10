-- populate_user_identity_source.sql
insert into user_identity_source(name, record_effective_date, description, create_date, create_user) values ('DATABASE', now(), 'A machine user for internal use only.', now(), 1);
insert into user_identity_source(name, record_effective_date, description, create_date, create_user) values ('IDIR', now(), 'A human user who authenticates via IDIR.', now(), 1);
insert into user_identity_source(name, record_effective_date, description, create_date, create_user) values ('BCEIDBASIC', now(), 'A human user who authenticates via BCEID BASIC.', now(), 1);
insert into user_identity_source(name, record_effective_date, description, create_date, create_user) values ('BCEIDBUSINESS', now(), 'A human user who authenticates via BCEID BUSINESS.', now(), 1);
insert into user_identity_source(name, record_effective_date, description, create_date, create_user) values ('SYSTEM', now(), 'A machine user for external platform applications who authenticate via Keycloak Service Client.', now(), 1);
