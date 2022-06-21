--
-- ER/Studio Data Architect SQL Code Generation
-- Project :      BioHub.DM1
--
<<<<<<< HEAD:database/src/migrations/release.0.3.0/biohub.sql
-- Date Created : Tuesday, June 14, 2022 10:50:21
=======
-- Date Created : Thursday, June 09, 2022 14:41:01
>>>>>>> origin:database/src/migrations/release.0.2.0/biohub.sql
-- Target DBMS : PostgreSQL 10.x-12.x
--

-- 
-- TABLE: audit_log 
--

CREATE TABLE audit_log(
    audit_log_id      integer         GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    system_user_id    integer         NOT NULL,
    create_date       TIMESTAMPTZ     DEFAULT now() NOT NULL,
    table_name        varchar(200)    NOT NULL,
    operation         varchar(20)     NOT NULL,
    before_value      json,
    after_value       json,
    CONSTRAINT audit_log_pk PRIMARY KEY (audit_log_id)
)
;



COMMENT ON COLUMN audit_log.audit_log_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN audit_log.system_user_id IS 'The system user id affecting the data change.'
;
COMMENT ON COLUMN audit_log.create_date IS 'The date and time of record creation.'
;
COMMENT ON COLUMN audit_log.table_name IS 'The table name of the data record.'
;
COMMENT ON COLUMN audit_log.operation IS 'The operation that affected the data change (ie. INSERT, UPDATE, DELETE, TRUNCATE).'
;
COMMENT ON COLUMN audit_log.before_value IS 'The JSON representation of the before value of the record.'
;
COMMENT ON COLUMN audit_log.after_value IS 'The JSON representation of the after value of the record.'
;
COMMENT ON TABLE audit_log IS 'Holds record level audit log data for the entire database.'
;

-- 
-- TABLE: security_transform 
--

CREATE TABLE security_transform(
    security_transform_id    integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    name                     varchar(100)      NOT NULL,
    description              varchar(3000),
    notes                    varchar(3000),
    transform                text              NOT NULL,
    record_effective_date    date              NOT NULL,
    record_end_date          date,
    create_date              timestamptz(6)    DEFAULT now() NOT NULL,
    create_user              integer           NOT NULL,
    update_date              timestamptz(6),
    update_user              integer,
    revision_count           integer           DEFAULT 0 NOT NULL,
    CONSTRAINT security_transform_pk PRIMARY KEY (security_transform_id)
)
;



COMMENT ON COLUMN security_transform.security_transform_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN security_transform.name IS 'The name of the record.'
;
COMMENT ON COLUMN security_transform.description IS 'The description of the record.'
;
COMMENT ON COLUMN security_transform.notes IS 'Notes associated with the record.'
;
COMMENT ON COLUMN security_transform.transform IS 'A SQL statement or fragment suitable for the identification of spatial components from submission spatial components and subsequent population of a machine readable dataset that describes the secured map viewable attributes of that component.'
;
COMMENT ON COLUMN security_transform.record_effective_date IS 'Record level effective date.'
;
COMMENT ON COLUMN security_transform.record_end_date IS 'Record level end date.'
;
COMMENT ON COLUMN security_transform.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN security_transform.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN security_transform.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN security_transform.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN security_transform.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE security_transform IS 'Security transforms are SQL statements or fragments that dynamically operate on submission spatial components to provide a secure view of the component for map display.'
;

-- 
-- TABLE: security_transform_submission 
--

CREATE TABLE security_transform_submission(
    security_transform_submission_id    integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    submission_spatial_component_id     integer           NOT NULL,
    security_transform_id               integer           NOT NULL,
    create_date                         timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                         integer           NOT NULL,
    update_date                         timestamptz(6),
    update_user                         integer,
    revision_count                      integer           DEFAULT 0 NOT NULL,
    CONSTRAINT security_transform_submission_pk PRIMARY KEY (security_transform_submission_id)
)
;



COMMENT ON COLUMN security_transform_submission.security_transform_submission_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN security_transform_submission.submission_spatial_component_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN security_transform_submission.security_transform_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN security_transform_submission.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN security_transform_submission.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN security_transform_submission.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN security_transform_submission.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN security_transform_submission.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE security_transform_submission IS 'A associative entity that joins security transforms with submission spatial components.'
;

-- 
-- TABLE: source_transform 
--

CREATE TABLE source_transform(
    source_transform_id              integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    system_user_id                   integer           NOT NULL,
    version                          varchar(20)       NOT NULL,
    transform_filename               varchar(300)      NOT NULL,
    transform_key                    varchar(1000)     NOT NULL,
    transform_precompile_filename    varchar(300)      NOT NULL,
    transform_precompile_key         varchar(1000)     NOT NULL,
    metadata_index                   varchar(100)      NOT NULL,
    record_effective_date            date              DEFAULT now() NOT NULL,
    record_end_date                  date,
    create_date                      timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                      integer           NOT NULL,
    update_date                      timestamptz(6),
    update_user                      integer,
    revision_count                   integer           DEFAULT 0 NOT NULL,
    CONSTRAINT source_transform_pk PRIMARY KEY (source_transform_id)
)
;



COMMENT ON COLUMN source_transform.source_transform_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN source_transform.system_user_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN source_transform.version IS 'The version  number of the transformation data set for a specific source system. Examples include "0.1" and "2.0.1".'
;
COMMENT ON COLUMN source_transform.transform_filename IS 'The metadata transform template file name. This template is to be used to transform specific metadata for population of the search engine layer.'
;
COMMENT ON COLUMN source_transform.transform_key IS 'The identifying key to the file in the storage system.'
;
COMMENT ON COLUMN source_transform.transform_precompile_filename IS 'A pre-compiled XSLT transformation filename. An example would be a file based on the SaxonJS Stylesheet Export File (SEF) format.'
;
COMMENT ON COLUMN source_transform.transform_precompile_key IS 'The identifying key to the file in the storage system.'
;
COMMENT ON COLUMN source_transform.metadata_index IS 'The search engine layer index that the metadata transform conforms to. This attribute provides the index name that is the target for the metadata produced by the associated "metadata transform" template.'
;
COMMENT ON COLUMN source_transform.record_effective_date IS 'Record level effective date.'
;
COMMENT ON COLUMN source_transform.record_end_date IS 'Record level end date.'
;
COMMENT ON COLUMN source_transform.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN source_transform.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN source_transform.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN source_transform.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN source_transform.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE source_transform IS 'Stores data transform information for data sources. This information is used by data ingest logic to lookup version information and transformations for processing data submissions. Note that foreign keys to system users should be restricted to users with a user identity source of "SYSTEM".'
;

-- 
-- TABLE: spatial_transform 
--

CREATE TABLE spatial_transform(
    spatial_transform_id     integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    name                     varchar(100)      NOT NULL,
    description              varchar(3000),
    notes                    varchar(3000),
    transform                text              NOT NULL,
    record_effective_date    date              NOT NULL,
    record_end_date          date,
    create_date              timestamptz(6)    DEFAULT now() NOT NULL,
    create_user              integer           NOT NULL,
    update_date              timestamptz(6),
    update_user              integer,
    revision_count           integer           DEFAULT 0 NOT NULL,
    CONSTRAINT spatial_transform_pk PRIMARY KEY (spatial_transform_id)
)
;



COMMENT ON COLUMN spatial_transform.spatial_transform_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN spatial_transform.name IS 'The name of the record.'
;
COMMENT ON COLUMN spatial_transform.description IS 'The description of the record.'
;
COMMENT ON COLUMN spatial_transform.notes IS 'Notes associated with the record.'
;
COMMENT ON COLUMN spatial_transform.transform IS 'A SQL statement or fragment suitable for the identification of spatial components from submission source and subsequent population of a machine readable dataset that describes the map viewable attributes of that component.'
;
COMMENT ON COLUMN spatial_transform.record_effective_date IS 'Record level effective date.'
;
COMMENT ON COLUMN spatial_transform.record_end_date IS 'Record level end date.'
;
COMMENT ON COLUMN spatial_transform.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN spatial_transform.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN spatial_transform.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN spatial_transform.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN spatial_transform.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE spatial_transform IS 'Spatial transforms are SQL statements that dynamically operate on submission source to extract spatial components of interest for map display.'
;

-- 
-- TABLE: spatial_transform_submission 
--

CREATE TABLE spatial_transform_submission(
    spatial_transform_submission_id    integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    spatial_transform_id               integer           NOT NULL,
    submission_spatial_component_id    integer           NOT NULL,
    create_date                        timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                        integer           NOT NULL,
    update_date                        timestamptz(6),
    update_user                        integer,
    revision_count                     integer           DEFAULT 0 NOT NULL,
    CONSTRAINT spatial_transform_submission_pk PRIMARY KEY (spatial_transform_submission_id)
)
;



COMMENT ON COLUMN spatial_transform_submission.spatial_transform_submission_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN spatial_transform_submission.spatial_transform_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN spatial_transform_submission.submission_spatial_component_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN spatial_transform_submission.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN spatial_transform_submission.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN spatial_transform_submission.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN spatial_transform_submission.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN spatial_transform_submission.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE spatial_transform_submission IS 'A associative entity that joins spatial transforms with submission spatial components.'
;

-- 
-- TABLE: submission 
--

CREATE TABLE submission(
    submission_id            integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    source_transform_id      integer           NOT NULL,
    uuid                     uuid              DEFAULT public.gen_random_uuid() NOT NULL,
    input_key                varchar(1000),
    input_file_name          varchar(300),
<<<<<<< HEAD:database/src/migrations/release.0.3.0/biohub.sql
    eml_source               text,
    eml_json_source          jsonb,
=======
    eml_source               xml,
>>>>>>> origin:database/src/migrations/release.0.2.0/biohub.sql
    darwin_core_source       jsonb,
    security_timestamp       TIMESTAMPTZ,
    record_effective_date    date              NOT NULL,
    record_end_date          date,
    create_date              timestamptz(6)    DEFAULT now() NOT NULL,
    create_user              integer           NOT NULL,
    update_date              timestamptz(6),
    update_user              integer,
    revision_count           integer           DEFAULT 0 NOT NULL,
    CONSTRAINT submission_pk PRIMARY KEY (submission_id)
)
;



COMMENT ON COLUMN submission.submission_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission.source_transform_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission.uuid IS 'The universally unique identifier for the submission as supplied by the source system.'
;
COMMENT ON COLUMN submission.input_key IS 'The identifying key to the file in the storage system. The target is the input data file or template. For example, a custom data submission template.'
;
COMMENT ON COLUMN submission.input_file_name IS 'The name of the file submitted. The target is the input data file or template. For example, a custom data submission template.'
;
COMMENT ON COLUMN submission.eml_source IS 'The Ecological Metadata Language source as extracted from the submission.'
;
COMMENT ON COLUMN submission.eml_json_source IS 'The JSON representation of the Ecological Metadata Language source for the submission.'
;
COMMENT ON COLUMN submission.darwin_core_source IS 'The denormalized Darwin Core source as extracted from the submission.'
;
COMMENT ON COLUMN submission.security_timestamp IS 'The timestamp of the completion of the application of security rules to the dataset after submission. Viewing of submission spatial components is restricted until security is applied and this attribute is set.'
;
COMMENT ON COLUMN submission.record_effective_date IS 'Record level effective date.'
;
COMMENT ON COLUMN submission.record_end_date IS 'Record level end date.'
;
COMMENT ON COLUMN submission.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN submission.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN submission.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN submission.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN submission.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE submission IS 'Provides a historical listing of published dates and pointers to raw data versions for data submissions.'
;

-- 
-- TABLE: submission_message 
--

CREATE TABLE submission_message(
    submission_message_id         integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    submission_message_type_id    integer           NOT NULL,
    submission_status_id          integer           NOT NULL,
    event_timestamp               TIMESTAMPTZ       NOT NULL,
    message                       varchar(3000),
    create_date                   timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                   integer           NOT NULL,
    update_date                   timestamptz(6),
    update_user                   integer,
    revision_count                integer           DEFAULT 0 NOT NULL,
    CONSTRAINT submission_message_pk PRIMARY KEY (submission_message_id)
)
;



COMMENT ON COLUMN submission_message.submission_message_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission_message.submission_message_type_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission_message.submission_status_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission_message.event_timestamp IS 'The timestamp of the associated event.'
;
COMMENT ON COLUMN submission_message.message IS 'The description of the record.'
;
COMMENT ON COLUMN submission_message.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN submission_message.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_message.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN submission_message.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_message.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE submission_message IS 'Intersection table to track submission messages.'
;

-- 
-- TABLE: submission_message_class 
--

CREATE TABLE submission_message_class(
    submission_message_class_id    integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    name                           varchar(50)       NOT NULL,
    record_end_date                date,
    record_effective_date          date              DEFAULT now() NOT NULL,
    description                    varchar(250),
    create_date                    timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                    integer           NOT NULL,
    update_date                    timestamptz(6),
    update_user                    integer,
    revision_count                 integer           DEFAULT 0 NOT NULL,
    CONSTRAINT submission_message_class_pk PRIMARY KEY (submission_message_class_id)
)
;



COMMENT ON COLUMN submission_message_class.submission_message_class_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission_message_class.name IS 'The name of the record.'
;
COMMENT ON COLUMN submission_message_class.record_end_date IS 'Record level end date.'
;
COMMENT ON COLUMN submission_message_class.record_effective_date IS 'Record level effective date.'
;
COMMENT ON COLUMN submission_message_class.description IS 'The description of the record.'
;
COMMENT ON COLUMN submission_message_class.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN submission_message_class.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_message_class.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN submission_message_class.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_message_class.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE submission_message_class IS 'The classification of submission message types available to report.'
;

-- 
-- TABLE: submission_message_type 
--

CREATE TABLE submission_message_type(
    submission_message_type_id     integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    submission_message_class_id    integer           NOT NULL,
    name                           varchar(50)       NOT NULL,
    record_end_date                date,
    record_effective_date          date              DEFAULT now() NOT NULL,
    description                    varchar(250),
    create_date                    timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                    integer           NOT NULL,
    update_date                    timestamptz(6),
    update_user                    integer,
    revision_count                 integer           DEFAULT 0 NOT NULL,
    CONSTRAINT submission_message_type_pk PRIMARY KEY (submission_message_type_id)
)
;



COMMENT ON COLUMN submission_message_type.submission_message_type_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission_message_type.submission_message_class_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission_message_type.name IS 'The name of the record.'
;
COMMENT ON COLUMN submission_message_type.record_end_date IS 'Record level end date.'
;
COMMENT ON COLUMN submission_message_type.record_effective_date IS 'Record level effective date.'
;
COMMENT ON COLUMN submission_message_type.description IS 'The description of the record.'
;
COMMENT ON COLUMN submission_message_type.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN submission_message_type.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_message_type.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN submission_message_type.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_message_type.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE submission_message_type IS 'The types of submission messages available to report. These messages may include metrics and validation concerns.'
;

-- 
-- TABLE: submission_spatial_component 
--

CREATE TABLE submission_spatial_component(
    submission_spatial_component_id    integer                     GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    submission_id                      integer                     NOT NULL,
    spatial_component                  jsonb                       NOT NULL,
    geometry                           geometry(geometry, 3005),
    geography                          geography(geometry),
    secured_spatial_component          jsonb,
    secured_geometry                   geometry(geometry, 3005),
    secured_geography                  geography(geometry),
    create_date                        timestamptz(6)              DEFAULT now() NOT NULL,
    create_user                        integer                     NOT NULL,
    update_date                        timestamptz(6),
    update_user                        integer,
    revision_count                     integer                     DEFAULT 0 NOT NULL,
    CONSTRAINT submission_spatial_component_pk PRIMARY KEY (submission_spatial_component_id)
)
;



COMMENT ON COLUMN submission_spatial_component.submission_spatial_component_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission_spatial_component.submission_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission_spatial_component.spatial_component IS 'A spatial component is a JSON attribute representation of a viewable map object.'
;
COMMENT ON COLUMN submission_spatial_component.geometry IS 'The containing geometry of the spatial component attribute.'
;
COMMENT ON COLUMN submission_spatial_component.geography IS 'The containing geography of the spatial component attribute.'
;
COMMENT ON COLUMN submission_spatial_component.secured_spatial_component IS 'A secure spatial component is a JSON attribute representation of a viewable map object that has been adjusted by a security rule that targets that representation.'
;
COMMENT ON COLUMN submission_spatial_component.secured_geometry IS 'The containing geometry of the secured spatial component attribute.'
;
COMMENT ON COLUMN submission_spatial_component.secured_geography IS 'The containing geography of the secured spatial component attribute.'
;
COMMENT ON COLUMN submission_spatial_component.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN submission_spatial_component.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_spatial_component.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN submission_spatial_component.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_spatial_component.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE submission_spatial_component IS 'Submission spatial components are spatial features and their desired map representations as extracted from submission source data.'
;

-- 
-- TABLE: submission_status 
--

CREATE TABLE submission_status(
    submission_status_id         integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    submission_id                integer           NOT NULL,
    submission_status_type_id    integer           NOT NULL,
    event_timestamp              TIMESTAMPTZ       NOT NULL,
    create_date                  timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                  integer           NOT NULL,
    update_date                  timestamptz(6),
    update_user                  integer,
    revision_count               integer           DEFAULT 0 NOT NULL,
    CONSTRAINT submission_status_pk PRIMARY KEY (submission_status_id)
)
;



COMMENT ON COLUMN submission_status.submission_status_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission_status.submission_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission_status.submission_status_type_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission_status.event_timestamp IS 'The timestamp of the associated event.'
;
COMMENT ON COLUMN submission_status.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN submission_status.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_status.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN submission_status.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_status.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE submission_status IS 'Provides a history of submission statuses.'
;

-- 
-- TABLE: submission_status_type 
--

CREATE TABLE submission_status_type(
    submission_status_type_id    integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    name                         varchar(50)       NOT NULL,
    record_end_date              date,
    record_effective_date        date              DEFAULT now() NOT NULL,
    description                  varchar(250),
    create_date                  timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                  integer           NOT NULL,
    update_date                  timestamptz(6),
    update_user                  integer,
    revision_count               integer           DEFAULT 0 NOT NULL,
    CONSTRAINT submission_status_type_pk PRIMARY KEY (submission_status_type_id)
)
;



COMMENT ON COLUMN submission_status_type.submission_status_type_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission_status_type.name IS 'The name of the record.'
;
COMMENT ON COLUMN submission_status_type.record_end_date IS 'Record level end date.'
;
COMMENT ON COLUMN submission_status_type.record_effective_date IS 'Record level effective date.'
;
COMMENT ON COLUMN submission_status_type.description IS 'The description of the record.'
;
COMMENT ON COLUMN submission_status_type.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN submission_status_type.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_status_type.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN submission_status_type.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_status_type.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE submission_status_type IS 'The status types of submissions. Typical status types are those that represent submissions being submitted or rejected.'
;

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
)
;



COMMENT ON COLUMN system_constant.system_constant_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN system_constant.constant_name IS 'The lookup name of the constant.'
;
COMMENT ON COLUMN system_constant.character_value IS 'The string value of the constant.'
;
COMMENT ON COLUMN system_constant.numeric_value IS 'The numeric value of the constant.'
;
COMMENT ON COLUMN system_constant.description IS 'The description of the record.'
;
COMMENT ON COLUMN system_constant.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN system_constant.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN system_constant.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN system_constant.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN system_constant.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE system_constant IS 'A list of system constants necessary for system functionality. Such constants are not editable by system administrators as they are used by internal logic.'
;

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
)
;



COMMENT ON COLUMN system_metadata_constant.system_metadata_constant_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN system_metadata_constant.constant_name IS 'The lookup name of the constant.'
;
COMMENT ON COLUMN system_metadata_constant.character_value IS 'The string value of the constant.'
;
COMMENT ON COLUMN system_metadata_constant.numeric_value IS 'The numeric value of the constant.'
;
COMMENT ON COLUMN system_metadata_constant.description IS 'The description of the record.'
;
COMMENT ON COLUMN system_metadata_constant.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN system_metadata_constant.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN system_metadata_constant.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN system_metadata_constant.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN system_metadata_constant.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE system_metadata_constant IS 'A list of system metadata constants associated with the business. Such constants are editable by system administrators and are used when publishing data.'
;

-- 
-- TABLE: system_role 
--

CREATE TABLE system_role(
    system_role_id           integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    name                     varchar(50)       NOT NULL,
    record_effective_date    date              DEFAULT now() NOT NULL,
    record_end_date          date,
    description              varchar(250)      NOT NULL,
    notes                    varchar(3000),
    create_date              timestamptz(6)    DEFAULT now() NOT NULL,
    create_user              integer           NOT NULL,
    update_date              timestamptz(6),
    update_user              integer,
    revision_count           integer           DEFAULT 0 NOT NULL,
    CONSTRAINT system_role_pk PRIMARY KEY (system_role_id)
)
;



COMMENT ON COLUMN system_role.system_role_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN system_role.name IS 'The name of the record.'
;
COMMENT ON COLUMN system_role.record_effective_date IS 'Record level effective date.'
;
COMMENT ON COLUMN system_role.record_end_date IS 'Record level end date.'
;
COMMENT ON COLUMN system_role.description IS 'The description of the record.'
;
COMMENT ON COLUMN system_role.notes IS 'Notes associated with the record.'
;
COMMENT ON COLUMN system_role.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN system_role.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN system_role.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN system_role.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN system_role.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE system_role IS 'Agency or Ministry funding the project.'
;

-- 
-- TABLE: system_user 
--

CREATE TABLE system_user(
    system_user_id             integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    user_identity_source_id    integer           NOT NULL,
    user_identifier            varchar(200)      NOT NULL,
    record_effective_date      date              DEFAULT now() NOT NULL,
    record_end_date            date,
    create_date                timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                integer           NOT NULL,
    update_date                timestamptz(6),
    update_user                integer,
    revision_count             integer           DEFAULT 0 NOT NULL,
    CONSTRAINT system_user_pk PRIMARY KEY (system_user_id)
)
;



COMMENT ON COLUMN system_user.system_user_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN system_user.user_identity_source_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN system_user.user_identifier IS 'The identifier of the user.'
;
COMMENT ON COLUMN system_user.record_effective_date IS 'Record level effective date.'
;
COMMENT ON COLUMN system_user.record_end_date IS 'Record level end date.'
;
COMMENT ON COLUMN system_user.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN system_user.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN system_user.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN system_user.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN system_user.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE system_user IS 'Agency or Ministry funding the project.'
;

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
)
;



COMMENT ON COLUMN system_user_role.system_user_role_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN system_user_role.system_user_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN system_user_role.system_role_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN system_user_role.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN system_user_role.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN system_user_role.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN system_user_role.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN system_user_role.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE system_user_role IS 'A associative entity that joins system users and system role types.'
;

-- 
-- TABLE: system_user_security_exception 
--

CREATE TABLE system_user_security_exception(
    system_user_security_exception_id    integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    security_transform_id                integer           NOT NULL,
    system_user_id                       integer           NOT NULL,
    record_effective_date                date              NOT NULL,
    record_end_date                      date,
    notes                                varchar(3000),
    create_date                          timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                          integer           NOT NULL,
    update_date                          timestamptz(6),
    update_user                          integer,
    revision_count                       integer           DEFAULT 0 NOT NULL,
    CONSTRAINT system_user_security_exception_pk PRIMARY KEY (system_user_security_exception_id)
)
;



COMMENT ON COLUMN system_user_security_exception.system_user_security_exception_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN system_user_security_exception.security_transform_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN system_user_security_exception.system_user_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN system_user_security_exception.record_effective_date IS 'Record level effective date.'
;
COMMENT ON COLUMN system_user_security_exception.record_end_date IS 'Record level end date.'
;
COMMENT ON COLUMN system_user_security_exception.notes IS 'Notes associated with the record.'
;
COMMENT ON COLUMN system_user_security_exception.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN system_user_security_exception.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN system_user_security_exception.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN system_user_security_exception.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN system_user_security_exception.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE system_user_security_exception IS 'Identifies security transforms for which particular system users are exempt, thus allowing those users to view unsecured map representations of those spatial components.'
;

-- 
-- TABLE: user_identity_source 
--

CREATE TABLE user_identity_source(
    user_identity_source_id    integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    name                       varchar(50)       NOT NULL,
    record_effective_date      date              DEFAULT now() NOT NULL,
    record_end_date            date,
    description                varchar(250),
    notes                      varchar(3000),
    create_date                timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                integer           NOT NULL,
    update_date                timestamptz(6),
    update_user                integer,
    revision_count             integer           DEFAULT 0 NOT NULL,
    CONSTRAINT user_identity_source_pk PRIMARY KEY (user_identity_source_id)
)
;



COMMENT ON COLUMN user_identity_source.user_identity_source_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN user_identity_source.name IS 'The name of the record.'
;
COMMENT ON COLUMN user_identity_source.record_effective_date IS 'Record level effective date.'
;
COMMENT ON COLUMN user_identity_source.record_end_date IS 'Record level end date.'
;
COMMENT ON COLUMN user_identity_source.description IS 'The description of the record.'
;
COMMENT ON COLUMN user_identity_source.notes IS 'Notes associated with the record.'
;
COMMENT ON COLUMN user_identity_source.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN user_identity_source.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN user_identity_source.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN user_identity_source.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN user_identity_source.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE user_identity_source IS 'The source of the user identifier. This source is traditionally the system that authenticates the user. Example sources could include IDIR, BCEID and DATABASE.'
;

-- 
-- INDEX: security_transform_nuk1 
--

CREATE UNIQUE INDEX security_transform_nuk1 ON security_transform(name, (record_end_date is NULL)) where record_end_date is null
;
-- 
-- INDEX: security_transform_submission_uk1 
--

CREATE UNIQUE INDEX security_transform_submission_uk1 ON security_transform_submission(submission_spatial_component_id, security_transform_id)
;
-- 
-- INDEX: "Ref169186" 
--

CREATE INDEX "Ref169186" ON security_transform_submission(submission_spatial_component_id)
;
-- 
-- INDEX: "Ref218187" 
--

CREATE INDEX "Ref218187" ON security_transform_submission(security_transform_id)
;
-- 
-- INDEX: source_transform_nuk1 
--

CREATE UNIQUE INDEX source_transform_nuk1 ON source_transform(system_user_id, version, (record_end_date is NULL)) where record_end_date is null
;
-- 
-- INDEX: "Ref191183" 
--

CREATE INDEX "Ref191183" ON source_transform(system_user_id)
;
-- 
-- INDEX: spatial_transform_nuk1 
--

CREATE UNIQUE INDEX spatial_transform_nuk1 ON spatial_transform(name, record_effective_date)
;
-- 
-- INDEX: spatial_transform_submission_uk1 
--

CREATE UNIQUE INDEX spatial_transform_submission_uk1 ON spatial_transform_submission(spatial_transform_id, submission_spatial_component_id)
;
-- 
-- INDEX: "Ref207184" 
--

CREATE INDEX "Ref207184" ON spatial_transform_submission(spatial_transform_id)
;
-- 
-- INDEX: "Ref169185" 
--

CREATE INDEX "Ref169185" ON spatial_transform_submission(submission_spatial_component_id)
;
-- 
-- INDEX: submission_nuk1 
--

CREATE UNIQUE INDEX submission_nuk1 ON submission(uuid, (record_end_date is NULL)) where record_end_date is null
;
-- 
-- INDEX: "Ref199182" 
--

CREATE INDEX "Ref199182" ON submission(source_transform_id)
;
-- 
-- INDEX: "Ref184166" 
--

CREATE INDEX "Ref184166" ON submission_message(submission_status_id)
;
-- 
-- INDEX: "Ref182167" 
--

CREATE INDEX "Ref182167" ON submission_message(submission_message_type_id)
;
-- 
-- INDEX: submission_message_class_nuk1 
--

CREATE UNIQUE INDEX submission_message_class_nuk1 ON submission_message_class(name, (record_end_date is NULL)) where record_end_date is null
;
-- 
-- INDEX: submission_message_type_nuk1 
--

CREATE UNIQUE INDEX submission_message_type_nuk1 ON submission_message_type(name, (record_end_date is NULL)) where record_end_date is null
;
-- 
-- INDEX: "Ref189177" 
--

CREATE INDEX "Ref189177" ON submission_message_type(submission_message_class_id)
;
-- 
-- INDEX: "Ref165161" 
--

CREATE INDEX "Ref165161" ON submission_spatial_component(submission_id)
;
-- 
-- INDEX: "Ref165163" 
--

CREATE INDEX "Ref165163" ON submission_status(submission_id)
;
-- 
-- INDEX: "Ref183164" 
--

CREATE INDEX "Ref183164" ON submission_status(submission_status_type_id)
;
-- 
-- INDEX: submission_status_type_nuk1 
--

CREATE UNIQUE INDEX submission_status_type_nuk1 ON submission_status_type(name, (record_end_date is NULL)) where record_end_date is null
;
-- 
-- INDEX: system_constant_uk1 
--

CREATE UNIQUE INDEX system_constant_uk1 ON system_constant(constant_name)
;
-- 
-- INDEX: system_metadata_constant_uk1 
--

CREATE UNIQUE INDEX system_metadata_constant_uk1 ON system_metadata_constant(constant_name)
;
-- 
-- INDEX: system_role_nuk1 
--

CREATE UNIQUE INDEX system_role_nuk1 ON system_role(name, (record_end_date is NULL)) where record_end_date is null
;
-- 
-- INDEX: system_user_nuk1 
--

CREATE UNIQUE INDEX system_user_nuk1 ON system_user(user_identifier, record_end_date, user_identity_source_id)
;
-- 
-- INDEX: "Ref190178" 
--

CREATE INDEX "Ref190178" ON system_user(user_identity_source_id)
;
-- 
-- INDEX: system_user_role_uk1 
--

CREATE UNIQUE INDEX system_user_role_uk1 ON system_user_role(system_user_id, system_role_id)
;
-- 
-- INDEX: "Ref191179" 
--

CREATE INDEX "Ref191179" ON system_user_role(system_user_id)
;
-- 
-- INDEX: "Ref192180" 
--

CREATE INDEX "Ref192180" ON system_user_role(system_role_id)
;
-- 
-- INDEX: system_user_security_exception_uk1 
--

CREATE UNIQUE INDEX system_user_security_exception_uk1 ON system_user_security_exception(security_transform_id, system_user_id)
;
-- 
-- INDEX: "Ref218188" 
--

CREATE INDEX "Ref218188" ON system_user_security_exception(security_transform_id)
;
-- 
-- INDEX: "Ref191189" 
--

CREATE INDEX "Ref191189" ON system_user_security_exception(system_user_id)
;
-- 
-- INDEX: user_identity_source_nuk1 
--

CREATE UNIQUE INDEX user_identity_source_nuk1 ON user_identity_source(name, (record_end_date is NULL)) where record_end_date is null
;
-- 
-- TABLE: security_transform_submission 
--

ALTER TABLE security_transform_submission ADD CONSTRAINT "Refsubmission_spatial_component186" 
    FOREIGN KEY (submission_spatial_component_id)
    REFERENCES submission_spatial_component(submission_spatial_component_id)
;

ALTER TABLE security_transform_submission ADD CONSTRAINT "Refsecurity_transform187" 
    FOREIGN KEY (security_transform_id)
    REFERENCES security_transform(security_transform_id)
;


-- 
-- TABLE: source_transform 
--

ALTER TABLE source_transform ADD CONSTRAINT "Refsystem_user183" 
    FOREIGN KEY (system_user_id)
    REFERENCES system_user(system_user_id)
;


-- 
-- TABLE: spatial_transform_submission 
--

ALTER TABLE spatial_transform_submission ADD CONSTRAINT "Refspatial_transform184" 
    FOREIGN KEY (spatial_transform_id)
    REFERENCES spatial_transform(spatial_transform_id)
;

ALTER TABLE spatial_transform_submission ADD CONSTRAINT "Refsubmission_spatial_component185" 
    FOREIGN KEY (submission_spatial_component_id)
    REFERENCES submission_spatial_component(submission_spatial_component_id)
;


-- 
-- TABLE: submission 
--

ALTER TABLE submission ADD CONSTRAINT "Refsource_transform182" 
    FOREIGN KEY (source_transform_id)
    REFERENCES source_transform(source_transform_id)
;


-- 
-- TABLE: submission_message 
--

ALTER TABLE submission_message ADD CONSTRAINT "Refsubmission_status166" 
    FOREIGN KEY (submission_status_id)
    REFERENCES submission_status(submission_status_id)
;

ALTER TABLE submission_message ADD CONSTRAINT "Refsubmission_message_type167" 
    FOREIGN KEY (submission_message_type_id)
    REFERENCES submission_message_type(submission_message_type_id)
;


-- 
-- TABLE: submission_message_type 
--

ALTER TABLE submission_message_type ADD CONSTRAINT "Refsubmission_message_class177" 
    FOREIGN KEY (submission_message_class_id)
    REFERENCES submission_message_class(submission_message_class_id)
;


-- 
-- TABLE: submission_spatial_component 
--

ALTER TABLE submission_spatial_component ADD CONSTRAINT "Refsubmission161" 
    FOREIGN KEY (submission_id)
    REFERENCES submission(submission_id)
;


-- 
-- TABLE: submission_status 
--

ALTER TABLE submission_status ADD CONSTRAINT "Refsubmission163" 
    FOREIGN KEY (submission_id)
    REFERENCES submission(submission_id)
;

ALTER TABLE submission_status ADD CONSTRAINT "Refsubmission_status_type164" 
    FOREIGN KEY (submission_status_type_id)
    REFERENCES submission_status_type(submission_status_type_id)
;


-- 
-- TABLE: system_user 
--

ALTER TABLE system_user ADD CONSTRAINT "Refuser_identity_source178" 
    FOREIGN KEY (user_identity_source_id)
    REFERENCES user_identity_source(user_identity_source_id)
;


-- 
-- TABLE: system_user_role 
--

ALTER TABLE system_user_role ADD CONSTRAINT "Refsystem_user179" 
    FOREIGN KEY (system_user_id)
    REFERENCES system_user(system_user_id)
;

ALTER TABLE system_user_role ADD CONSTRAINT "Refsystem_role180" 
    FOREIGN KEY (system_role_id)
    REFERENCES system_role(system_role_id)
;


-- 
-- TABLE: system_user_security_exception 
--

ALTER TABLE system_user_security_exception ADD CONSTRAINT "Refsecurity_transform188" 
    FOREIGN KEY (security_transform_id)
    REFERENCES security_transform(security_transform_id)
;

ALTER TABLE system_user_security_exception ADD CONSTRAINT "Refsystem_user189" 
    FOREIGN KEY (system_user_id)
    REFERENCES system_user(system_user_id)
;


