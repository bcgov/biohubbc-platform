import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Create status enum
    --------------------------------------------------------------------------------
    CREATE TYPE policy_effect AS ENUM ('allow', 'deny');
    CREATE TYPE policy_condition_operator AS ENUM (
      -- String-based comparisons
      'StringEquals',        -- Field value must exactly match the provided string(s)
      'StringNotEquals',     -- Field value must not match the provided string(s)
      'StringLike',          -- Field value must match a wildcard pattern (e.g., LIKE '%foo%')

      -- Numeric comparisons
      'NumericEquals',       -- Field value must equal the provided number(s)

      -- Boolean evaluation
      'Bool',                -- Field value must match true/false (e.g., {"value": true})

      -- Existence check
      'Exists',              -- Field/key must exist in the input data (e.g., {"value": true} to require presence)

      -- Temporal operators (typically assume ISO 8601 date strings)
      'DateEquals',          -- Date field must match the provided date exactly
      'DateBefore',          -- Date field must be before the given date
      'DateAfter',           -- Date field must be after the given date
      'DateBetween',         -- Date field must be between two dates (inclusive or exclusive, based on implementation)

      -- Spatial relationships (assumes field contains geometry or GeoJSON)
      'Within',              -- Geometry must be entirely within the provided geometry
      'Intersects',          -- Geometry must intersect (overlap) the provided geometry
      'Contains'             -- Geometry must contain the provided geometry

      -- Taxonomy operators
      'ParentOf',             -- Field value must be a parent (ancestor) of the provided taxon_id
      'ChildOf'               -- Field value must be a child (descendant) of the provided taxon_id

    );

    --------------------------------------------------------------------------------
    -- Create policy table
    --------------------------------------------------------------------------------
    CREATE TABLE policy (
      policy_id          uuid DEFAULT public.gen_random_uuid(),
      name               varchar(100)     NOT NULL,
      description        varchar(1000),
      record_end_date    timestamptz(6),
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
    COMMENT ON COLUMN policy.record_end_date IS 'The end date of the record for soft deletes.';
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
      record_end_date    timestamptz(6),
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
    COMMENT ON COLUMN team.record_end_date IS 'The end date of the record for soft deletes.';
    COMMENT ON COLUMN team.description IS 'Optional description of the team.';
    COMMENT ON COLUMN team.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN team.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN team.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN team.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN team.revision_count IS 'Revision count used for concurrency control.';
    
    --------------------------------------------------------------------------------
    -- Create team_policy table
    --------------------------------------------------------------------------------
    CREATE TABLE team_policy (
      team_policy_id     uuid DEFAULT public.gen_random_uuid(),
      team_id            uuid             NOT NULL,
      policy_id          uuid             NOT NULL,
      record_end_date    timestamptz(6),
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
    COMMENT ON COLUMN team_policy.record_end_date IS 'The end date of the record for soft deletes.';
    COMMENT ON COLUMN team_policy.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN team_policy.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN team_policy.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN team_policy.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN team_policy.revision_count IS 'Revision count used for concurrency control.';


    --------------------------------------------------------------------------------
    -- Create policy_statement table
    --------------------------------------------------------------------------------
    -- NOTE: policy_statement.feature_urn does not have a FK constraint on feature.urn to enable wildcards 
    -- (ie. urn:1:telemetry:*, which should grant access to all telemetry in submission ID 1,
    -- following the format of urn:<submission_id>:<feature_type_name>:<)

    CREATE TABLE policy_statement (
      policy_statement_id   uuid DEFAULT public.gen_random_uuid(),
      policy_id             uuid             NOT NULL,
      effect                policy_effect    NOT NULL,
      feature_urn           varchar(500)     NOT NULL,
      record_end_date       timestamptz(6),
      create_date           timestamptz(6)   DEFAULT now() NOT NULL,
      create_user           integer          NOT NULL,
      update_date           timestamptz(6),
      update_user           integer,
      revision_count        integer          DEFAULT 0 NOT NULL,
      CONSTRAINT policy_statement_pk PRIMARY KEY (policy_statement_id),
      CONSTRAINT policy_statement_policy_fk FOREIGN KEY (policy_id) REFERENCES policy(policy_id),
      CONSTRAINT feature_urn_format_check CHECK (feature_urn ~ '^urn:(\\*|[0-9]+):\\*|[a-z]+:(\\*|[^:]+)$')
    );

    CREATE INDEX policy_statement_policy_id_idx ON policy_statement(policy_id);
    
    -- index on feature_run to accelerate lookups for a given urn
    CREATE INDEX policy_statement_feature_urn_idx ON policy_statement(feature_urn);

    COMMENT ON TABLE policy_statement IS 'Permission rule associated with a policy.';
    COMMENT ON COLUMN policy_statement.policy_statement_id IS 'System-generated primary key.';
    COMMENT ON COLUMN policy_statement.policy_id IS 'Foreign key to the policy table.';
    COMMENT ON COLUMN policy_statement.effect IS 'Effect of the statement: allow or deny.';
    COMMENT ON COLUMN policy_statement.feature_urn IS 'Feature urn identifier the statement applies to.';
    COMMENT ON COLUMN policy_statement.record_end_date IS 'The end date of the record for soft deletes.';
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
      record_end_date               timestamptz(6),
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
    COMMENT ON COLUMN policy_statement_condition.record_end_date IS 'The end date of the record for soft deletes.';
    COMMENT ON COLUMN policy_statement_condition.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN policy_statement_condition.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN policy_statement_condition.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN policy_statement_condition.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN policy_statement_condition.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- Create team_member table
    --------------------------------------------------------------------------------
    CREATE TABLE team_member (
      team_member_id  uuid DEFAULT public.gen_random_uuid(),
      system_user_id       integer          NOT NULL,
      team_id              uuid             NOT NULL,
      record_end_date      timestamptz(6),
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
    COMMENT ON COLUMN team_member.record_end_date IS 'The end date of the record for soft deletes.';
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

    --------------------------------------------------------------------------------
    -- URN insert trigger 
    --------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION biohub.tr_submission_feature_urn()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY invoker
    AS $function$
    DECLARE
      feature_type_name TEXT;
    BEGIN
      SELECT ft.name
      INTO feature_type_name
      FROM biohub.feature_type ft
      WHERE ft.feature_type_id = NEW.feature_type_id;

      IF feature_type_name IS NULL THEN
        RAISE EXCEPTION 'Feature type not found for feature_type_id %', NEW.feature_type_id;
      END IF;

      NEW.urn := CONCAT(
        'urn:',
        NEW.submission_id, ':',
        feature_type_name, ':',
        NEW.submission_feature_id
      );

      RETURN NEW;
    END;
    $function$;

    --------------------------------------------------------------------------------
    -- URN validation procedure
    --------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION biohub.policy_statement_urn_validation()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY INVOKER
    AS $function$
    DECLARE
      urn_parts TEXT[];
      urn_submission_id TEXT;
      feature_type_name TEXT;
      urn_submission_feature_id TEXT;
    BEGIN
      urn_parts := string_to_array(NEW.feature_urn, ':');

      IF array_length(urn_parts, 1) != 4 OR urn_parts[1] != 'urn' THEN
        RAISE EXCEPTION 'Invalid URN format. Expected: urn:<submission_id>:<feature_type_name>:<submission_feature_id>, got: %', NEW.feature_urn;
      END IF;

      urn_submission_id := urn_parts[2];
      feature_type_name := urn_parts[3];
      urn_submission_feature_id := urn_parts[4];

      -- Validate submission_id if not '*'
      IF urn_submission_id != '*' THEN
        IF NOT EXISTS (
          SELECT 1 FROM biohub.submission s WHERE s.submission_id = urn_submission_id::integer
        ) THEN
          RAISE EXCEPTION 'Invalid feature_urn: submission_id % does not exist', urn_submission_id;
        END IF;
      END IF;

      -- Validate feature_type_name if not '*'
      IF feature_type_name != '*' THEN
        IF NOT EXISTS (
          SELECT 1 FROM biohub.feature_type ft WHERE ft.name = feature_type_name
        ) THEN
          RAISE EXCEPTION 'Invalid feature_urn: feature_type_name % does not exist', feature_type_name;
        END IF;
      END IF;

      -- Validate submission_feature_id if not '*'
      IF urn_submission_feature_id != '*' THEN
        IF NOT EXISTS (
          SELECT 1 FROM biohub.submission_feature f WHERE f.submission_feature_id = urn_submission_feature_id::integer
        ) THEN
          RAISE EXCEPTION 'Invalid feature_urn: submission_feature_id % does not exist', urn_submission_feature_id;
        END IF;
      END IF;

      -- If none of the parts are wildcards, validate their association
      IF urn_submission_id != '*' AND urn_submission_feature_id != '*' AND feature_type_name != '*' THEN
        IF NOT EXISTS (
          SELECT 1
          FROM biohub.submission_feature f
          JOIN biohub.feature_type ft ON f.feature_type_id = ft.feature_type_id
          WHERE f.submission_feature_id = urn_submission_feature_id::integer
            AND f.submission_id = urn_submission_id::integer
            AND ft.name = feature_type_name
        ) THEN
          RAISE EXCEPTION 'Invalid feature_urn: submission_feature_id % does not belong to submission_id % or feature_type %', 
            urn_submission_feature_id, urn_submission_id, feature_type_name;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $function$;

    --------------------------------------------------------------------------------
    -- Create table triggers
    --------------------------------------------------------------------------------

    -- Trigger to validate the URN
    CREATE TRIGGER tr_policy_statement_urn_validation BEFORE INSERT ON biohub.policy_statement FOR EACH ROW EXECUTE FUNCTION biohub.policy_statement_urn_validation();
    
    -- Trigger to insert the URN for each feature
    CREATE TRIGGER insert_submission_feature_urn AFTER INSERT ON biohub.submission_feature FOR EACH ROW EXECUTE PROCEDURE biohub.tr_submission_feature_urn();

    -- Audit triggers for new tables
    CREATE TRIGGER audit_policy BEFORE INSERT OR UPDATE OR DELETE ON policy FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_policy AFTER INSERT OR UPDATE OR DELETE ON policy FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();
    
    CREATE TRIGGER audit_policy_statement BEFORE INSERT OR UPDATE OR DELETE ON policy_statement FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_policy_statement AFTER INSERT OR UPDATE OR DELETE ON policy_statement FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();
    
    CREATE TRIGGER audit_policy_statement_condition BEFORE INSERT OR UPDATE OR DELETE ON policy_statement_condition FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_policy_statement_condition AFTER INSERT OR UPDATE OR DELETE ON policy_statement_condition FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();
    
    CREATE TRIGGER audit_team BEFORE INSERT OR UPDATE OR DELETE ON team FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_team AFTER INSERT OR UPDATE OR DELETE ON team FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();
    
    CREATE TRIGGER audit_team_member BEFORE INSERT OR UPDATE OR DELETE ON team_member FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_team_member AFTER INSERT OR UPDATE OR DELETE ON team_member FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();
    
    CREATE TRIGGER audit_team_policy BEFORE INSERT OR UPDATE OR DELETE ON team_policy FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_team_policy AFTER INSERT OR UPDATE OR DELETE ON team_policy FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub;

    DROP INDEX IF EXISTS submission_feature_urn_idx;
    ALTER TABLE submission_feature DROP CONSTRAINT IF EXISTS feature_urn_format_check;
    ALTER TABLE submission_feature DROP COLUMN IF EXISTS urn;

    DROP TABLE IF EXISTS team_member;
    DROP TABLE IF EXISTS team_policy;
    DROP TABLE IF EXISTS policy_statement_condition;
    DROP TABLE IF EXISTS policy_statement;
    DROP TABLE IF EXISTS team;
    DROP TABLE IF EXISTS policy;

    DROP TYPE IF EXISTS policy_condition_operator;
  `);
}
