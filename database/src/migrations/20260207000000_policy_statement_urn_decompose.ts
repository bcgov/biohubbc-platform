import { Knex } from 'knex';

/**
 * Decompose policy_statement URN into indexed columns.
 *
 * Replaces runtime split_part() parsing in security authorization queries
 * with pre-decomposed columns, enabling indexed equality comparisons.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    -- Add decomposed URN columns
    ALTER TABLE policy_statement ADD COLUMN urn_submission_id varchar(20);
    ALTER TABLE policy_statement ADD COLUMN urn_feature_type varchar(100);
    ALTER TABLE policy_statement ADD COLUMN urn_feature_id varchar(20);

    COMMENT ON COLUMN policy_statement.urn_submission_id IS 'Decomposed submission_id segment from submission_feature_urn. Value is * for wildcard match.';
    COMMENT ON COLUMN policy_statement.urn_feature_type IS 'Decomposed feature_type_name segment from submission_feature_urn. Value is * for wildcard match.';
    COMMENT ON COLUMN policy_statement.urn_feature_id IS 'Decomposed submission_feature_id segment from submission_feature_urn. Value is * for wildcard match.';

    -- Trigger function to auto-populate decomposed columns from URN
    CREATE OR REPLACE FUNCTION tr_policy_statement_urn_decompose()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    DECLARE
      urn_parts TEXT[];
    BEGIN
      urn_parts := string_to_array(NEW.submission_feature_urn, ':');
      NEW.urn_submission_id := urn_parts[2];
      NEW.urn_feature_type := urn_parts[3];
      NEW.urn_feature_id := urn_parts[4];
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER tr_policy_statement_urn_decompose
      BEFORE INSERT OR UPDATE OF submission_feature_urn ON policy_statement
      FOR EACH ROW
      EXECUTE FUNCTION tr_policy_statement_urn_decompose();

    -- Backfill existing rows
    UPDATE policy_statement SET
      urn_submission_id = split_part(submission_feature_urn, ':', 2),
      urn_feature_type = split_part(submission_feature_urn, ':', 3),
      urn_feature_id = split_part(submission_feature_urn, ':', 4);

    -- Make columns NOT NULL after backfill
    ALTER TABLE policy_statement ALTER COLUMN urn_submission_id SET NOT NULL;
    ALTER TABLE policy_statement ALTER COLUMN urn_feature_type SET NOT NULL;
    ALTER TABLE policy_statement ALTER COLUMN urn_feature_id SET NOT NULL;

    -- Indexes for the security query joins
    CREATE INDEX policy_statement_urn_submission_id_idx ON policy_statement(urn_submission_id);
    CREATE INDEX policy_statement_urn_feature_type_idx ON policy_statement(urn_feature_type);
    CREATE INDEX policy_statement_urn_feature_id_idx ON policy_statement(urn_feature_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS tr_policy_statement_urn_decompose ON policy_statement;
    DROP FUNCTION IF EXISTS tr_policy_statement_urn_decompose();
    DROP INDEX IF EXISTS policy_statement_urn_submission_id_idx;
    DROP INDEX IF EXISTS policy_statement_urn_feature_type_idx;
    DROP INDEX IF EXISTS policy_statement_urn_feature_id_idx;
    ALTER TABLE policy_statement DROP COLUMN IF EXISTS urn_submission_id;
    ALTER TABLE policy_statement DROP COLUMN IF EXISTS urn_feature_type;
    ALTER TABLE policy_statement DROP COLUMN IF EXISTS urn_feature_id;
  `);
}
