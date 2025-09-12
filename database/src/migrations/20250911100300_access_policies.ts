import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Create status enum
    --------------------------------------------------------------------------------
    CREATE TYPE request_status AS ENUM ('pending', 'approved', 'denied', 'revoked');
    CREATE TYPE request_priority AS ENUM ('low', 'normal', 'high', 'urgent');
    CREATE TYPE policy_condition_operator AS ENUM (
      'StringEquals',
      'StringNotEquals',
      'StringLike',
      'NumericEquals',
      'Bool',
      'Exists'
    );
    CREATE TYPE data_request_role AS ENUM ('coordinator', 'member');


    --------------------------------------------------------------------------------
    -- Create policy table
    --------------------------------------------------------------------------------
    CREATE TABLE policy (
      policy_id          uuid DEFAULT public.gen_random_uuid(),
      name               varchar(100)     NOT NULL,
      description        varchar(1000),
      status             request_status   DEFAULT 'pending' NOT NULL,
      create_date        timestamptz(6)   DEFAULT now() NOT NULL,
      create_user        integer          NOT NULL,
      update_date        timestamptz(6),
      update_user        integer,
      revision_count     integer          DEFAULT 0 NOT NULL,
      CONSTRAINT policy_pk PRIMARY KEY (policy_id)
    );

    -- index on status to accelerate lookups by status
    CREATE INDEX policy_status_idx ON policy(status);

    COMMENT ON TABLE policy IS 'Defines access policies containing one or more permission statements.';
    COMMENT ON COLUMN policy.policy_id IS 'System-generated primary key.';
    COMMENT ON COLUMN policy.name IS 'Unique name for the policy.';
    COMMENT ON COLUMN policy.description IS 'Optional description of the policy.';
    COMMENT ON COLUMN policy.status IS 'Current status of the policy request.';
    COMMENT ON COLUMN policy.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN policy.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN policy.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN policy.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN policy.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- Create team table
    --------------------------------------------------------------------------------
    CREATE TABLE team (
      team_id            uuid DEFAULT public.gen_random_uuid(),
      name               varchar(250)     NOT NULL,
      description        varchar(1000),
      create_date        timestamptz(6)   DEFAULT now() NOT NULL,
      create_user        integer          NOT NULL,
      update_date        timestamptz(6),
      update_user        integer,
      revision_count     integer          DEFAULT 0 NOT NULL,
      CONSTRAINT team_pk PRIMARY KEY (team_id)
    );

    COMMENT ON TABLE team IS 'Teams that can be assigned access policies.';
    COMMENT ON COLUMN team.team_id IS 'System-generated primary key.';
    COMMENT ON COLUMN team.name IS 'Unique name for the team.';
    COMMENT ON COLUMN team.description IS 'Optional description of the team.';
    COMMENT ON COLUMN team.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN team.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN team.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN team.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN team.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- Create policy_statement table
    --------------------------------------------------------------------------------
    CREATE TABLE policy_statement (
      policy_statement_id   uuid DEFAULT public.gen_random_uuid(),
      policy_id             uuid             NOT NULL,
      effect                varchar(10)      NOT NULL,
      action                varchar(250)     NOT NULL,
      -- NOTE: policy_statement.feature_urn does not have a FK constraint on feature.urn to enable wildcards 
      -- (ie. urn:1:telemetry:*, which should grant access to all telemetry in submission ID 1)
      feature_urn           varchar(500)     NOT NULL,
      create_date           timestamptz(6)   DEFAULT now() NOT NULL,
      create_user           integer          NOT NULL,
      update_date           timestamptz(6),
      update_user           integer,
      revision_count        integer          DEFAULT 0 NOT NULL,
      CONSTRAINT policy_statement_pk PRIMARY KEY (policy_statement_id),
      CONSTRAINT policy_statement_policy_fk FOREIGN KEY (policy_id) REFERENCES policy(policy_id),
      CONSTRAINT feature_urn_format_check CHECK (feature_urn ~ '^urn:\d+:[a-z]+:[^:]+$')
    );

    CREATE INDEX policy_statement_policy_id_idx ON policy_statement(policy_id);
    
    -- index on feature_run to accelerate lookups for a given urn
    CREATE INDEX policy_statement_feature_urn_idx ON policy_statement(feature_urn);


    COMMENT ON TABLE policy_statement IS 'Permission rule associated with a policy.';
    COMMENT ON COLUMN policy_statement.policy_statement_id IS 'System-generated primary key.';
    COMMENT ON COLUMN policy_statement.policy_id IS 'Foreign key to the policy table.';
    COMMENT ON COLUMN policy_statement.effect IS 'Effect of the statement: allow or deny.';
    COMMENT ON COLUMN policy_statement.action IS 'Action permitted or denied, e.g., feature.read.';
    COMMENT ON COLUMN policy_statement.feature_urn IS 'Feature urn identifier the statement applies to.';
    COMMENT ON COLUMN policy_statement.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN policy_statement.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN policy_statement.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN policy_statement.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN policy_statement.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- Create policy_statement_condition table
    --------------------------------------------------------------------------------
    CREATE TABLE policy_statement_condition (
      policy_statement_condition_id uuid DEFAULT public.gen_random_uuid(),
      policy_statement_id           uuid             NOT NULL,
      operator                      policy_condition_operator NOT NULL,
      key                           varchar(500)     NOT NULL,
      value                         jsonb            NOT NULL,
      create_date                   timestamptz(6)   DEFAULT now() NOT NULL,
      create_user                   integer          NOT NULL,
      update_date                   timestamptz(6),
      update_user                   integer,
      revision_count                integer          DEFAULT 0 NOT NULL,
      CONSTRAINT policy_statement_condition_pk PRIMARY KEY (policy_statement_condition_id),
      CONSTRAINT policy_statement_condition_statement_fk FOREIGN KEY (policy_statement_id) REFERENCES policy_statement(policy_statement_id)
    );

    CREATE INDEX policy_statement_condition_statement_id_idx ON policy_statement_condition(policy_statement_id);

    -- GIN index to accelerate lookups within the value json
    CREATE INDEX policy_statement_condition_value_gin_idx ON policy_statement_condition USING GIN (value);

    COMMENT ON TABLE policy_statement_condition IS 'Key-value condition associated with a policy statement, with support for operator-based evaluations.';
    COMMENT ON COLUMN policy_statement_condition.policy_statement_condition_id IS 'System-generated primary key.';
    COMMENT ON COLUMN policy_statement_condition.policy_statement_id IS 'Foreign key to the policy_statement table.';
    COMMENT ON COLUMN policy_statement_condition.operator IS 'Comparison operator (e.g., StringEquals, StringLike).';
    COMMENT ON COLUMN policy_statement_condition.key IS 'Condition key (e.g., taxon_id, region).';
    COMMENT ON COLUMN policy_statement_condition.value IS 'Value or array of values for the condition, stored as JSONB.';
    COMMENT ON COLUMN policy_statement_condition.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN policy_statement_condition.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN policy_statement_condition.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN policy_statement_condition.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN policy_statement_condition.revision_count IS 'Revision count used for concurrency control.';


    --------------------------------------------------------------------------------
    -- Create team_policy table
    --------------------------------------------------------------------------------
    CREATE TABLE team_policy (
      team_policy_id     uuid DEFAULT public.gen_random_uuid(),
      team_id            uuid             NOT NULL,
      policy_id          uuid             NOT NULL,
      create_date        timestamptz(6)   DEFAULT now() NOT NULL,
      create_user        integer          NOT NULL,
      update_date        timestamptz(6),
      update_user        integer,
      revision_count     integer          DEFAULT 0 NOT NULL,
      CONSTRAINT team_policy_pk PRIMARY KEY (team_policy_id),
      CONSTRAINT team_policy_unique UNIQUE (team_id, policy_id),
      CONSTRAINT team_policy_team_fk FOREIGN KEY (team_id) REFERENCES team(team_id),
      CONSTRAINT team_policy_policy_fk FOREIGN KEY (policy_id) REFERENCES policy(policy_id)
    );

    CREATE INDEX team_policy_team_id_idx ON team_policy(team_id);
    CREATE INDEX team_policy_policy_id_idx ON team_policy(policy_id);

    COMMENT ON TABLE team_policy IS 'Associates teams with policies and tracks access request status.';
    COMMENT ON COLUMN team_policy.team_policy_id IS 'System-generated primary key.';
    COMMENT ON COLUMN team_policy.team_id IS 'Foreign key to the team table.';
    COMMENT ON COLUMN team_policy.policy_id IS 'Foreign key to the policy table.';
    COMMENT ON COLUMN team_policy.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN team_policy.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN team_policy.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN team_policy.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN team_policy.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- Create system_user_team table
    --------------------------------------------------------------------------------
    CREATE TABLE system_user_team (
      system_user_team_id  uuid DEFAULT public.gen_random_uuid(),
      system_user_id       integer          NOT NULL,
      team_id              uuid             NOT NULL,
      create_date          timestamptz(6)   DEFAULT now() NOT NULL,
      create_user          integer          NOT NULL,
      update_date          timestamptz(6),
      update_user          integer,
      revision_count       integer          DEFAULT 0 NOT NULL,
      CONSTRAINT system_user_team_pk PRIMARY KEY (system_user_team_id),
      CONSTRAINT system_user_team_unique UNIQUE (system_user_id, team_id),
      CONSTRAINT system_user_team_user_fk FOREIGN KEY (system_user_id) REFERENCES "system_user"(system_user_id),
      CONSTRAINT system_user_team_team_fk FOREIGN KEY (team_id) REFERENCES team(team_id)
    );

    CREATE INDEX system_user_team_user_id_idx ON system_user_team(system_user_id);
    CREATE INDEX system_user_team_team_id_idx ON system_user_team(team_id);

    COMMENT ON TABLE system_user_team IS 'Associates users with teams.';
    COMMENT ON COLUMN system_user_team.system_user_team_id IS 'System-generated primary key.';
    COMMENT ON COLUMN system_user_team.system_user_id IS 'Foreign key to the system_user table.';
    COMMENT ON COLUMN system_user_team.team_id IS 'Foreign key to the team table.';
    COMMENT ON COLUMN system_user_team.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN system_user_team.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN system_user_team.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN system_user_team.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN system_user_team.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- Create data_request table
    --------------------------------------------------------------------------------
    CREATE TABLE data_request (
      data_request_id        uuid DEFAULT public.gen_random_uuid(),
      request_description    varchar(2000)    NOT NULL,
      response_description   varchar(2000),
      priority               request_priority NOT NULL,
      status                 request_status   DEFAULT 'pending' NOT NULL,
      reviewed_by            integer,
      reviewed_date          timestamptz(6),
      record_end_date        timestamptz(6),
      create_date            timestamptz(6)   DEFAULT now() NOT NULL,
      create_user            integer          NOT NULL,
      update_date            timestamptz(6),
      update_user            integer,
      revision_count         integer          DEFAULT 0 NOT NULL,
      CONSTRAINT data_request_pk PRIMARY KEY (data_request_id),
      CONSTRAINT data_request_reviewed_by_fk FOREIGN KEY (reviewed_by) REFERENCES "system_user"(system_user_id)
    );

    CREATE INDEX data_request_reviewed_by_idx ON data_request(reviewed_by);
    CREATE INDEX data_request_status_idx ON data_request(status);

    COMMENT ON TABLE data_request IS 'User requests for access to specific data resources. Each request can generate multiple policies.';
    COMMENT ON COLUMN data_request.data_request_id IS 'System-generated primary key.';
    COMMENT ON COLUMN data_request.request_description IS 'User-provided description of what access they need and why.';
    COMMENT ON COLUMN data_request.response_description IS 'Admin response explaining approval/denial decision.';
    COMMENT ON COLUMN data_request.priority IS 'Request priority level (low, normal, high, urgent).';
    COMMENT ON COLUMN data_request.status IS 'Overall status of the data request.';
    COMMENT ON COLUMN data_request.record_end_date IS 'Optional expiration date for the requested access.';
    COMMENT ON COLUMN data_request.reviewed_by IS 'Foreign key to the admin who reviewed the request.';
    COMMENT ON COLUMN data_request.reviewed_date IS 'Timestamp when the request was reviewed.';
    COMMENT ON COLUMN data_request.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN data_request.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN data_request.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN data_request.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN data_request.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- Create data_request_policy table
    --------------------------------------------------------------------------------
    CREATE TABLE data_request_policy (
      data_request_policy_id uuid DEFAULT public.gen_random_uuid(),
      data_request_id        uuid             NOT NULL,
      policy_id              uuid             NOT NULL,
      status                 request_status   DEFAULT 'pending' NOT NULL,
      policy_notes           varchar(500),
      create_date            timestamptz(6)   DEFAULT now() NOT NULL,
      create_user            integer          NOT NULL,
      update_date            timestamptz(6),
      update_user            integer,
      revision_count         integer          DEFAULT 0 NOT NULL,
      CONSTRAINT data_request_policy_pk PRIMARY KEY (data_request_policy_id),
      CONSTRAINT data_request_policy_unique UNIQUE (data_request_id, policy_id),
      CONSTRAINT data_request_policy_request_fk FOREIGN KEY (data_request_id) REFERENCES data_request(data_request_id),
      CONSTRAINT data_request_policy_policy_fk FOREIGN KEY (policy_id) REFERENCES policy(policy_id)
    );

    CREATE INDEX data_request_policy_request_id_idx ON data_request_policy(data_request_id);
    CREATE INDEX data_request_policy_policy_id_idx ON data_request_policy(policy_id);

    COMMENT ON TABLE data_request_policy IS 'Associates data requests with the policies generated for them.';
    COMMENT ON COLUMN data_request_policy.data_request_policy_id IS 'System-generated primary key.';
    COMMENT ON COLUMN data_request_policy.data_request_id IS 'Foreign key to the data request.';
    COMMENT ON COLUMN data_request_policy.policy_id IS 'Foreign key to the auto-generated policy.';
    COMMENT ON COLUMN data_request_policy.status IS 'Status of the policy.';
    COMMENT ON COLUMN data_request_policy.policy_notes IS 'Optional notes about this specific policy within the request.';
    COMMENT ON COLUMN data_request_policy.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN data_request_policy.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN data_request_policy.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN data_request_policy.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN data_request_policy.revision_count IS 'Revision count used for concurrency control.';


    --------------------------------------------------------------------------------
    -- Create data_request_group table
    --------------------------------------------------------------------------------
    CREATE TABLE data_request_group (
      data_request_group_id     uuid DEFAULT public.gen_random_uuid(),
      data_request_id           uuid             NOT NULL,
      group_name                varchar(250),
      create_date               timestamptz(6)   DEFAULT now() NOT NULL,
      create_user               integer          NOT NULL,
      update_date               timestamptz(6),
      update_user               integer,
      revision_count            integer          DEFAULT 0 NOT NULL,

      CONSTRAINT data_request_group_pk PRIMARY KEY (data_request_group_id),
      CONSTRAINT data_request_group_data_request_fk FOREIGN KEY (data_request_id) REFERENCES data_request(data_request_id)
    );

    CREATE INDEX data_request_group_request_id_idx ON data_request_group(data_request_id);

    COMMENT ON TABLE data_request_group IS 'Represents a group of users associated with a specific data request.';
    COMMENT ON COLUMN data_request_group.data_request_group_id IS 'System-generated primary key.';
    COMMENT ON COLUMN data_request_group.data_request_id IS 'Foreign key to the related data_request.';
    COMMENT ON COLUMN data_request_group.group_name IS 'Optional name for the request group (e.g., for display or reference).';
    COMMENT ON COLUMN data_request_group.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN data_request_group.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN data_request_group.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN data_request_group.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN data_request_group.revision_count IS 'Revision count used for concurrency control.';


    --------------------------------------------------------------------------------
    -- Create data_request_group_system_user table
    --------------------------------------------------------------------------------
    CREATE TABLE data_request_group_system_user (
      data_request_group_system_user_id uuid DEFAULT public.gen_random_uuid(),
      data_request_group_id             uuid              NOT NULL,
      system_user_id                    integer           NOT NULL,
      role                              data_request_role NOT NULL,
      create_date                       timestamptz(6)    DEFAULT now() NOT NULL,
      create_user                       integer           NOT NULL,
      update_date                       timestamptz(6),
      update_user                       integer,
      revision_count                    integer           DEFAULT 0 NOT NULL,

      CONSTRAINT data_request_group_system_user_pk PRIMARY KEY (data_request_group_system_user_id),
      CONSTRAINT data_request_group_system_user_unique UNIQUE (data_request_group_id, system_user_id),
      CONSTRAINT data_request_group_system_user_group_fk FOREIGN KEY (data_request_group_id) REFERENCES data_request_group(data_request_group_id),
      CONSTRAINT data_request_group_system_user_user_fk FOREIGN KEY (system_user_id) REFERENCES "system_user"(system_user_id)
    );

    CREATE INDEX data_request_group_system_user_group_id_idx ON data_request_group_system_user(data_request_group_id);
    CREATE INDEX data_request_group_system_user_user_id_idx ON data_request_group_system_user(system_user_id);

    COMMENT ON TABLE data_request_group_system_user IS 'Links users to data request groups, optionally with a group-specific role.';
    COMMENT ON COLUMN data_request_group_system_user.data_request_group_system_user_id IS 'System-generated primary key.';
    COMMENT ON COLUMN data_request_group_system_user.data_request_group_id IS 'Foreign key to the associated data_request_group.';
    COMMENT ON COLUMN data_request_group_system_user.system_user_id IS 'Foreign key to the system_user who is part of the group.';
    COMMENT ON COLUMN data_request_group_system_user.role IS 'Optional role or label for the user within the group.';
    COMMENT ON COLUMN data_request_group_system_user.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN data_request_group_system_user.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN data_request_group_system_user.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN data_request_group_system_user.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN data_request_group_system_user.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- Create data_request_reviewer table
    --------------------------------------------------------------------------------
    CREATE TABLE data_request_reviewer (
        data_request_reviewer_id uuid DEFAULT public.gen_random_uuid(),
        data_request_id          uuid             NOT NULL,
        system_user_id           integer          NOT NULL,
        status                   request_status   DEFAULT 'pending' NOT NULL,
        review_notes             varchar(2000),
        create_date              timestamptz(6)   DEFAULT now() NOT NULL,
        create_user              integer          NOT NULL,
        update_date              timestamptz(6),
        update_user              integer,
        revision_count           integer          DEFAULT 0 NOT NULL,

        CONSTRAINT data_request_reviewer_pk PRIMARY KEY (data_request_reviewer_id),
        CONSTRAINT data_request_reviewer_unique UNIQUE (data_request_id, system_user_id),
        CONSTRAINT data_request_reviewer_data_request_fk FOREIGN KEY (data_request_id) REFERENCES data_request(data_request_id),
        CONSTRAINT data_request_reviewer_system_user_fk FOREIGN KEY (system_user_id) REFERENCES "system_user"(system_user_id)
    );

    CREATE INDEX data_request_reviewer_data_request_id_idx ON data_request_reviewer(data_request_id);
    CREATE INDEX data_request_reviewer_id_idx ON data_request_reviewer(system_user_id);

    COMMENT ON TABLE data_request_reviewer IS 'Links reviewers to data requests; these users must approve or deny the data request.';
    COMMENT ON COLUMN data_request_reviewer.data_request_reviewer_id IS 'System-generated primary key.';
    COMMENT ON COLUMN data_request_reviewer.data_request_id IS 'Foreign key to the data_request.';
    COMMENT ON COLUMN data_request_reviewer.system_user_id IS 'Foreign key to the reviewing system user.';
    COMMENT ON COLUMN data_request_reviewer.status IS 'Status of this reviewer’s review: pending, approved, etc.';
    COMMENT ON COLUMN data_request_reviewer.review_notes IS 'Optional notes entered by the reviewer.';
    COMMENT ON COLUMN data_request_reviewer.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN data_request_reviewer.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN data_request_reviewer.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN data_request_reviewer.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN data_request_reviewer.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- Create submission_reviewer table
    --------------------------------------------------------------------------------
    CREATE TABLE submission_reviewer (
        submission_reviewer_id uuid DEFAULT public.gen_random_uuid(),
        submission_id          integer          NOT NULL,
        system_user_id         integer          NOT NULL,
        create_date            timestamptz(6)   DEFAULT now() NOT NULL,
        create_user            integer          NOT NULL,
        update_date            timestamptz(6),
        update_user            integer,
        revision_count         integer          DEFAULT 0 NOT NULL,

        CONSTRAINT submission_reviewer_pk PRIMARY KEY (submission_reviewer_id),
        CONSTRAINT submission_reviewer_unique UNIQUE (submission_id, system_user_id),
        CONSTRAINT submission_reviewer_submission_fk FOREIGN KEY (submission_id) REFERENCES submission(submission_id),
        CONSTRAINT submission_reviewer_user_fk FOREIGN KEY (system_user_id) REFERENCES "system_user"(system_user_id)
    );

    CREATE INDEX submission_reviewer_submission_id_idx ON submission_reviewer(submission_id);
    CREATE INDEX submission_reviewer_system_user_id_idx ON submission_reviewer(system_user_id);

    COMMENT ON TABLE submission_reviewer IS 'Default reviewers for a submission; used to auto-populate data request reviewers.';
    COMMENT ON COLUMN submission_reviewer.submission_reviewer_id IS 'System-generated primary key.';
    COMMENT ON COLUMN submission_reviewer.submission_id IS 'Foreign key to the submission.';
    COMMENT ON COLUMN submission_reviewer.system_user_id IS 'Foreign key to the system user reviewer.';
    COMMENT ON COLUMN submission_reviewer.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_reviewer.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN submission_reviewer.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN submission_reviewer.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN submission_reviewer.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- Add URN to the feature table
    --------------------------------------------------------------------------------
    -- NOTE: 'urn' is defined as nullable because it is populated by an AFTER INSERT trigger.
    -- The trigger requires access to the row's primary key (PK), which is only available after the insert completes.
    -- If 'urn' were defined as NOT NULL, the value would need to be set before or during the insert (e.g., in a BEFORE INSERT trigger),
    -- but at that point the PK hasn't been assigned yet, making it impossible to construct the 'urn'.
    ALTER TABLE submission_feature ADD COLUMN urn varchar(500);

    ALTER TABLE submission_feature ADD CONSTRAINT feature_urn_format_check CHECK (urn ~ '^urn:\d+:[a-z]+:[^:]+$');

    -- index on submission_feature.urn to accelerate lookups by urn
    CREATE INDEX submission_feature_urn_idx ON submission_feature(urn);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub;

    DROP TABLE IF EXISTS policy_statement;
    DROP TABLE IF EXISTS data_request_policy;
    DROP TABLE IF EXISTS data_request;
    DROP TABLE IF EXISTS system_user_team;
    DROP TABLE IF EXISTS team_policy;
    DROP TABLE IF EXISTS team;
    DROP TABLE IF EXISTS policy;
    DROP TYPE IF EXISTS request_status;
    DROP TABLE IF EXISTS data_request_reviewer;
    DROP TABLE IF EXISTS submission_system_user;
  `);
}
