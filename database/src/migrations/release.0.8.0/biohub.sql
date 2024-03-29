-- 
-- TABLE: audit_log 
--

CREATE TABLE audit_log(
    audit_log_id      integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    system_user_id    integer           NOT NULL,
    create_date       timestamptz(6)    DEFAULT now() NOT NULL,
    table_name        varchar(200)      NOT NULL,
    operation         varchar(20)       NOT NULL,
    before_value      json,
    after_value       json,
    CONSTRAINT audit_log_pk PRIMARY KEY (audit_log_id)
);

COMMENT ON COLUMN audit_log.audit_log_id IS 'System generated surrogate primary key identifier.';
COMMENT ON COLUMN audit_log.system_user_id IS 'The system user id affecting the data change.';
COMMENT ON COLUMN audit_log.create_date IS 'The date and time of record creation.';
COMMENT ON COLUMN audit_log.table_name IS 'The table name of the data record.';
COMMENT ON COLUMN audit_log.operation IS 'The operation that affected the data change (ie. INSERT, UPDATE, DELETE, TRUNCATE).';
COMMENT ON COLUMN audit_log.before_value IS 'The JSON representation of the before value of the record.';
COMMENT ON COLUMN audit_log.after_value IS 'The JSON representation of the after value of the record.';
COMMENT ON TABLE audit_log IS 'Holds record level audit log data for the entire database.';

-- 
-- TABLE: submission 
--

CREATE TABLE submission(
    submission_id               integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    uuid                        uuid              NOT NULL,
    system_user_id              integer           NOT NULL,
    source_system               varchar(100)      NOT NULL,
    security_review_timestamp   timestamptz(6),
    publish_timestamp           timestamptz(6),
    submitted_timestamp         timestamptz(6)    DEFAULT now() NOT NULL,
    name                        varchar(200)      NOT NULL,
    description                 varchar(3000)     NOT NULL,
    comment                     varchar(3000)     NOT NULL,
    record_end_date             timestamptz(6)    DEFAULT now() NOT NULL,
    create_date                 timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                 integer           NOT NULL,
    update_date                 timestamptz(6),
    update_user                 integer,
    revision_count              integer           DEFAULT 0 NOT NULL,
    CONSTRAINT submission_pk PRIMARY KEY (submission_id)
);

COMMENT ON COLUMN submission.submission_id IS 'System generated surrogate primary key identifier.';
COMMENT ON COLUMN submission.uuid IS 'The globally unique identifier for this submission as supplied by the source system.';
COMMENT ON COLUMN submission.system_user_id IS 'Foreign key to the system_user table.';
COMMENT ON COLUMN submission.source_system IS 'The name of the submitting system.';
COMMENT ON COLUMN submission.security_review_timestamp IS 'The timestamp of when the security review of the submission was completed. Null indicates the security review has not been completed.';
COMMENT ON COLUMN submission.publish_timestamp IS 'The timestamp of when the submission is published (made public). Null indicates the submission is not publicly visible.';
COMMENT ON COLUMN submission.submitted_timestamp IS 'The timestamp of when the submission was received by BioHub from the source system.';
COMMENT ON COLUMN submission.name IS 'The name of the submission.';
COMMENT ON COLUMN submission.description IS 'The public description of the submission. Should not include any personal or sensitive information.';
COMMENT ON COLUMN submission.comment IS 'An internal comment/description about the submission for administrative purposes. May contain personal or sensitive information.';
COMMENT ON COLUMN submission.create_date IS 'The datetime the record was created.';
COMMENT ON COLUMN submission.create_user IS 'The id of the user who created the record as identified in the system user table.';
COMMENT ON COLUMN submission.update_date IS 'The datetime the record was updated.';
COMMENT ON COLUMN submission.update_user IS 'The id of the user who updated the record as identified in the system user table.';
COMMENT ON COLUMN submission.revision_count IS 'Revision count used for concurrency control.';
COMMENT ON TABLE submission IS 'Provides a listing of data submissions.';

-- 
-- TABLE: submission_job_queue 
--

CREATE TABLE submission_job_queue(
    submission_job_queue_id    integer           NOT NULL,
    submission_id              integer           NOT NULL,
    job_start_timestamp        timestamptz(6),
    job_end_timestamp          timestamptz(6),
    security_request           jsonb,
    key                        varchar(1000)     NOT NULL,
    attempt_count              integer           DEFAULT 0 NOT NULL,
    create_date                timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                integer           NOT NULL,
    update_date                timestamptz(6),
    update_user                integer,
    revision_count             integer           DEFAULT 0 NOT NULL,
    CONSTRAINT submission_job_queue_pk PRIMARY KEY (submission_job_queue_id)
);

COMMENT ON COLUMN submission_job_queue.submission_job_queue_id IS 'Surrogate primary key identifier. This value should be selected from the appropriate sequence and populated manually.';
COMMENT ON COLUMN submission_job_queue.submission_id IS 'Foreign key to the submission table.';
COMMENT ON COLUMN submission_job_queue.job_start_timestamp IS 'The timestamp of the job process instantiation.';
COMMENT ON COLUMN submission_job_queue.job_end_timestamp IS 'The timestamp of the job process completion.';
COMMENT ON COLUMN submission_job_queue.security_request IS 'A document supplied by the submitter outlining a security request for submission observations.';
COMMENT ON COLUMN submission_job_queue.key IS 'The identifying key to the file in the storage system.';
COMMENT ON COLUMN submission_job_queue.attempt_count IS 'The number of times this job queue record has been attempted.';
COMMENT ON COLUMN submission_job_queue.create_date IS 'The datetime the record was created.';
COMMENT ON COLUMN submission_job_queue.create_user IS 'The id of the user who created the record as identified in the system user table.';
COMMENT ON COLUMN submission_job_queue.update_date IS 'The datetime the record was updated.';
COMMENT ON COLUMN submission_job_queue.update_user IS 'The id of the user who updated the record as identified in the system user table.';
COMMENT ON COLUMN submission_job_queue.revision_count IS 'Revision count used for concurrency control.';
COMMENT ON TABLE submission_job_queue IS 'A listing of data submission job processes and their details including start and end times.';

-- 
-- TABLE: system_constant 
--

CREATE TABLE system_constant(
    system_constant_id    integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    constant_name         varchar(50)       NOT NULL,
    character_value       varchar(300),
    numeric_value         numeric(10, 0),
    description           varchar(250),
    create_date           timestamptz(6)    DEFAULT now() NOT NULL,
    create_user           integer           NOT NULL,
    update_date           timestamptz(6),
    update_user           integer,
    revision_count        integer           DEFAULT 0 NOT NULL,
    CONSTRAINT system_constant_pk PRIMARY KEY (system_constant_id)
);

COMMENT ON COLUMN system_constant.system_constant_id IS 'System generated surrogate primary key identifier.';
COMMENT ON COLUMN system_constant.constant_name IS 'The lookup name of the constant.';
COMMENT ON COLUMN system_constant.character_value IS 'The string value of the constant.';
COMMENT ON COLUMN system_constant.numeric_value IS 'The numeric value of the constant.';
COMMENT ON COLUMN system_constant.description IS 'The description of the record.';
COMMENT ON COLUMN system_constant.create_date IS 'The datetime the record was created.';
COMMENT ON COLUMN system_constant.create_user IS 'The id of the user who created the record as identified in the system user table.';
COMMENT ON COLUMN system_constant.update_date IS 'The datetime the record was updated.';
COMMENT ON COLUMN system_constant.update_user IS 'The id of the user who updated the record as identified in the system user table.';
COMMENT ON COLUMN system_constant.revision_count IS 'Revision count used for concurrency control.';
COMMENT ON TABLE system_constant IS 'A list of system constants necessary for system functionality. Such constants are not editable by system administrators as they are used by internal logic.';

-- 
-- TABLE: system_metadata_constant 
--

CREATE TABLE system_metadata_constant(
    system_metadata_constant_id    integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    constant_name                  varchar(50)       NOT NULL,
    character_value                varchar(300),
    numeric_value                  numeric(10, 0),
    description                    varchar(250),
    create_date                    timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                    integer           NOT NULL,
    update_date                    timestamptz(6),
    update_user                    integer,
    revision_count                 integer           DEFAULT 0 NOT NULL,
    CONSTRAINT system_metadata_constant_pk PRIMARY KEY (system_metadata_constant_id)
);

COMMENT ON COLUMN system_metadata_constant.system_metadata_constant_id IS 'System generated surrogate primary key identifier.';
COMMENT ON COLUMN system_metadata_constant.constant_name IS 'The lookup name of the constant.';
COMMENT ON COLUMN system_metadata_constant.character_value IS 'The string value of the constant.';
COMMENT ON COLUMN system_metadata_constant.numeric_value IS 'The numeric value of the constant.';
COMMENT ON COLUMN system_metadata_constant.description IS 'The description of the record.';
COMMENT ON COLUMN system_metadata_constant.create_date IS 'The datetime the record was created.';
COMMENT ON COLUMN system_metadata_constant.create_user IS 'The id of the user who created the record as identified in the system user table.';
COMMENT ON COLUMN system_metadata_constant.update_date IS 'The datetime the record was updated.';
COMMENT ON COLUMN system_metadata_constant.update_user IS 'The id of the user who updated the record as identified in the system user table.';
COMMENT ON COLUMN system_metadata_constant.revision_count IS 'Revision count used for concurrency control.';
COMMENT ON TABLE system_metadata_constant IS 'A list of system metadata constants associated with the business. Such constants are editable by system administrators and are used when publishing data.';

-- 
-- TABLE: system_role 
--

CREATE TABLE system_role(
    system_role_id           integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    name                     varchar(50)       NOT NULL,
    record_effective_date    timestamptz(6)    DEFAULT now() NOT NULL,
    record_end_date          timestamptz(6),
    description              varchar(250)      NOT NULL,
    notes                    varchar(3000),
    create_date              timestamptz(6)    DEFAULT now() NOT NULL,
    create_user              integer           NOT NULL,
    update_date              timestamptz(6),
    update_user              integer,
    revision_count           integer           DEFAULT 0 NOT NULL,
    CONSTRAINT system_role_pk PRIMARY KEY (system_role_id)
);

COMMENT ON COLUMN system_role.system_role_id IS 'System generated surrogate primary key identifier.';
COMMENT ON COLUMN system_role.name IS 'The name of the record.';
COMMENT ON COLUMN system_role.record_effective_date IS 'Record level effective date.';
COMMENT ON COLUMN system_role.record_end_date IS 'Record level end date.';
COMMENT ON COLUMN system_role.description IS 'The description of the record.';
COMMENT ON COLUMN system_role.notes IS 'Notes associated with the record.';
COMMENT ON COLUMN system_role.create_date IS 'The datetime the record was created.';
COMMENT ON COLUMN system_role.create_user IS 'The id of the user who created the record as identified in the system user table.';
COMMENT ON COLUMN system_role.update_date IS 'The datetime the record was updated.';
COMMENT ON COLUMN system_role.update_user IS 'The id of the user who updated the record as identified in the system user table.';
COMMENT ON COLUMN system_role.revision_count IS 'Revision count used for concurrency control.';
COMMENT ON TABLE system_role IS 'Agency or Ministry funding the project.';

-- 
-- TABLE: system_user 
--

CREATE TABLE system_user(
    system_user_id             integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    user_identity_source_id    integer           NOT NULL,
    user_identifier            varchar(200)      NOT NULL,
    user_guid                  varchar(200)      NOT NULL,
    record_effective_date      timestamptz(6)    DEFAULT now() NOT NULL,
    record_end_date            timestamptz(6),
    create_date                timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                integer           NOT NULL,
    update_date                timestamptz(6),
    update_user                integer,
    revision_count             integer           DEFAULT 0 NOT NULL,
    CONSTRAINT system_user_pk PRIMARY KEY (system_user_id)
);

COMMENT ON COLUMN system_user.system_user_id IS 'System generated surrogate primary key identifier.';
COMMENT ON COLUMN system_user.user_identity_source_id IS 'System generated surrogate primary key identifier.';
COMMENT ON COLUMN system_user.user_identifier IS 'The identifier of the user.';
COMMENT ON COLUMN system_user.record_effective_date IS 'Record level effective date.';
COMMENT ON COLUMN system_user.record_end_date IS 'Record level end date.';
COMMENT ON COLUMN system_user.create_date IS 'The datetime the record was created.';
COMMENT ON COLUMN system_user.create_user IS 'The id of the user who created the record as identified in the system user table.';
COMMENT ON COLUMN system_user.update_date IS 'The datetime the record was updated.';
COMMENT ON COLUMN system_user.update_user IS 'The id of the user who updated the record as identified in the system user table.';
COMMENT ON COLUMN system_user.revision_count IS 'Revision count used for concurrency control.';
COMMENT ON TABLE system_user IS 'Agency or Ministry funding the project.';

-- 
-- TABLE: system_user_role 
--

CREATE TABLE system_user_role(
    system_user_role_id    integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    system_user_id         integer           NOT NULL,
    system_role_id         integer           NOT NULL,
    create_date            timestamptz(6)    DEFAULT now() NOT NULL,
    create_user            integer           NOT NULL,
    update_date            timestamptz(6),
    update_user            integer,
    revision_count         integer           DEFAULT 0 NOT NULL,
    CONSTRAINT system_user_role_pk PRIMARY KEY (system_user_role_id)
);

COMMENT ON COLUMN system_user_role.system_user_role_id IS 'System generated surrogate primary key identifier.';
COMMENT ON COLUMN system_user_role.system_user_id IS 'System generated surrogate primary key identifier.';
COMMENT ON COLUMN system_user_role.system_role_id IS 'System generated surrogate primary key identifier.';
COMMENT ON COLUMN system_user_role.create_date IS 'The datetime the record was created.';
COMMENT ON COLUMN system_user_role.create_user IS 'The id of the user who created the record as identified in the system user table.';
COMMENT ON COLUMN system_user_role.update_date IS 'The datetime the record was updated.';
COMMENT ON COLUMN system_user_role.update_user IS 'The id of the user who updated the record as identified in the system user table.';
COMMENT ON COLUMN system_user_role.revision_count IS 'Revision count used for concurrency control.';
COMMENT ON TABLE system_user_role IS 'A associative entity that joins system users and system role types.';

-- 
-- TABLE: user_identity_source 
--

CREATE TABLE user_identity_source(
    user_identity_source_id    integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    name                       varchar(50)       NOT NULL,
    record_effective_date      timestamptz(6)    DEFAULT now() NOT NULL,
    record_end_date            timestamptz(6),
    description                varchar(250),
    notes                      varchar(3000),
    create_date                timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                integer           NOT NULL,
    update_date                timestamptz(6),
    update_user                integer,
    revision_count             integer           DEFAULT 0 NOT NULL,
    CONSTRAINT user_identity_source_pk PRIMARY KEY (user_identity_source_id)
);

COMMENT ON COLUMN user_identity_source.user_identity_source_id IS 'System generated surrogate primary key identifier.';
COMMENT ON COLUMN user_identity_source.name IS 'The name of the record.';
COMMENT ON COLUMN user_identity_source.record_effective_date IS 'Record level effective date.';
COMMENT ON COLUMN user_identity_source.record_end_date IS 'Record level end date.';
COMMENT ON COLUMN user_identity_source.description IS 'The description of the record.';
COMMENT ON COLUMN user_identity_source.notes IS 'Notes associated with the record.';
COMMENT ON COLUMN user_identity_source.create_date IS 'The datetime the record was created.';
COMMENT ON COLUMN user_identity_source.create_user IS 'The id of the user who created the record as identified in the system user table.';
COMMENT ON COLUMN user_identity_source.update_date IS 'The datetime the record was updated.';
COMMENT ON COLUMN user_identity_source.update_user IS 'The id of the user who updated the record as identified in the system user table.';
COMMENT ON COLUMN user_identity_source.revision_count IS 'Revision count used for concurrency control.';
COMMENT ON TABLE user_identity_source IS 'The source of the user identifier. This source is traditionally the system that authenticates the user. Example sources could include IDIR, BCEID and DATABASE.';

-- 
-- TABLE: submission 
--

ALTER TABLE submission ADD CONSTRAINT submission_fk1
    FOREIGN KEY (system_user_id)
    REFERENCES system_user(system_user_id);

CREATE INDEX submission_idx1 ON submission(system_user_id);

-- 
-- TABLE: submission_job_queue
--

ALTER TABLE submission_job_queue ADD CONSTRAINT submission_job_queue_fk1
    FOREIGN KEY (submission_id)
    REFERENCES submission(submission_id);


CREATE INDEX submission_job_queue_idx1 ON submission_job_queue(submission_id);

-- 
-- TABLE: system_constant
--

CREATE UNIQUE INDEX system_constant_uk1 ON system_constant(constant_name);

-- 
-- TABLE: system_metadata_constant 
--

CREATE UNIQUE INDEX system_metadata_constant_uk1 ON system_metadata_constant(constant_name);

-- 
-- TABLE: system_role
--

CREATE UNIQUE INDEX system_role_nuk1 ON system_role(name, (record_end_date is NULL)) where record_end_date is null;

-- 
-- TABLE: system_user 
--

ALTER TABLE system_user ADD CONSTRAINT system_user_fk1
    FOREIGN KEY (user_identity_source_id)
    REFERENCES user_identity_source(user_identity_source_id);

CREATE UNIQUE INDEX system_user_nuk1 ON system_user(user_identifier, user_identity_source_id, (record_end_date is NULL)) where record_end_date is null;

CREATE INDEX system_user_id_idx1 ON system_user(user_identity_source_id);

-- 
-- TABLE: system_user_role 
--

ALTER TABLE system_user_role ADD CONSTRAINT system_user_role_fk1
    FOREIGN KEY (system_user_id)
    REFERENCES system_user(system_user_id);

ALTER TABLE system_user_role ADD CONSTRAINT system_user_role_fk2
    FOREIGN KEY (system_role_id)
    REFERENCES system_role(system_role_id);

CREATE UNIQUE INDEX system_user_role_uk1 ON system_user_role(system_user_id, system_role_id);

CREATE INDEX system_user_role_idx1 ON system_user_role(system_user_id);

CREATE INDEX system_user_role_idx2 ON system_user_role(system_role_id);

-- 
-- TABLE: user_identity_source
--

CREATE UNIQUE INDEX user_identity_source_nuk1 ON user_identity_source(name, (record_end_date is NULL)) where record_end_date is null;
