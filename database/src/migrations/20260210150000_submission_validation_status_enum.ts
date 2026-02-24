import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- SUBMISSION_VALIDATION_STATUS ENUM
    --------------------------------------------------------------------------------

    -- Validation status lifecycle for submission processing
    CREATE TYPE submission_validation_status AS ENUM (
      'pending',    -- Queued but not started
      'started',    -- Processing in progress
      'completed',  -- Successfully processed
      'invalid',    -- Validation failed (bad data)
      'failed'      -- System error during processing
    );

    --------------------------------------------------------------------------------
    -- CONVERT COLUMN TYPE
    --------------------------------------------------------------------------------

    -- Drop DEFAULT before type conversion (DEFAULT 'pending' can't auto-cast to ENUM)
    ALTER TABLE submission_validation
      ALTER COLUMN status DROP DEFAULT;

    -- Convert status from VARCHAR to ENUM
    ALTER TABLE submission_validation
      ALTER COLUMN status TYPE submission_validation_status
      USING status::submission_validation_status;

    -- Re-add DEFAULT using ENUM value
    ALTER TABLE submission_validation
      ALTER COLUMN status SET DEFAULT 'pending'::submission_validation_status;

    -- Drop CHECK constraint (ENUM provides type safety)
    ALTER TABLE submission_validation
      DROP CONSTRAINT IF EXISTS submission_validation_status_check;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    -- Revert to VARCHAR with CHECK constraint
    ALTER TABLE submission_validation
      ALTER COLUMN status DROP DEFAULT;

    ALTER TABLE submission_validation
      ALTER COLUMN status TYPE VARCHAR(20)
      USING status::text;

    ALTER TABLE submission_validation
      ALTER COLUMN status SET DEFAULT 'pending';

    ALTER TABLE submission_validation
      ADD CONSTRAINT submission_validation_status_check
        CHECK (status IN ('pending', 'started', 'completed', 'invalid', 'failed'));

    DROP TYPE IF EXISTS submission_validation_status;
  `);
}
