-- populate_system_constant.sql

-- common constants
insert into system_constant (constant_name, character_value, description) values ('DATA_NOT_PROVIDED_MESSAGE', 'Not provided', 'A message to insert as appropriate where some data standard defines the data as required but that data is not available.');
-- ISO 8601 date format strings
insert into system_constant (constant_name, character_value, description) values ('ISO_8601_DATE_FORMAT_WITH_TIMEZONE', 'YYYY-MM-DD"T"HH24:MI:SS"Z"', 'The ISO 8601 dae format string for timezone.');
insert into system_constant (constant_name, character_value, description) values ('ISO_8601_DATE_FORMAT_WITHOUT_TIME_TIMEZONE', 'YYYY-MM-DD', 'The ISO 8601 dae format string without time or timezone.');
-- system roles
insert into system_constant (constant_name, character_value, description) values ('SYSTEM_ROLES_SYSTEM_ADMINISTRATOR', 'System Administrator', 'The system role name that defines a system administrator role.');