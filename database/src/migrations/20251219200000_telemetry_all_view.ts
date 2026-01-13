import { Knex } from 'knex';

/**
 * Creating a materialised view for telemetry_all.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE MATERIALIZED VIEW bcgw.telemetry_all AS
    SELECT
      sf.submission_feature_id,
      sf.uuid,
      sf.submission_id,
      sf.source_id,
      sf.data->>'device_id' as device_id,
      (sf.data->>'latitude')::numeric as latitude,
      (sf.data->>'longitude')::numeric as longitude,
      (sf.data->>'timestamp')::timestamptz as timestamp,
      (sf.data->>'dop')::numeric as dop,
      dep.data->>'device_key' as device_key,
      dep.data->>'animal_id' as animal_id
    FROM biohub.submission_feature sf
    JOIN biohub.feature_type ft ON sf.feature_type_id = ft.feature_type_id
    LEFT JOIN biohub.submission_feature dep ON dep.submission_feature_id = sf.parent_submission_feature_id
      AND dep.feature_type_id = (SELECT feature_type_id FROM biohub.feature_type WHERE name = 'telemetry_deployment')
    WHERE ft.name = 'telemetry'
      AND sf.record_end_date IS NULL
      AND (sf.data->>'timestamp')::timestamptz <= (NOW() - INTERVAL '4 months');
  `);
}

/**
 * Revert materialized view.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP MATERIALIZED VIEW IF EXISTS bcgw.telemetry_all;
  `);
}
