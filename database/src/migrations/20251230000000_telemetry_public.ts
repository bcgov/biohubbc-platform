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
        dep.data->>'animal_identifier' AS animal_id
    FROM biohub.submission_feature dep
    JOIN biohub.feature_type ft_dep
      ON dep.feature_type_id = ft_dep.feature_type_id
    WHERE ft_dep.name = 'telemetry_deployment'
      AND dep.record_end_date IS NULL
)
SELECT
    sf.submission_feature_id AS Feature_ID,
    d.animal_id,
    -- Contingent on Feature Array: Add columns Species Code, Species english name, species scientific name, Sex, Ecological Unit
    d.device_key,
    (sf.data->>'timestamp')::timestamptz AS DATETIME,
    (EXTRACT(YEAR FROM (sf.data->>'timestamp')::timestamptz))::int AS YEAR,
    (sf.data->>'latitude')::numeric AS Latitude,
    (sf.data->>'longitude')::numeric AS Longitude,
    (sf.data->>'dop')::numeric AS dop
      -- contingent on feature array: join to dataset and get the survey name and id, and the study area id
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

  await knex.raw(`
    COMMENT ON COLUMN bcgw.telemetry_public.Feature_ID IS 'System generated surrogate primary key identifier';
    COMMENT ON COLUMN bcgw.telemetry_public.Latitude IS 'The latitude of the GPS location';
    COMMENT ON COLUMN bcgw.telemetry_public.Longitude IS 'The longitude of the GPS location';
    COMMENT ON COLUMN bcgw.telemetry_public.DATETIME IS 'The date and time that the GPS location was recorded';
    COMMENT ON COLUMN bcgw.telemetry_public.YEAR IS 'The year that the GPS location was recorded';
    COMMENT ON COLUMN bcgw.telemetry_public.dop IS 'The dilution of precision';
    COMMENT ON COLUMN bcgw.telemetry_public.device_key IS 'The vendor and device serial';
    COMMENT ON COLUMN bcgw.telemetry_public.animal_id IS 'The identifier of the animal wearing the telemetry device';
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
