--
-- ER/Studio Data Architect SQL Code Generation
-- Project :      BioHub.DM1
--
-- Date Created : Monday, May 29, 2023 20:18:39
-- Target DBMS : PostgreSQL 10.x-12.x
--

--
-- TABLE: artifact
--

CREATE TABLE artifact(
    artifact_id                    integer           NOT NULL,
    submission_id                  integer           NOT NULL,
    uuid                           uuid              DEFAULT public.gen_random_uuid() NOT NULL,
    file_name                      varchar(300)      NOT NULL,
    file_type                      varchar(300)      NOT NULL,
    title                          varchar(300),
    description                    varchar(3000),
    file_size                      integer,
    key                            varchar(1000),
    security_review_timestamp      timestamptz(6),
    foi_reason_description         boolean,
    security_reason_name           varchar(300),
    security_reason_description    varchar(3000),
    security_reason_end_date       timestamptz(6),
    create_date                    timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                    integer           NOT NULL,
    update_date                    timestamptz(6),
    update_user                    integer,
    revision_count                 integer           DEFAULT 0 NOT NULL,
    CONSTRAINT artifact_pk PRIMARY KEY (artifact_id)
)
;



COMMENT ON COLUMN artifact.artifact_id IS 'Surrogate primary key identifier. This value should be selected from the appropriate sequence and populated manually.'
;
COMMENT ON COLUMN artifact.submission_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN artifact.uuid IS 'The universally unique identifier for the record.'
;
COMMENT ON COLUMN artifact.file_name IS 'The name of the artifact.'
;
COMMENT ON COLUMN artifact.file_type IS 'The artifact type. Artifact type examples include video, audio and field data.'
;
COMMENT ON COLUMN artifact.title IS 'The title of the artifact.'
;
COMMENT ON COLUMN artifact.description IS 'The description of the record.'
;
COMMENT ON COLUMN artifact.file_size IS 'The size of the artifact in bytes.'
;
COMMENT ON COLUMN artifact.key IS 'The identifying key to the file in the storage system.'
;
COMMENT ON COLUMN artifact.security_review_timestamp IS 'The timestamp that the security review of the submission artifact was completed.'
;
COMMENT ON COLUMN artifact.foi_reason IS 'A boolean flag indicating whether the data is secured due to Freedom of Information data being present.'
;
COMMENT ON COLUMN artifact.security_reason_name IS 'The name of the custom security reason.'
;
COMMENT ON COLUMN artifact.security_reason_description IS 'A reason description that is secures this data and is specific to this artifact or dataset.'
;
COMMENT ON COLUMN artifact.security_reason_end_date IS 'Custom security reason end date.'
;
COMMENT ON COLUMN artifact.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN artifact.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN artifact.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN artifact.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN artifact.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE artifact IS 'A listing of historical data submission artifacts. The record with the most recent security review timestamp is the currently published data set for each artifact identified by UUID.
'
;

--
-- TABLE: artifact_government_interest
--

CREATE TABLE artifact_government_interest(
    artifact_government_interest_id    integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    artifact_id                        integer           NOT NULL,
    wldtaxonomic_units_id              integer           NOT NULL,
    data_type                          varchar(300),
    description                        varchar(3000),
    create_date                        timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                        integer           NOT NULL,
    update_date                        timestamptz(6),
    update_user                        integer,
    revision_count                     integer           DEFAULT 0 NOT NULL,
    CONSTRAINT artifact_government_interest_pk PRIMARY KEY (artifact_government_interest_id)
)
;



COMMENT ON COLUMN artifact_government_interest.artifact_government_interest_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN artifact_government_interest.artifact_id IS 'Surrogate primary key identifier. This value should be selected from the appropriate sequence and populated manually.'
;
COMMENT ON COLUMN artifact_government_interest.wldtaxonomic_units_id IS 'A foreign reference to the taxonomic unit id.'
;
COMMENT ON COLUMN artifact_government_interest.data_type IS 'A description of the type of data that is secured.'
;
COMMENT ON COLUMN artifact_government_interest.description IS 'The description of the record.'
;
COMMENT ON COLUMN artifact_government_interest.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN artifact_government_interest.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN artifact_government_interest.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN artifact_government_interest.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN artifact_government_interest.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE artifact_government_interest IS 'An intersection table relating submission artifacts to government interests.'
;

--
-- TABLE: artifact_persecution
--

CREATE TABLE artifact_persecution(
    artifact_persecution_id    integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    persecution_or_harm_id     integer           NOT NULL,
    artifact_id                integer           NOT NULL,
    create_date                timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                integer           NOT NULL,
    update_date                timestamptz(6),
    update_user                integer,
    revision_count             integer           DEFAULT 0 NOT NULL,
    CONSTRAINT artifact_persecution_pk PRIMARY KEY (artifact_persecution_id)
)
;



COMMENT ON COLUMN artifact_persecution.artifact_persecution_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN artifact_persecution.persecution_or_harm_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN artifact_persecution.artifact_id IS 'Surrogate primary key identifier. This value should be selected from the appropriate sequence and populated manually.'
;
COMMENT ON COLUMN artifact_persecution.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN artifact_persecution.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN artifact_persecution.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN artifact_persecution.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN artifact_persecution.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE artifact_persecution IS 'An intersection table defining associations between artifacts and persecution or harm security labels.
'
;

--
-- TABLE: artifact_proprietary
--

CREATE TABLE artifact_proprietary(
    artifact_proprietary_id    integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    artifact_id                integer           NOT NULL,
    proprietary_type_id        integer           NOT NULL,
    first_nations_id           integer,
    proprietor                 varchar(30),
    description                varchar(3000),
    start_date                 timestamptz(6),
    end_date                   timestamptz(6),
    create_date                timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                integer           NOT NULL,
    update_date                timestamptz(6),
    update_user                integer,
    revision_count             integer           DEFAULT 0 NOT NULL,
    CONSTRAINT artifact_proprietary_pk PRIMARY KEY (artifact_proprietary_id)
)
;



COMMENT ON COLUMN artifact_proprietary.artifact_proprietary_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN artifact_proprietary.artifact_id IS 'Surrogate primary key identifier. This value should be selected from the appropriate sequence and populated manually.'
;
COMMENT ON COLUMN artifact_proprietary.proprietary_type_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN artifact_proprietary.first_nations_id IS 'A foreign reference to the first nations id.'
;
COMMENT ON COLUMN artifact_proprietary.proprietor IS 'The proprietor or owner of the artifact.'
;
COMMENT ON COLUMN artifact_proprietary.description IS 'The description of the record.'
;
COMMENT ON COLUMN artifact_proprietary.start_date IS 'The record start date.'
;
COMMENT ON COLUMN artifact_proprietary.end_date IS 'The record end date.'
;
COMMENT ON COLUMN artifact_proprietary.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN artifact_proprietary.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN artifact_proprietary.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN artifact_proprietary.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN artifact_proprietary.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE artifact_proprietary IS 'An intersection table defining associations between artifacts and proprietary security labels.'
;

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
-- TABLE: persecution_or_harm
--

CREATE TABLE persecution_or_harm(
    persecution_or_harm_id         integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    persecution_or_harm_type_id    integer           NOT NULL,
    wldtaxonomic_units_id          integer,
    name                           varchar(300)      NOT NULL,
    description                    varchar(3000),
    start_date                     timestamptz(6),
    end_date                       timestamptz(6),
    create_date                    timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                    integer           NOT NULL,
    update_date                    timestamptz(6),
    update_user                    integer,
    revision_count                 integer           DEFAULT 0 NOT NULL,
    CONSTRAINT persecution_or_harm_pk PRIMARY KEY (persecution_or_harm_id)
)
;



COMMENT ON COLUMN persecution_or_harm.persecution_or_harm_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN persecution_or_harm.persecution_or_harm_type_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN persecution_or_harm.wldtaxonomic_units_id IS 'A foreign reference to the taxonomic unit id.'
;
COMMENT ON COLUMN persecution_or_harm.name IS 'The name of the record.'
;
COMMENT ON COLUMN persecution_or_harm.description IS 'The description of the record.'
;
COMMENT ON COLUMN persecution_or_harm.start_date IS 'The record start date.'
;
COMMENT ON COLUMN persecution_or_harm.end_date IS 'The record end date.'
;
COMMENT ON COLUMN persecution_or_harm.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN persecution_or_harm.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN persecution_or_harm.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN persecution_or_harm.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN persecution_or_harm.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE persecution_or_harm IS 'Describes persecution or harm security reasons.'
;

--
-- TABLE: persecution_or_harm_type
--

CREATE TABLE persecution_or_harm_type(
    persecution_or_harm_type_id    integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    name                           varchar(100)      NOT NULL,
    description                    varchar(3000),
    record_effective_date          timestamptz(6)    DEFAULT now() NOT NULL,
    record_end_date                timestamptz(6),
    create_date                    timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                    integer           NOT NULL,
    update_date                    timestamptz(6),
    update_user                    integer,
    revision_count                 integer           DEFAULT 0 NOT NULL,
    CONSTRAINT persecution_or_harm_type_pk PRIMARY KEY (persecution_or_harm_type_id)
)
;



COMMENT ON COLUMN persecution_or_harm_type.persecution_or_harm_type_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN persecution_or_harm_type.name IS 'The name of the record.'
;
COMMENT ON COLUMN persecution_or_harm_type.description IS 'The description of the record.'
;
COMMENT ON COLUMN persecution_or_harm_type.record_effective_date IS 'Record level effective date.'
;
COMMENT ON COLUMN persecution_or_harm_type.record_end_date IS 'Record level end date.'
;
COMMENT ON COLUMN persecution_or_harm_type.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN persecution_or_harm_type.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN persecution_or_harm_type.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN persecution_or_harm_type.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN persecution_or_harm_type.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE persecution_or_harm_type IS 'Describes persecution or harm security rule types.'
;

--
-- TABLE: proprietary_type
--

CREATE TABLE proprietary_type(
    proprietary_type_id      integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    name                     varchar(100)      NOT NULL,
    description              varchar(3000),
    record_effective_date    timestamptz(6)    DEFAULT now() NOT NULL,
    record_end_date          timestamptz(6),
    create_date              timestamptz(6)    DEFAULT now() NOT NULL,
    create_user              integer           NOT NULL,
    update_date              timestamptz(6),
    update_user              integer,
    revision_count           integer           DEFAULT 0 NOT NULL,
    CONSTRAINT proprietary_type_pk PRIMARY KEY (proprietary_type_id)
)
;



COMMENT ON COLUMN proprietary_type.proprietary_type_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN proprietary_type.name IS 'The name of the record.'
;
COMMENT ON COLUMN proprietary_type.description IS 'The description of the record.'
;
COMMENT ON COLUMN proprietary_type.record_effective_date IS 'Record level effective date.'
;
COMMENT ON COLUMN proprietary_type.record_end_date IS 'Record level end date.'
;
COMMENT ON COLUMN proprietary_type.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN proprietary_type.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN proprietary_type.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN proprietary_type.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN proprietary_type.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE proprietary_type IS 'Describes proprietary security rule types.'
;

--
-- TABLE: security_transform
--

CREATE TABLE security_transform(
    security_transform_id     integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    persecution_or_harm_id    integer           NOT NULL,
    name                      varchar(100)      NOT NULL,
    description               varchar(3000),
    notes                     varchar(3000),
    transform                 text              NOT NULL,
    create_date               timestamptz(6)    DEFAULT now() NOT NULL,
    create_user               integer           NOT NULL,
    update_date               timestamptz(6),
    update_user               integer,
    revision_count            integer           DEFAULT 0 NOT NULL,
    CONSTRAINT security_transform_pk PRIMARY KEY (security_transform_id)
)
;



COMMENT ON COLUMN security_transform.security_transform_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN security_transform.persecution_or_harm_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN security_transform.name IS 'The name of the record.'
;
COMMENT ON COLUMN security_transform.description IS 'The description of the record.'
;
COMMENT ON COLUMN security_transform.notes IS 'Notes associated with the record.'
;
COMMENT ON COLUMN security_transform.transform IS 'A SQL statement or fragment suitable for the identification of spatial components from submission spatial components and subsequent population of a machine readable dataset that describes the secured map viewable attributes of that component.'
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
    source_transform_id      integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    system_user_id           integer           NOT NULL,
    version                  varchar(20)       NOT NULL,
    metadata_transform       text              NOT NULL,
    metadata_index           varchar(100)      NOT NULL,
    record_effective_date    timestamptz(6)    DEFAULT now() NOT NULL,
    record_end_date          timestamptz(6),
    create_date              timestamptz(6)    DEFAULT now() NOT NULL,
    create_user              integer           NOT NULL,
    update_date              timestamptz(6),
    update_user              integer,
    revision_count           integer           DEFAULT 0 NOT NULL,
    CONSTRAINT source_transform_pk PRIMARY KEY (source_transform_id)
)
;



COMMENT ON COLUMN source_transform.source_transform_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN source_transform.system_user_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN source_transform.version IS 'The version  number of the transformation data set for a specific source system. Examples include "0.1" and "2.0.1".'
;
COMMENT ON COLUMN source_transform.metadata_transform IS 'Describes a SQL statement that transforms the JSON representation of the source submissions EML data for indexing in Elastic Search.'
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
    record_effective_date    timestamptz(6)    DEFAULT now() NOT NULL,
    record_end_date          timestamptz(6),
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
    submission_id          integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    source_transform_id    integer           NOT NULL,
    uuid                   uuid              DEFAULT public.gen_random_uuid() NOT NULL,
    create_date            timestamptz(6)    DEFAULT now() NOT NULL,
    create_user            integer           NOT NULL,
    update_date            timestamptz(6),
    update_user            integer,
    revision_count         integer           DEFAULT 0 NOT NULL,
    CONSTRAINT submission_pk PRIMARY KEY (submission_id)
)
;



COMMENT ON COLUMN submission.submission_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission.source_transform_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission.uuid IS 'The universally unique identifier for the submission as supplied by the source system.'
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
COMMENT ON TABLE submission IS 'Provides a listing of data submissions.'
;

--
-- TABLE: submission_government_interest
--

CREATE TABLE submission_government_interest(
    submission_government_interest_id    integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    submission_id                        integer           NOT NULL,
    wldtaxonomic_units_id                integer           NOT NULL,
    data_type                            varchar(300)      NOT NULL,
    description                          varchar(3000),
    create_date                          timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                          integer           NOT NULL,
    update_date                          timestamptz(6),
    update_user                          integer,
    revision_count                       integer           DEFAULT 0 NOT NULL,
    CONSTRAINT submission_government_interest_pk PRIMARY KEY (submission_government_interest_id)
)
;



COMMENT ON COLUMN submission_government_interest.submission_government_interest_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission_government_interest.submission_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission_government_interest.wldtaxonomic_units_id IS 'A foreign reference to the taxonomic unit id.'
;
COMMENT ON COLUMN submission_government_interest.data_type IS 'A description of the type of data that is secured.'
;
COMMENT ON COLUMN submission_government_interest.description IS 'The description of the record.'
;
COMMENT ON COLUMN submission_government_interest.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN submission_government_interest.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_government_interest.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN submission_government_interest.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_government_interest.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE submission_government_interest IS 'An intersection table relating submissions to government interests.'
;

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
)
;



COMMENT ON COLUMN submission_job_queue.submission_job_queue_id IS 'Surrogate primary key identifier. This value should be selected from the appropriate sequence and populated manually.
'
;
COMMENT ON COLUMN submission_job_queue.submission_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission_job_queue.job_start_timestamp IS 'The timestamp of the job process instantiation.'
;
COMMENT ON COLUMN submission_job_queue.job_end_timestamp IS 'The timestamp of the job process completion.'
;
COMMENT ON COLUMN submission_job_queue.security_request IS 'A document supplied by the submitter outlining a security request for submission observations.'
;
COMMENT ON COLUMN submission_job_queue.key IS 'The identifying key to the file in the storage system.'
;
COMMENT ON COLUMN submission_job_queue.attempt_count IS 'The number of times this job queue record has been attempted.'
;
COMMENT ON COLUMN submission_job_queue.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN submission_job_queue.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_job_queue.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN submission_job_queue.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_job_queue.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE submission_job_queue IS 'A listing of data submission job processes and their details including start and end times.'
;

--
-- TABLE: submission_message
--

CREATE TABLE submission_message(
    submission_message_id         integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    submission_message_type_id    integer           NOT NULL,
    submission_status_id          integer           NOT NULL,
    event_timestamp               timestamptz(6)    NOT NULL,
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
    description                    varchar(250),
    record_effective_date          timestamptz(6)    DEFAULT now() NOT NULL,
    record_end_date                timestamptz(6),
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
COMMENT ON COLUMN submission_message_class.description IS 'The description of the record.'
;
COMMENT ON COLUMN submission_message_class.record_effective_date IS 'Record level effective date.'
;
COMMENT ON COLUMN submission_message_class.record_end_date IS 'Record level end date.'
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
    record_end_date                timestamptz(6),
    record_effective_date          timestamptz(6)    DEFAULT now() NOT NULL,
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
-- TABLE: submission_metadata
--

CREATE TABLE submission_metadata(
    submission_metadata_id        integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    submission_id                 integer           NOT NULL,
    eml_source                    text              NOT NULL,
    eml_json_source               jsonb,
    dataset_search_criteria       jsonb,
    record_effective_timestamp    timestamptz(6),
    record_end_timestamp          timestamptz(6),
    create_date                   timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                   integer           NOT NULL,
    update_date                   timestamptz(6),
    update_user                   integer,
    revision_count                integer           DEFAULT 0 NOT NULL,
    CONSTRAINT submission_metadata_pk PRIMARY KEY (submission_metadata_id)
)
;



COMMENT ON COLUMN submission_metadata.submission_metadata_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission_metadata.submission_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission_metadata.eml_source IS 'The Ecological Metadata Language source as extracted from the submission.'
;
COMMENT ON COLUMN submission_metadata.eml_json_source IS 'The JSON representation of the Ecological Metadata Language source for the submission.'
;
COMMENT ON COLUMN submission_metadata.dataset_search_criteria IS 'Describes the object the system sends to elastic search'
;
COMMENT ON COLUMN submission_metadata.record_effective_timestamp IS 'Record level effective timestamp.'
;
COMMENT ON COLUMN submission_metadata.record_end_timestamp IS 'Record level end timestamp.'
;
COMMENT ON COLUMN submission_metadata.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN submission_metadata.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_metadata.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN submission_metadata.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_metadata.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE submission_metadata IS 'Provides a historical listing of data submission metadata.'
;

--
-- TABLE: submission_observation
--

CREATE TABLE submission_observation(
    submission_observation_id      integer           GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    submission_id                  integer           NOT NULL,
    darwin_core_source             jsonb             NOT NULL,
    submission_security_request    jsonb,
    security_review_timestamp      timestamptz(6),
    foi_reason                     boolean,
    security_reason_name           varchar(300),
    security_reason_description    varchar(3000),
    security_reason_end_date       timestamptz(6),
    record_effective_timestamp     timestamptz(6),
    record_end_timestamp           timestamptz(6),
    create_date                    timestamptz(6)    DEFAULT now() NOT NULL,
    create_user                    integer           NOT NULL,
    update_date                    timestamptz(6),
    update_user                    integer,
    revision_count                 integer           DEFAULT 0 NOT NULL,
    CONSTRAINT submission_observation_pk PRIMARY KEY (submission_observation_id)
)
;



COMMENT ON COLUMN submission_observation.submission_observation_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission_observation.submission_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN submission_observation.darwin_core_source IS 'The denormalized Darwin Core source as extracted from the submission.'
;
COMMENT ON COLUMN submission_observation.submission_security_request IS 'A JSON document describing a submitters desire the secure submission data.'
;
COMMENT ON COLUMN submission_observation.security_review_timestamp IS 'The timestamp of the associated event.'
;
COMMENT ON COLUMN submission_observation.foi_reason IS 'A boolean flag indicating whether the data is secured due to Freedom of Information data being present.'
;
COMMENT ON COLUMN submission_observation.security_reason_name IS 'The name of the custom security reason.'
;
COMMENT ON COLUMN submission_observation.security_reason_description IS 'A reason description that is secures this data and is specific to this artifact or dataset.'
;
COMMENT ON COLUMN submission_observation.security_reason_end_date IS 'Custom security reason end date.'
;
COMMENT ON COLUMN submission_observation.record_effective_timestamp IS 'Record level effective timestamp.'
;
COMMENT ON COLUMN submission_observation.record_end_timestamp IS 'Record level end timestamp.'
;
COMMENT ON COLUMN submission_observation.create_date IS 'The datetime the record was created.'
;
COMMENT ON COLUMN submission_observation.create_user IS 'The id of the user who created the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_observation.update_date IS 'The datetime the record was updated.'
;
COMMENT ON COLUMN submission_observation.update_user IS 'The id of the user who updated the record as identified in the system user table.'
;
COMMENT ON COLUMN submission_observation.revision_count IS 'Revision count used for concurrency control.'
;
COMMENT ON TABLE submission_observation IS 'A listing of historical data submission observation data. The record with the most recent security review timestamp is the currently published data set for each submission.'
;

--
-- TABLE: submission_spatial_component
--

CREATE TABLE submission_spatial_component(
    submission_spatial_component_id    integer                     GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    submission_observation_id          integer                     NOT NULL,
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
COMMENT ON COLUMN submission_spatial_component.submission_observation_id IS 'System generated surrogate primary key identifier.'
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
    event_timestamp              timestamptz(6)    NOT NULL,
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
    description                  varchar(250),
    record_effective_date        timestamptz(6)    DEFAULT now() NOT NULL,
    record_end_date              timestamptz(6),
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
COMMENT ON COLUMN submission_status_type.description IS 'The description of the record.'
;
COMMENT ON COLUMN submission_status_type.record_effective_date IS 'Record level effective date.'
;
COMMENT ON COLUMN submission_status_type.record_end_date IS 'Record level end date.'
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
    user_guid                  varchar(200)      NOT NULL,
    record_effective_date      timestamptz(6)    DEFAULT now() NOT NULL,
    record_end_date            timestamptz(6),
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
    system_user_id                       integer           NOT NULL,
    persecution_or_harm_id               integer           NOT NULL,
    start_date                           timestamptz(6),
    end_date                             timestamptz(6),
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
COMMENT ON COLUMN system_user_security_exception.system_user_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN system_user_security_exception.persecution_or_harm_id IS 'System generated surrogate primary key identifier.'
;
COMMENT ON COLUMN system_user_security_exception.start_date IS 'The record start date.'
;
COMMENT ON COLUMN system_user_security_exception.end_date IS 'The record end date.'
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
COMMENT ON TABLE system_user_security_exception IS 'Identifies persecution or harm security reasons for which particular system users are exempt, thus allowing those users to view unsecured map representations of those spatial components.'
;

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
-- INDEX: "Ref165191"
--

CREATE INDEX "Ref165191" ON artifact(submission_id)
;
--
-- INDEX: "Ref228199"
--

CREATE INDEX "Ref228199" ON artifact_government_interest(artifact_id)
;
--
-- INDEX: artifact_persecution_uk1
--

CREATE UNIQUE INDEX artifact_persecution_uk1 ON artifact_persecution(persecution_or_harm_id)
;
--
-- INDEX: "Ref228195"
--

CREATE INDEX "Ref228195" ON artifact_persecution(artifact_id)
;
--
-- INDEX: "Ref254202"
--

CREATE INDEX "Ref254202" ON artifact_persecution(persecution_or_harm_id)
;
--
-- INDEX: "Ref228194"
--

CREATE INDEX "Ref228194" ON artifact_proprietary(artifact_id)
;
--
-- INDEX: "Ref233196"
--

CREATE INDEX "Ref233196" ON artifact_proprietary(proprietary_type_id)
;
--
-- INDEX: persecution_or_harm_uk1
--

CREATE UNIQUE INDEX persecution_or_harm_uk1 ON persecution_or_harm(persecution_or_harm_type_id, name, wldtaxonomic_units_id)
;
--
-- INDEX: "Ref252201"
--

CREATE INDEX "Ref252201" ON persecution_or_harm(persecution_or_harm_type_id)
;
--
-- INDEX: persecution_or_harm_type_nuk1
--

CREATE UNIQUE INDEX persecution_or_harm_type_nuk1 ON persecution_or_harm_type(name, record_end_date)
;
--
-- INDEX: proprietary_type_nuk1
--

CREATE UNIQUE INDEX proprietary_type_nuk1 ON proprietary_type(name, record_end_date)
;
--
-- INDEX: security_transform_uk1
--

CREATE UNIQUE INDEX security_transform_uk1 ON security_transform(name, persecution_or_harm_id)
;
--
-- INDEX: "Ref254203"
--

CREATE INDEX "Ref254203" ON security_transform(persecution_or_harm_id)
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

CREATE UNIQUE INDEX source_transform_nuk1 ON source_transform(system_user_id, version, record_end_date)
;
--
-- INDEX: "Ref191183"
--

CREATE INDEX "Ref191183" ON source_transform(system_user_id)
;
--
-- INDEX: spatial_transform_nuk1
--

CREATE UNIQUE INDEX spatial_transform_nuk1 ON spatial_transform(name, record_end_date)
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
-- INDEX: submission_uk1
--

CREATE UNIQUE INDEX submission_uk1 ON submission(uuid)
;
--
-- INDEX: "Ref199182"
--

CREATE INDEX "Ref199182" ON submission(source_transform_id)
;
--
-- INDEX: submission_government_interest_uk1
--

CREATE UNIQUE INDEX submission_government_interest_uk1 ON submission_government_interest(submission_id)
;
--
-- INDEX: "Ref165198"
--

CREATE INDEX "Ref165198" ON submission_government_interest(submission_id)
;
--
-- INDEX: "Ref165208"
--

CREATE INDEX "Ref165208" ON submission_job_queue(submission_id)
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

CREATE UNIQUE INDEX submission_message_class_nuk1 ON submission_message_class(name, record_end_date)
;
--
-- INDEX: submission_message_type_nuk1
--

CREATE UNIQUE INDEX submission_message_type_nuk1 ON submission_message_type(name, record_end_date)
;
--
-- INDEX: "Ref189177"
--

CREATE INDEX "Ref189177" ON submission_message_type(submission_message_class_id)
;
--
-- INDEX: submission_metadata_nuk1
--

CREATE UNIQUE INDEX submission_metadata_nuk1 ON submission_metadata(submission_id, record_end_timestamp)
;
--
-- INDEX: "Ref165207"
--

CREATE INDEX "Ref165207" ON submission_metadata(submission_id)
;
--
-- INDEX: "Ref165205"
--

CREATE INDEX "Ref165205" ON submission_observation(submission_id)
;
--
-- INDEX: "Ref255206"
--

CREATE INDEX "Ref255206" ON submission_spatial_component(submission_observation_id)
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

CREATE UNIQUE INDEX submission_status_type_nuk1 ON submission_status_type(name, record_end_date)
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

CREATE UNIQUE INDEX system_role_nuk1 ON system_role(name, record_end_date)
;
--
-- INDEX: system_user_nuk1
--

CREATE UNIQUE INDEX system_user_nuk1 ON system_user(user_identifier, user_identity_source_id, record_end_date)
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

CREATE UNIQUE INDEX system_user_security_exception_uk1 ON system_user_security_exception(system_user_id, persecution_or_harm_id)
;
--
-- INDEX: "Ref191189"
--

CREATE INDEX "Ref191189" ON system_user_security_exception(system_user_id)
;
--
-- INDEX: "Ref254204"
--

CREATE INDEX "Ref254204" ON system_user_security_exception(persecution_or_harm_id)
;
--
-- INDEX: user_identity_source_nuk1
--

CREATE UNIQUE INDEX user_identity_source_nuk1 ON user_identity_source(name, record_end_date)
;
--
-- TABLE: artifact
--

ALTER TABLE artifact ADD CONSTRAINT "Refsubmission191"
    FOREIGN KEY (submission_id)
    REFERENCES submission(submission_id)
;


--
-- TABLE: artifact_government_interest
--

ALTER TABLE artifact_government_interest ADD CONSTRAINT "Refartifact199"
    FOREIGN KEY (artifact_id)
    REFERENCES artifact(artifact_id)
;


--
-- TABLE: artifact_persecution
--

ALTER TABLE artifact_persecution ADD CONSTRAINT "Refartifact195"
    FOREIGN KEY (artifact_id)
    REFERENCES artifact(artifact_id)
;

ALTER TABLE artifact_persecution ADD CONSTRAINT "Refpersecution_or_harm202"
    FOREIGN KEY (persecution_or_harm_id)
    REFERENCES persecution_or_harm(persecution_or_harm_id)
;


--
-- TABLE: artifact_proprietary
--

ALTER TABLE artifact_proprietary ADD CONSTRAINT "Refartifact194"
    FOREIGN KEY (artifact_id)
    REFERENCES artifact(artifact_id)
;

ALTER TABLE artifact_proprietary ADD CONSTRAINT "Refproprietary_type196"
    FOREIGN KEY (proprietary_type_id)
    REFERENCES proprietary_type(proprietary_type_id)
;


--
-- TABLE: persecution_or_harm
--

ALTER TABLE persecution_or_harm ADD CONSTRAINT "Refpersecution_or_harm_type201"
    FOREIGN KEY (persecution_or_harm_type_id)
    REFERENCES persecution_or_harm_type(persecution_or_harm_type_id)
;


--
-- TABLE: security_transform
--

ALTER TABLE security_transform ADD CONSTRAINT "Refpersecution_or_harm203"
    FOREIGN KEY (persecution_or_harm_id)
    REFERENCES persecution_or_harm(persecution_or_harm_id)
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
-- TABLE: submission_government_interest
--

ALTER TABLE submission_government_interest ADD CONSTRAINT "Refsubmission198"
    FOREIGN KEY (submission_id)
    REFERENCES submission(submission_id)
;


--
-- TABLE: submission_job_queue
--

ALTER TABLE submission_job_queue ADD CONSTRAINT "Refsubmission208"
    FOREIGN KEY (submission_id)
    REFERENCES submission(submission_id)
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
-- TABLE: submission_metadata
--

ALTER TABLE submission_metadata ADD CONSTRAINT "Refsubmission207"
    FOREIGN KEY (submission_id)
    REFERENCES submission(submission_id)
;


--
-- TABLE: submission_observation
--

ALTER TABLE submission_observation ADD CONSTRAINT "Refsubmission205"
    FOREIGN KEY (submission_id)
    REFERENCES submission(submission_id)
;


--
-- TABLE: submission_spatial_component
--

ALTER TABLE submission_spatial_component ADD CONSTRAINT "Refsubmission_observation206"
    FOREIGN KEY (submission_observation_id)
    REFERENCES submission_observation(submission_observation_id)
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

ALTER TABLE system_user_security_exception ADD CONSTRAINT "Refsystem_user189"
    FOREIGN KEY (system_user_id)
    REFERENCES system_user(system_user_id)
;

ALTER TABLE system_user_security_exception ADD CONSTRAINT "Refpersecution_or_harm204"
    FOREIGN KEY (persecution_or_harm_id)
    REFERENCES persecution_or_harm(persecution_or_harm_id)
;


