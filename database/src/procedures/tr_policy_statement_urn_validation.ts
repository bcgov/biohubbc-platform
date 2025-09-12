import { Knex } from 'knex';

/**
 * Creates a BEFORE INSERT trigger on policy_statement that validates:
 *   - The submission_id (parsed from feature_urn) exists in submission table
 *   - The feature_type exists in feature_type table
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path = 'biohub';

    --------------------------------------------------------------------------------
    -- Trigger Function: Validate feature_urn structure and referenced entities
    --------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION biohub.tr_validate_feature_urn_parts()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY invoker
    AS $function$
    DECLARE
      urn_parts TEXT[];
      submission_id INTEGER;
      feature_type TEXT;
    BEGIN
      -- Skip validation if wildcard is present
      IF POSITION('*' IN NEW.feature_urn) = 0 THEN
        -- Split the URN into parts: ['urn', submission_id, feature_type, feature_id]
        urn_parts := string_to_array(NEW.feature_urn, ':');

        IF array_length(urn_parts, 1) != 4 OR urn_parts[1] != 'urn' THEN
          RAISE EXCEPTION 'Invalid URN format: %', NEW.feature_urn;
        END IF;

        -- Parse parts
        submission_id := urn_parts[2]::INTEGER;
        feature_type := urn_parts[3];

        -- Validate submission exists
        IF NOT EXISTS (
          SELECT 1 FROM biohub.submission WHERE submission_id = submission_id
        ) THEN
          RAISE EXCEPTION 'Invalid feature_urn: submission ID % does not exist', submission_id;
        END IF;

        -- Validate feature_type exists
        IF NOT EXISTS (
          SELECT 1 FROM biohub.feature_type WHERE name = feature_type
        ) THEN
          RAISE EXCEPTION 'Invalid feature_urn: feature_type % does not exist', feature_type;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $function$;

    --------------------------------------------------------------------------------
    -- Trigger: BEFORE INSERT on policy_statement
    --------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS validate_feature_urn_parts_before_insert ON biohub.policy_statement;

    CREATE TRIGGER validate_feature_urn_parts_before_insert
    BEFORE INSERT ON biohub.policy_statement
    FOR EACH ROW
    EXECUTE FUNCTION biohub.tr_validate_feature_urn_parts();
  `);
}
