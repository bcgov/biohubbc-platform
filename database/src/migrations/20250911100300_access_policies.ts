import { Knex } from 'knex';

/**
 * Migration to enable fine-grained, role-based access control to submission features using policy-based URNs.
 *
 * Features included:
 * - Creates RBAC-related tables:
 *   - `policy`
 *   - `team`
 *   - `team_policy`
 *   - `policy_statement`
 *   - `policy_statement_condition`
 *   - `team_member`
 *
 * - Defines enum types:
 *   - `policy_effect` for access logic (e.g., allow/deny)
 *   - `policy_condition_operator` for conditional filters
 *
 * - Adds `urn` column to `submission_feature` table,
 *   automatically populated via an AFTER INSERT trigger. This migrations also sets the urn column for existing data.
 *
 * - Adds `submission_feature_urn` column to `policy_statement` table,
 *   with a validation trigger to enforce URN format and referential integrity.
 *   policy_statement.submission_feature_urn corresponds to submission_feature.urn.
 *
 * - URNs follow the format:
 *   `urn:<submission_id>:<feature_type_name>:<submission_feature_id>`
 *   and support wildcards (`*`) in any segment.
 *
 * - Regex check enforces urn structure and syntax
 * - Triggers enforce referential integrity of the urn:
 *   - Existence of referenced `submission_id`, `feature_type.name`, and `submission_feature_id` (unless wildcarded).
 *   - Correct matching between URN components
 *     (e.g., `submission_feature_id` must belong to the `submission_id`)
 * - Triggers enforce referential integrity in policy statements and conditions:
 *   - Policy statement conditions must reference existing feature properties
 *
 * Additional features:
 * - Audit and journal triggers for all new RBAC tables.
 * - GIN and B-tree indexes to optimize queries on URNs and JSON conditions.
 */

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

      -- Temporal operators (DateEquals can be achieved by making before = after)
      'DateBefore',          -- Date field must be before the given date
      'DateAfter',           -- Date field must be after the given date

      -- Spatial relationships
      'Within',              -- Geometry must be entirely within the provided geometry
      'Intersects',          -- Geometry must intersect (overlap) the provided geometry
      'Contains',             -- Geometry must contain the provided geometry

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

    CREATE UNIQUE INDEX policy_nuk1 ON policy(name, (record_end_date is NULL)) where record_end_date is null;

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
    
    CREATE UNIQUE INDEX team_nuk1 ON team(name, (record_end_date is NULL)) where record_end_date is null;

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

    -- A team can only have a policy applied once
    CREATE UNIQUE INDEX team_policy_nuk1 ON team_policy(team_id, policy_id, (record_end_date is NULL)) where record_end_date is null;

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
    -- NOTE: policy_statement.submission_feature_urn intentionally does not have a FK constraint 
    -- on submission_feature.urn to enable wildcard URNs (e.g., urn:1:telemetry:*).
    -- Wildcard URNs allow policies to apply to multiple features without requiring 
    -- individual foreign key relationships for each wildcard pattern.
    -- URNs follow the format: urn:<submission_id>:<feature_type_name>:<submission_feature_id>
    -- Referential integrity is enforced via the tr_policy_statement_urn_validation() trigger.

    CREATE TABLE policy_statement (
      policy_statement_id     uuid DEFAULT public.gen_random_uuid(),
      policy_id               uuid             NOT NULL,
      effect                  policy_effect    NOT NULL,
      submission_feature_urn  varchar(500)     NOT NULL,
      record_end_date         timestamptz(6),
      create_date             timestamptz(6)   DEFAULT now() NOT NULL,
      create_user             integer          NOT NULL,
      update_date             timestamptz(6),
      update_user             integer,
      revision_count          integer          DEFAULT 0 NOT NULL,
      CONSTRAINT policy_statement_pk PRIMARY KEY (policy_statement_id),
      CONSTRAINT policy_statement_policy_fk FOREIGN KEY (policy_id) REFERENCES policy(policy_id),
      CONSTRAINT submission_feature_urn_format_check CHECK (submission_feature_urn ~ '^urn:(\\*|[0-9]+):([a-zA-Z0-9_]+|\\*):(\\*|[^:]+)$')
    );

    CREATE INDEX policy_statement_policy_id_idx ON policy_statement(policy_id);
    CREATE UNIQUE INDEX policy_statement_nuk1 ON policy_statement(policy_id, effect, submission_feature_urn, (record_end_date is NULL)) where record_end_date is null;
    
    -- index on submission_feature_urn to accelerate lookups for a given urn
    CREATE INDEX policy_statement_submission_feature_urn_idx ON policy_statement(submission_feature_urn);

    COMMENT ON TABLE policy_statement IS 'Permission rule associated with a policy.';
    COMMENT ON COLUMN policy_statement.policy_statement_id IS 'System-generated primary key.';
    COMMENT ON COLUMN policy_statement.policy_id IS 'Foreign key to the policy table.';
    COMMENT ON COLUMN policy_statement.effect IS 'Effect of the statement: allow or deny.';
    COMMENT ON COLUMN policy_statement.submission_feature_urn IS 'Feature urn identifier the statement applies to.';
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

    -- NOTE: The 'value' column uses the jsonb data type, which stores JSON data in a binary format.
    -- This means that the order of keys within the JSON object does NOT affect equality comparisons,
    -- allowing the unique index to correctly enforce uniqueness regardless of key order.
    --
    -- In contrast, the regular json data type preserves key order as text, so two JSON objects
    -- with the same keys and values but in different orders would be considered different,
    -- making uniqueness enforcement unreliable.
    --
    -- This unique check does not consider the order of values (eg. {"key": [1, 2, 3]} vs {"key": [3, 1, 2]} are different).
    -- It is possible to normalize the json data, but not all arrays can be reordered (eg. polygon vertices, time series).
    -- The best solution is to be intentional and cautious when creating policy statement conditions to avoid redundancy.
    CREATE UNIQUE INDEX policy_statement_condition_nuk1 ON policy_statement_condition(policy_statement_id, operator, key, value, (record_end_date is NULL)) where record_end_date is null;

    -- GIN index to accelerate lookups within the value jsonb
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

    ALTER TABLE submission_feature ADD CONSTRAINT feature_urn_format_check CHECK (urn ~ '^urn:(\\*|[0-9]+):([a-zA-Z0-9_]+|\\*):(\\*|[^:]+)$');

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
    -- Update existing submission_feature records with the URN
    --------------------------------------------------------------------------------
    UPDATE submission_feature sf
    SET urn = (
      SELECT CONCAT(
        'urn:',
        sf.submission_id, ':',
        ft.name, ':',
        sf.submission_feature_id
      )
      FROM biohub.feature_type ft
      WHERE ft.feature_type_id = sf.feature_type_id
    );

    --------------------------------------------------------------------------------
    -- Function: biohub.tr_policy_statement_urn_validation()
    --
    -- Purpose:
    --   Validates that a URN in the form
    --   "urn:<submission_id>:<feature_type_name>:<submission_feature_id>" is valid.
    --
    -- Behavior:
    --   - Ensures the URN format is correct (4 parts, starting with "urn").
    --   - Validates that the referenced submission, feature type, and submission feature exist,
    --     unless a wildcard '*' is provided.
    --   - Ensures that the submission_feature_id is associated with the correct submission_id
    --     and feature_type, when all three components are provided.
    --
    -- Notes:
    --   - This function is intended to be used as a BEFORE INSERT OR UPDATE trigger.
    --   - Wildcards ('*') are allowed to represent "any" value, but only for looser matching.
    --------------------------------------------------------------------------------

    CREATE OR REPLACE FUNCTION biohub.tr_policy_statement_urn_validation()
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
      urn_parts := string_to_array(NEW.submission_feature_urn, ':');

      IF array_length(urn_parts, 1) != 4 OR urn_parts[1] != 'urn' THEN
        RAISE EXCEPTION 'Invalid URN format. Expected: urn:<submission_id>:<feature_type_name>:<submission_feature_id>, got: %', NEW.submission_feature_urn;
      END IF;

      urn_submission_id := urn_parts[2];
      feature_type_name := urn_parts[3];
      urn_submission_feature_id := urn_parts[4];

      -- Validate submission_id if not '*'
      IF urn_submission_id != '*' THEN
        IF NOT EXISTS (
          SELECT 1 FROM biohub.submission s WHERE s.submission_id = urn_submission_id::integer
        ) THEN
          RAISE EXCEPTION 'Invalid submission_feature_urn: submission_id % does not exist', urn_submission_id;
        END IF;
      END IF;

      -- Validate feature_type_name if not '*'
      IF feature_type_name != '*' THEN
        IF NOT EXISTS (
          SELECT 1 FROM biohub.feature_type ft WHERE ft.name = feature_type_name
        ) THEN
          RAISE EXCEPTION 'Invalid submission_feature_urn: feature_type_name % does not exist', feature_type_name;
        END IF;
      END IF;

      -- Validate submission_feature_id if not '*'
      IF urn_submission_feature_id != '*' THEN
        IF NOT EXISTS (
          SELECT 1 FROM biohub.submission_feature f WHERE f.submission_feature_id = urn_submission_feature_id::integer
        ) THEN
          RAISE EXCEPTION 'Invalid submission_feature_urn: submission_feature_id % does not exist', urn_submission_feature_id;
        END IF;
      END IF;

      -- Validate that submission_feature_id matches the given feature_type_name (if both are provided)
      IF urn_submission_feature_id != '*' AND feature_type_name != '*' THEN
        IF NOT EXISTS (
          SELECT 1
          FROM biohub.submission_feature f
          JOIN biohub.feature_type ft ON f.feature_type_id = ft.feature_type_id
          WHERE f.submission_feature_id = urn_submission_feature_id::integer
            AND ft.name = feature_type_name
        ) THEN
          RAISE EXCEPTION 'Invalid submission_feature_urn: submission_feature_id % does not have feature_type %', 
            urn_submission_feature_id, feature_type_name;
        END IF;
      END IF;

      -- If all 3 parts are non-wildcard, validate full association
      IF urn_submission_id != '*' AND urn_submission_feature_id != '*' AND feature_type_name != '*' THEN
        IF NOT EXISTS (
          SELECT 1
          FROM biohub.submission_feature f
          JOIN biohub.feature_type ft ON f.feature_type_id = ft.feature_type_id
          WHERE f.submission_feature_id = urn_submission_feature_id::integer
            AND f.submission_id = urn_submission_id::integer
            AND ft.name = feature_type_name
        ) THEN
          RAISE EXCEPTION 'Invalid submission_feature_urn: submission_feature_id % does not belong to submission_id % or feature_type %', 
            urn_submission_feature_id, urn_submission_id, feature_type_name;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $function$;

    --------------------------------------------------------------------------------
    -- Function: biohub.tr_validate_policy_condition_key()
    --
    -- Purpose:
    --   Validates that a policy condition (key, operator, and value) inserted into
    --   the policy_statement_condition table is semantically correct based on the
    --   metadata stored in feature_type_property and related tables.
    --
    -- Behavior:
    --   - Validates that the 'key' corresponds to a valid feature property.
    --   - Checks that the 'operator' is allowed for the data type of the property.
    --   - Ensures that the 'value' matches the expected JSON type based on the operator and property type.
    --   - For array values, validates that all elements are of the expected type.
    --   - Performs deeper validation for spatial operators, requiring valid GeoJSON with a 'type' field.
    --
    -- Notes:
    --   - This function is designed to catch semantic and structural errors at the database level.
    --   - Assumes consistent and up-to-date metadata in supporting tables.
    --   - Does not perform validation for taxonomy-based operators like "ParentOf" or "ChildOf"
    --     as they require external services.
    --------------------------------------------------------------------------------

    CREATE OR REPLACE FUNCTION biohub.tr_validate_policy_condition_key()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY INVOKER
    AS $$
    DECLARE
        property_type_name TEXT;
        operator_text TEXT;
        value_type TEXT;
        valid_operators TEXT[];
        elem JSONB;
    BEGIN
        -- Convert operator to text for consistent handling
        operator_text := NEW.operator::TEXT;
        
        -- Get the data type for this property key
        SELECT fpt.name INTO property_type_name
        FROM biohub.feature_type_property ftp
        JOIN biohub.feature_property fp ON fp.feature_property_id = ftp.feature_property_id
        JOIN biohub.feature_property_type fpt ON fp.feature_property_type_id = fpt.feature_property_type_id
        WHERE fp.name = NEW.key
        LIMIT 1;

        -- Validate that the property key exists
        IF property_type_name IS NULL THEN
            RAISE EXCEPTION 'Invalid property key "%": not found in feature_type_property', NEW.key;
        END IF;

        -- Set valid operators based on property type
        valid_operators := CASE property_type_name
            WHEN 'string' THEN 
                ARRAY['StringEquals', 'StringNotEquals', 'StringLike', 'Exists']
            WHEN 'number' THEN 
                ARRAY['NumericEquals', 'Exists']
            WHEN 'datetime' THEN 
                ARRAY['DateBefore', 'DateAfter', 'Exists']
            WHEN 'spatial' THEN 
                ARRAY['Within', 'Intersects', 'Contains', 'Exists']
            WHEN 'boolean' THEN 
                ARRAY['Bool', 'Exists']
            WHEN 'object' THEN 
                ARRAY['Exists']
            WHEN 'array' THEN 
                ARRAY['Exists']
            WHEN 'artifact_key' THEN 
                ARRAY['StringEquals', 'StringNotEquals', 'StringLike', 'Exists']
            ELSE
                NULL
        END;

        -- Validate operator compatibility with property type
        IF valid_operators IS NULL THEN
            RAISE EXCEPTION 'Unknown property type "%"', property_type_name;
        END IF;

        IF NOT (operator_text = ANY(valid_operators)) THEN
            RAISE EXCEPTION 'Operator "%" not valid for property type "%". Valid operators: %', 
                operator_text, property_type_name, array_to_string(valid_operators, ', ');
        END IF;

        -- Get the JSON type of the value for validation
        value_type := jsonb_typeof(NEW.value);

        -- Validate operator-specific value requirements
        
        -- Boolean operators
        IF operator_text = 'Bool' THEN
            IF value_type != 'boolean' THEN
                RAISE EXCEPTION 'Bool operator requires a boolean value, got: %', value_type;
            END IF;
        END IF;

        -- Numeric operators
        IF operator_text = 'NumericEquals' THEN
            IF value_type NOT IN ('number', 'array') THEN
                RAISE EXCEPTION 'NumericEquals operator requires a number or array of numbers, got: %', value_type;
            END IF;
            IF value_type = 'array' THEN
                FOR elem IN SELECT * FROM jsonb_array_elements(NEW.value) LOOP
                    IF jsonb_typeof(elem) != 'number' THEN
                        RAISE EXCEPTION 'NumericEquals array must contain only numbers, found: %', jsonb_typeof(elem);
                    END IF;
                END LOOP;
            END IF;
        END IF;

        -- String operators
        IF operator_text = 'StringEquals' OR operator_text = 'StringNotEquals' OR operator_text = 'StringLike' THEN
            IF value_type NOT IN ('string', 'array') THEN
                RAISE EXCEPTION '% operator requires a string or array of strings, got: %', operator_text, value_type;
            END IF;
            IF value_type = 'array' THEN
                FOR elem IN SELECT * FROM jsonb_array_elements(NEW.value) LOOP
                    IF jsonb_typeof(elem) != 'string' THEN
                        RAISE EXCEPTION '% operator array must contain only strings, found: %', operator_text, jsonb_typeof(elem);
                    END IF;
                END LOOP;
            END IF;
        END IF;

        -- Existence operators
        IF operator_text = 'Exists' THEN
            IF value_type != 'boolean' THEN
                RAISE EXCEPTION 'Exists operator requires a boolean value, got: %', value_type;
            END IF;
        END IF;

        -- Spatial operators
        IF operator_text = 'Within' OR operator_text = 'Intersects' OR operator_text = 'Contains' THEN
            IF value_type != 'object' THEN
                RAISE EXCEPTION 'Spatial operator % requires a GeoJSON object, got: %', operator_text, value_type;
            END IF;
            IF NEW.value -> 'type' IS NULL THEN
                RAISE EXCEPTION 'Spatial operator % requires valid GeoJSON with "type" field', operator_text;
            END IF;
        END IF;

        -- Date operators
        IF operator_text = ANY(ARRAY['DateBefore', 'DateAfter']) THEN
            IF value_type NOT IN ('string', 'array') THEN
                RAISE EXCEPTION '% operator requires a date string or array of date strings, got: %', operator_text, value_type;
            END IF;
            IF value_type = 'array' THEN
                FOR elem IN SELECT * FROM jsonb_array_elements(NEW.value) LOOP
                    IF jsonb_typeof(elem) != 'string' THEN
                        RAISE EXCEPTION '% operator array must contain only date strings, found: %', operator_text, jsonb_typeof(elem);
                    END IF;
                END LOOP;
            END IF;
        END IF;
        RETURN NEW;
    EXCEPTION
        WHEN OTHERS THEN
            -- Re-raise with context about which record failed
            RAISE EXCEPTION 'Policy condition validation failed for key="%", operator="%": %', 
                NEW.key, operator_text, SQLERRM;
    END;
    $$;
    
    --------------------------------------------------------------------------------
    -- Create table triggers
    --------------------------------------------------------------------------------

    -- Trigger to validate the URN
    CREATE TRIGGER policy_statement_urn_validation BEFORE INSERT ON biohub.policy_statement FOR EACH ROW EXECUTE PROCEDURE biohub.tr_policy_statement_urn_validation();
    
    -- Trigger to validate policy statement conditions (conditions must reference existing feature properties)
    CREATE TRIGGER validate_policy_condition_key BEFORE INSERT ON biohub.policy_statement_condition FOR EACH ROW EXECUTE PROCEDURE biohub.tr_validate_policy_condition_key();
    
    -- Trigger to insert the URN for each feature
    CREATE TRIGGER submission_feature_urn BEFORE INSERT ON biohub.submission_feature FOR EACH ROW EXECUTE PROCEDURE biohub.tr_submission_feature_urn();

    -- Audit triggers for new tables
    CREATE TRIGGER audit_policy BEFORE INSERT OR UPDATE OR DELETE ON policy FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_policy AFTER INSERT OR UPDATE OR DELETE ON policy FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
    
    CREATE TRIGGER audit_policy_statement BEFORE INSERT OR UPDATE OR DELETE ON policy_statement FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_policy_statement AFTER INSERT OR UPDATE OR DELETE ON policy_statement FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
    
    CREATE TRIGGER audit_policy_statement_condition BEFORE INSERT OR UPDATE OR DELETE ON policy_statement_condition FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_policy_statement_condition AFTER INSERT OR UPDATE OR DELETE ON policy_statement_condition FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
    
    CREATE TRIGGER audit_team BEFORE INSERT OR UPDATE OR DELETE ON team FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_team AFTER INSERT OR UPDATE OR DELETE ON team FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
    
    CREATE TRIGGER audit_team_member BEFORE INSERT OR UPDATE OR DELETE ON team_member FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_team_member AFTER INSERT OR UPDATE OR DELETE ON team_member FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
    
    CREATE TRIGGER audit_team_policy BEFORE INSERT OR UPDATE OR DELETE ON team_policy FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_team_policy AFTER INSERT OR UPDATE OR DELETE ON team_policy FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Create backup tables to preserve data before dropping RBAC tables
    --------------------------------------------------------------------------------
    -- This ensures data is not lost during rollback in production environments
    CREATE TABLE IF NOT EXISTS policy_backup AS SELECT * FROM policy;
    CREATE TABLE IF NOT EXISTS team_backup AS SELECT * FROM team;
    CREATE TABLE IF NOT EXISTS team_policy_backup AS SELECT * FROM team_policy;
    CREATE TABLE IF NOT EXISTS team_member_backup AS SELECT * FROM team_member;
    CREATE TABLE IF NOT EXISTS policy_statement_backup AS SELECT * FROM policy_statement;
    CREATE TABLE IF NOT EXISTS policy_statement_condition_backup AS SELECT * FROM policy_statement_condition;
    
    -- Add comments to backup tables for identification
    COMMENT ON TABLE policy_backup IS 'Backup of policy table created during RBAC migration rollback';
    COMMENT ON TABLE team_backup IS 'Backup of team table created during RBAC migration rollback';
    COMMENT ON TABLE team_policy_backup IS 'Backup of team_policy table created during RBAC migration rollback';
    COMMENT ON TABLE team_member_backup IS 'Backup of team_member table created during RBAC migration rollback';
    COMMENT ON TABLE policy_statement_backup IS 'Backup of policy_statement table created during RBAC migration rollback';
    COMMENT ON TABLE policy_statement_condition_backup IS 'Backup of policy_statement_condition table created during RBAC migration rollback';

    --------------------------------------------------------------------------------
    -- Drop triggers first
    --------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS policy_statement_urn_validation ON biohub.policy_statement;
    DROP TRIGGER IF EXISTS validate_policy_condition_key ON biohub.policy_statement_condition;
    DROP TRIGGER IF EXISTS submission_feature_urn ON biohub.submission_feature;
    
    DROP TRIGGER IF EXISTS audit_policy ON policy;
    DROP TRIGGER IF EXISTS journal_policy ON policy;
    DROP TRIGGER IF EXISTS audit_policy_statement ON policy_statement;
    DROP TRIGGER IF EXISTS journal_policy_statement ON policy_statement;
    DROP TRIGGER IF EXISTS audit_policy_statement_condition ON policy_statement_condition;
    DROP TRIGGER IF EXISTS journal_policy_statement_condition ON policy_statement_condition;
    DROP TRIGGER IF EXISTS audit_team ON team;
    DROP TRIGGER IF EXISTS journal_team ON team;
    DROP TRIGGER IF EXISTS audit_team_member ON team_member;
    DROP TRIGGER IF EXISTS journal_team_member ON team_member;
    DROP TRIGGER IF EXISTS audit_team_policy ON team_policy;
    DROP TRIGGER IF EXISTS journal_team_policy ON team_policy;

    --------------------------------------------------------------------------------
    -- Drop functions
    --------------------------------------------------------------------------------
    DROP FUNCTION IF EXISTS biohub.tr_policy_statement_urn_validation();
    DROP FUNCTION IF EXISTS biohub.tr_validate_policy_condition_key();
    DROP FUNCTION IF EXISTS biohub.tr_submission_feature_urn();

    --------------------------------------------------------------------------------
    -- Drop indexes on submission_feature table
    --------------------------------------------------------------------------------
    DROP INDEX IF EXISTS submission_feature_urn_idx;

    --------------------------------------------------------------------------------
    -- Remove URN column and constraint from submission_feature table
    --------------------------------------------------------------------------------
    ALTER TABLE submission_feature DROP CONSTRAINT IF EXISTS feature_urn_format_check;
    ALTER TABLE submission_feature DROP COLUMN IF EXISTS urn;

    --------------------------------------------------------------------------------
    -- Drop tables in reverse dependency order
    --------------------------------------------------------------------------------
    DROP TABLE IF EXISTS team_policy;
    DROP TABLE IF EXISTS team_member;
    DROP TABLE IF EXISTS policy_statement_condition;
    DROP TABLE IF EXISTS policy_statement;
    DROP TABLE IF EXISTS team;
    DROP TABLE IF EXISTS policy;

    --------------------------------------------------------------------------------
    -- Drop enum types
    --------------------------------------------------------------------------------
    DROP TYPE IF EXISTS policy_condition_operator;
    DROP TYPE IF EXISTS policy_effect;

  `);
}
