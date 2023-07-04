-- populate_system_role.sql
insert into system_role (name, record_effective_date, description) values ('System Administrator', now(), '');
insert into system_role (name, record_effective_date, description) values ('Creator', now(), '');
insert into system_role (name, record_effective_date, description) values ('Data Administrator', now(), '');
