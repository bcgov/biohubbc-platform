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
CREATE MATERIALIZED VIEW bcgw.telemetry_public AS
WITH deployments AS (
    SELECT
        dep.submission_feature_id,
        dep.data->>'device_key' AS device_key,
        dep.data->>'animal_id' AS animal_id
    FROM biohub.submission_feature dep
    JOIN biohub.feature_type ft_dep
      ON dep.feature_type_id = ft_dep.feature_type_id
    WHERE ft_dep.name = 'telemetry_deployment'
      AND dep.record_end_date IS NULL
)
SELECT
    sf.submission_feature_id,
    sf.uuid,
    sf.submission_id,
    sf.source_id,
    sf.data->>'device_id' AS device_id,
    (sf.data->>'latitude')::numeric AS latitude,
    (sf.data->>'longitude')::numeric AS longitude,
    (sf.data->>'timestamp')::timestamptz AS timestamp,
    (sf.data->>'dop')::numeric AS dop,
    d.device_key,
    d.animal_id
FROM biohub.submission_feature sf
JOIN biohub.feature_type ft
  ON sf.feature_type_id = ft.feature_type_id
LEFT JOIN deployments d
  ON d.submission_feature_id = sf.parent_submission_feature_id
WHERE ft.name = 'telemetry'
  AND sf.record_end_date IS NULL
  AND sf.submission_feature_id NOT IN (
        SELECT submission_feature_id
        FROM biohub.submission_feature_security
      )
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
    DROP MATERIALIZED VIEW IF EXISTS bcgw.telemetry_public;
  `);
}
