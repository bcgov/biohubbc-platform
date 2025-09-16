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
    -- Create team_member table
    --------------------------------------------------------------------------------
    CREATE TABLE team_member (
      team_member_id  uuid DEFAULT public.gen_random_uuid(),
      system_user_id       integer          NOT NULL,
      team_id              uuid             NOT NULL,
      create_date          timestamptz(6)   DEFAULT now() NOT NULL,
      create_user          integer          NOT NULL,
      update_date          timestamptz(6),
      update_user          integer,
      revision_count       integer          DEFAULT 0 NOT NULL,
      CONSTRAINT team_member_pk PRIMARY KEY (team_member_id),
      CONSTRAINT team_member_unique UNIQUE (system_user_id, team_id),
      CONSTRAINT team_member_user_fk FOREIGN KEY (system_user_id) REFERENCES "system_user"(system_user_id),
      CONSTRAINT team_member_team_fk FOREIGN KEY (team_id) REFERENCES team(team_id)
    );

    CREATE INDEX team_member_user_id_idx ON team_member(system_user_id);
    CREATE INDEX team_member_team_id_idx ON team_member(team_id);

    COMMENT ON TABLE team_member IS 'Associates users with teams.';
    COMMENT ON COLUMN team_member.team_member_id IS 'System-generated primary key.';
    COMMENT ON COLUMN team_member.system_user_id IS 'Foreign key to the system_user table.';
    COMMENT ON COLUMN team_member.team_id IS 'Foreign key to the team table.';
    COMMENT ON COLUMN team_member.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN team_member.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN team_member.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN team_member.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN team_member.revision_count IS 'Revision count used for concurrency control.';

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
