import { Knex } from 'knex';

/**
 * Creating materialised views for telemetry and observations datasets to be replicated in the BC Geographic Warehouse.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
CREATE MATERIALIZED VIEW bcgw.telemetry_all AS
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
    (sf.data->>'dop')::numeric AS dop,
    CASE
      WHEN sf.submission_feature_id IN (
        SELECT submission_feature_id
        FROM biohub.submission_feature_security
      ) THEN 'Secured'
      ELSE 'Open'
    END AS SECURITY
    -- contingent on feature array: join to dataset and get the survey name and id, and the study area id
FROM biohub.submission_feature sf
JOIN biohub.feature_type ft
  ON sf.feature_type_id = ft.feature_type_id
LEFT JOIN deployments d
  ON d.submission_feature_id = sf.parent_submission_feature_id
WHERE ft.name = 'telemetry'
  AND sf.record_end_date IS NULL
  AND (sf.data->>'timestamp')::timestamptz <= (NOW() - INTERVAL '4 months');
  `);

  await knex.raw(`
    COMMENT ON COLUMN bcgw.telemetry_all.Feature_ID IS 'System generated surrogate primary key identifier';
    COMMENT ON COLUMN bcgw.telemetry_all.Latitude IS 'The latitude of the GPS location';
    COMMENT ON COLUMN bcgw.telemetry_all.Longitude IS 'The longitude of the GPS location';
    COMMENT ON COLUMN bcgw.telemetry_all.DATETIME IS 'The date and time that the GPS location was recorded';
    COMMENT ON COLUMN bcgw.telemetry_all.YEAR IS 'The year that the GPS location was recorded';
    COMMENT ON COLUMN bcgw.telemetry_all.dop IS 'The dilution of precision';
    COMMENT ON COLUMN bcgw.telemetry_all.device_key IS 'The vendor and device serial';
    COMMENT ON COLUMN bcgw.telemetry_all.animal_id IS 'The identifier of the animal wearing the telemetry device';
    COMMENT ON COLUMN bcgw.telemetry_all.SECURITY IS 'The security status of the feature';
  `);

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

  await knex.raw(`
CREATE MATERIALIZED VIEW bcgw.observations_public AS
WITH measurements AS (
    SELECT
        m.parent_submission_feature_id   AS observation_id,
        (m.data->>'sex')::text           AS sex,
        (m.data->>'life_stage')::text    AS life_stage,
        (m.data->>'measurement_type')::text   AS measurement_type,
        (m.data->>'measurement_value')::text  AS measurement_value
    FROM biohub.submission_feature m
    JOIN biohub.feature_type ft_m
      ON m.feature_type_id = ft_m.feature_type_id
    WHERE ft_m.name = 'measurement'
      AND m.record_end_date IS NULL
)
SELECT
    sf.submission_feature_id AS Feature_ID,
    (sf.data->>'timestamp')::timestamptz AS DATETIME,
    (EXTRACT(YEAR FROM (sf.data->>'timestamp')::timestamptz))::int AS YEAR,
    public.ST_Y(public.ST_GeomFromGeoJSON(sf.data->>'geometry')) AS Latitude,
    public.ST_X(public.ST_GeomFromGeoJSON(sf.data->>'geometry')) AS Longitude,
    (sf.data->>'sign')::text AS sign,
    (sf.data->>'count')::int AS count,
    (sf.data->>'taxon_id')::int AS taxon_id,
    t.itis_scientific_name AS scientific_name,
    t.common_name AS common_name,
    meas.sex,
    meas.life_stage
FROM biohub.submission_feature sf
JOIN biohub.feature_type ft
  ON sf.feature_type_id = ft.feature_type_id
LEFT JOIN measurements meas
  ON meas.observation_id = sf.submission_feature_id
LEFT JOIN biohub.taxon t
  ON t.itis_tsn = (sf.data->>'taxon_id')::int
WHERE ft.name = 'species_observation'
  AND sf.record_end_date IS NULL
  AND sf.submission_feature_id NOT IN (
        SELECT submission_feature_id
        FROM biohub.submission_feature_security
      );
  `);

  await knex.raw(`
    COMMENT ON COLUMN bcgw.observations_public.Feature_ID IS 'System generated surrogate primary key identifier';
    COMMENT ON COLUMN bcgw.observations_public.Latitude IS 'The latitude of the observation location';
    COMMENT ON COLUMN bcgw.observations_public.Longitude IS 'The longitude of the observation location';
    COMMENT ON COLUMN bcgw.observations_public.DATETIME IS 'The timestamp of the observation';
    COMMENT ON COLUMN bcgw.observations_public.YEAR IS 'The year of the observation';
    COMMENT ON COLUMN bcgw.observations_public.sign IS 'Type of sign associated with the observation';
    COMMENT ON COLUMN bcgw.observations_public.count IS 'Count value for the observation';
    COMMENT ON COLUMN bcgw.observations_public.taxon_id IS 'Taxonomic identifier extracted from the observation payload';
    COMMENT ON COLUMN bcgw.observations_public.scientific_name IS 'Scientific name from taxon table linked via ITIS TSN';
    COMMENT ON COLUMN bcgw.observations_public.common_name IS 'Common name from taxon table linked via ITIS TSN';
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
  await knex.raw(`
    DROP MATERIALIZED VIEW IF EXISTS bcgw.telemetry_public;
  `);
  await knex.raw(`
    DROP MATERIALIZED VIEW IF EXISTS bcgw.observations_public;
  `);
}
