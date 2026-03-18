import type { Knex } from 'knex';

/**
 * Split submission_feature_property_timestamp.value into date_value and time_value.
 *
 * Rules:
 * - Keep existing rows by backfilling from value.
 * - Enforce that at least one of (date_value, time_value) is present.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- Add split columns
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_feature_property_timestamp
      ADD COLUMN date_value date,
      ADD COLUMN time_value time;

    ----------------------------------------------------------------------------------------
    -- Backfill from existing timestamp column
    ----------------------------------------------------------------------------------------
    UPDATE submission_feature_property_timestamp
    SET
      date_value = value::date,
      time_value = value::time
    WHERE value IS NOT NULL;

    ----------------------------------------------------------------------------------------
    -- Rebuild indexes for split columns
    ----------------------------------------------------------------------------------------
    DROP INDEX IF EXISTS submission_feature_property_timestamp_idx3;

    CREATE INDEX submission_feature_property_timestamp_idx3
      ON submission_feature_property_timestamp(date_value);

    CREATE INDEX submission_feature_property_timestamp_idx4
      ON submission_feature_property_timestamp(time_value);

    ----------------------------------------------------------------------------------------
    -- Enforce at least one of date/time is present, then drop old column
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_feature_property_timestamp
      ADD CONSTRAINT submission_feature_property_timestamp_ck1
      CHECK (date_value IS NOT NULL OR time_value IS NOT NULL);

    ALTER TABLE submission_feature_property_timestamp
      DROP COLUMN value;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- Restore single timestamp column
    ----------------------------------------------------------------------------------------
    ALTER TABLE submission_feature_property_timestamp
      ADD COLUMN value timestamptz(6);

    UPDATE submission_feature_property_timestamp
    SET value = CASE
      WHEN date_value IS NOT NULL AND time_value IS NOT NULL THEN
        (date_value::text || ' ' || time_value::text)::timestamptz
      WHEN date_value IS NOT NULL THEN
        date_value::timestamptz
      ELSE
        (CURRENT_DATE::text || ' ' || time_value::text)::timestamptz
    END;

    ALTER TABLE submission_feature_property_timestamp
      ALTER COLUMN value SET NOT NULL;

    ----------------------------------------------------------------------------------------
    -- Restore original index and drop split-column artifacts
    ----------------------------------------------------------------------------------------
    DROP INDEX IF EXISTS submission_feature_property_timestamp_idx4;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_idx3;

    CREATE INDEX submission_feature_property_timestamp_idx3
      ON submission_feature_property_timestamp(value);

    ALTER TABLE submission_feature_property_timestamp
      DROP CONSTRAINT IF EXISTS submission_feature_property_timestamp_ck1;

    ALTER TABLE submission_feature_property_timestamp
      DROP COLUMN date_value,
      DROP COLUMN time_value;
  `);
}
