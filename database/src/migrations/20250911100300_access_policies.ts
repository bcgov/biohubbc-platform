import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Create status enum
    --------------------------------------------------------------------------------
    CREATE TYPE request_status AS ENUM ('pending', 'approved', 'denied', 'revoked');
    CREATE TYPE request_priority AS ENUM ('low', 'normal', 'high', 'urgent');

    --------------------------------------------------------------------------------
    -- Create policy table
    --------------------------------------------------------------------------------
    CREATE TABLE policy (
      policy_id          uuid DEFAULT public.gen_random_uuid(),
      name               varchar(250)     NOT NULL,
      description        varchar(1000),
      status             request_status   DEFAULT 'pending' NOT NULL,
      create_date        timestamptz(6)   DEFAULT now() NOT NULL,
      create_user        integer          NOT NULL,
      update_date        timestamptz(6),
      update_user        integer,
      revision_count     integer          DEFAULT 0 NOT NULL,
      CONSTRAINT policy_pk PRIMARY KEY (policy_id)
    );

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
      resource              varchar(500)     NOT NULL,
      condition             jsonb,
      create_date           timestamptz(6)   DEFAULT now() NOT NULL,
      create_user           integer          NOT NULL,
      update_date           timestamptz(6),
      update_user           integer,
      revision_count        integer          DEFAULT 0 NOT NULL,
      CONSTRAINT policy_statement_pk PRIMARY KEY (policy_statement_id),
      CONSTRAINT policy_statement_policy_fk FOREIGN KEY (policy_id) REFERENCES policy(policy_id)
    );

    CREATE INDEX policy_statement_policy_id_idx ON policy_statement(policy_id);

    COMMENT ON TABLE policy_statement IS 'Permission rule associated with a policy.';
    COMMENT ON COLUMN policy_statement.policy_statement_id IS 'System-generated primary key.';
    COMMENT ON COLUMN policy_statement.policy_id IS 'Foreign key to the policy table.';
    COMMENT ON COLUMN policy_statement.effect IS 'Effect of the statement: allow or deny.';
    COMMENT ON COLUMN policy_statement.action IS 'Action permitted or denied, e.g., feature.read.';
    COMMENT ON COLUMN policy_statement.resource IS 'Resource identifier the statement applies to.';
    COMMENT ON COLUMN policy_statement.condition IS 'Optional condition object (JSON) for fine-grained control.';
    COMMENT ON COLUMN policy_statement.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN policy_statement.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN policy_statement.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN policy_statement.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN policy_statement.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- Create team_policy table
    --------------------------------------------------------------------------------
    CREATE TABLE team_policy (
      team_policy_id     uuid DEFAULT public.gen_random_uuid(),
      team_id            uuid          NOT NULL,
      policy_id          uuid          NOT NULL,
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
      requested_by           integer          NOT NULL,
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
      CONSTRAINT data_request_requested_by_fk FOREIGN KEY (requested_by) REFERENCES "system_user"(system_user_id),
      CONSTRAINT data_request_reviewed_by_fk FOREIGN KEY (reviewed_by) REFERENCES "system_user"(system_user_id)
    );

    CREATE INDEX data_request_requested_by_idx ON data_request(requested_by);
    CREATE INDEX data_request_reviewed_by_idx ON data_request(reviewed_by);
    CREATE INDEX data_request_status_idx ON data_request(status);

    COMMENT ON TABLE data_request IS 'User requests for access to specific data resources. Each request can generate multiple policies.';
    COMMENT ON COLUMN data_request.data_request_id IS 'System-generated primary key.';
    COMMENT ON COLUMN data_request.requested_by IS 'Foreign key to the user who made the request.';
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
    -- Create data_request_system_user table
    --------------------------------------------------------------------------------
    CREATE TABLE data_request_system_user (
        data_request_system_user_id uuid DEFAULT public.gen_random_uuid(),
        data_request_id          uuid             NOT NULL,
        system_user_id           integer          NOT NULL,
        status                   request_status   DEFAULT 'pending' NOT NULL,
        review_notes             varchar(2000),
        create_date              timestamptz(6)   DEFAULT now() NOT NULL,
        create_user              integer          NOT NULL,
        update_date              timestamptz(6),
        update_user              integer,
        revision_count           integer          DEFAULT 0 NOT NULL,

        CONSTRAINT data_request_system_user_pk PRIMARY KEY (data_request_system_user_id),
        CONSTRAINT data_request_system_user_unique UNIQUE (data_request_id, system_user_id),
        CONSTRAINT data_request_system_user_data_request_fk FOREIGN KEY (data_request_id) REFERENCES data_request(data_request_id),
        CONSTRAINT data_request_system_user_system_user_fk FOREIGN KEY (system_user_id) REFERENCES "system_user"(system_user_id)
    );

    CREATE INDEX data_request_system_user_data_request_id_idx ON data_request_system_user(data_request_id);
    CREATE INDEX data_request_system_user_id_idx ON data_request_system_user(system_user_id);

    COMMENT ON TABLE data_request_system_user IS 'Links reviewers to data requests with individual review status and notes.';
    COMMENT ON COLUMN data_request_system_user.data_request_system_user_id IS 'System-generated primary key.';
    COMMENT ON COLUMN data_request_system_user.data_request_id IS 'Foreign key to the data_request.';
    COMMENT ON COLUMN data_request_system_user.system_user_id IS 'Foreign key to the reviewing system user.';
    COMMENT ON COLUMN data_request_system_user.status IS 'Status of this reviewer’s review: pending, approved, etc.';
    COMMENT ON COLUMN data_request_system_user.review_notes IS 'Optional notes entered by the reviewer.';
    COMMENT ON COLUMN data_request_system_user.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN data_request_system_user.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN data_request_system_user.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN data_request_system_user.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN data_request_system_user.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- Create submission_system_user table
    --------------------------------------------------------------------------------
    CREATE TABLE submission_system_user (
        submission_system_user_id uuid DEFAULT public.gen_random_uuid(),
        submission_id          integer          NOT NULL,
        system_user_id         integer          NOT NULL,
        create_date            timestamptz(6)   DEFAULT now() NOT NULL,
        create_user            integer          NOT NULL,
        update_date            timestamptz(6),
        update_user            integer,
        revision_count         integer          DEFAULT 0 NOT NULL,

        CONSTRAINT submission_system_user_pk PRIMARY KEY (submission_system_user_id),
        CONSTRAINT submission_system_user_unique UNIQUE (submission_id, system_user_id),
        CONSTRAINT submission_system_user_submission_fk FOREIGN KEY (submission_id) REFERENCES submission(submission_id),
        CONSTRAINT submission_system_user_user_fk FOREIGN KEY (system_user_id) REFERENCES "system_user"(system_user_id)
    );

    CREATE INDEX submission_system_user_submission_id_idx ON submission_system_user(submission_id);
    CREATE INDEX submission_system_user_system_user_id_idx ON submission_system_user(system_user_id);

    COMMENT ON TABLE submission_system_user IS 'Default reviewers for a submission; used to auto-populate data request reviewers.';
    COMMENT ON COLUMN submission_system_user.submission_system_user_id IS 'System-generated primary key.';
    COMMENT ON COLUMN submission_system_user.submission_id IS 'Foreign key to the submission.';
    COMMENT ON COLUMN submission_system_user.system_user_id IS 'Foreign key to the system user reviewer.';
    COMMENT ON COLUMN submission_system_user.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_system_user.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN submission_system_user.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN submission_system_user.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN submission_system_user.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- Add URN to the feature table
    --------------------------------------------------------------------------------
    -- NOTE: urn is nullable because an AFTER INSERT trigger sets it, and this trigger needs the submission_feature PK which is only available after insert.
    -- If urn is NOT NULL, the trigger must be BEFORE INSERT, but the PK of the row isn't known yet, so the urn is not known.
    ALTER TABLE submission_feature
    ADD COLUMN urn varchar(500);

    ALTER TABLE submission_feature
    ADD CONSTRAINT feature_urn_format_check
    CHECK (urn ~ '^urn:[a-z0-9-]+:[a-z]+:[a-zA-Z0-9-]+$');


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
    DROP TABLE IF EXISTS data_request_system_user;
    DROP TABLE IF EXISTS submission_system_user;
  `);
}
