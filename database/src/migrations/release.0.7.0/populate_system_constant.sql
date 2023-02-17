-- populate_system_constant.sql

-- common constants
insert into system_constant (constant_name, character_value, description) values ('DATA_NOT_PROVIDED_MESSAGE', 'Not provided', 'A message to insert as appropriate where some data standard defines the data as required but that data is not available.');
-- ISO 8601 date format strings
insert into system_constant (constant_name, character_value, description) values ('ISO_8601_DATE_FORMAT_WITH_TIMEZONE', 'YYYY-MM-DD"T"HH24:MI:SS"Z"', 'The ISO 8601 dae format string for timezone.');
insert into system_constant (constant_name, character_value, description) values ('ISO_8601_DATE_FORMAT_WITHOUT_TIME_TIMEZONE', 'YYYY-MM-DD', 'The ISO 8601 dae format string without time or timezone.');
-- system roles
insert into system_constant (constant_name, character_value, description) values ('SYSTEM_ROLES_SYSTEM_ADMINISTRATOR', 'System Administrator', 'The system role name that defines a system administrator role.');
-- job queue
insert into system_constant (constant_name, character_value, description) values ('JOB_QUEUE_ENABLED', 'true', 'Controls whether or not the job queue scheduler is enabled. Set to "true" to enable the job queue schdulerF, "false" to disable it.');
insert into system_constant (constant_name, numeric_value,   description) values ('JOB_QUEUE_CONCURRENCY', 4, 'The number of job queue processes that can run concurrently (integer > 0).');
insert into system_constant (constant_name, numeric_value,   description) values ('JOB_QUEUE_PERIOD', 5000, 'The frequency with which the job queue scheduler will check for new job queue records (milliseconds).');
insert into system_constant (constant_name, numeric_value,   description) values ('JOB_QUEUE_ATTEMPTS', 2, 'The total number of times a job will be attempted until it finishes successfully (integer >= 1).');
insert into system_constant (constant_name, numeric_value,   description) values ('JOB_QUEUE_TIMEOUT', 60000, 'The maximum duration a running job can take before it is considered timed out (milliseconds).');