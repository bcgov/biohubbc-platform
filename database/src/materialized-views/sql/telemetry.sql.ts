export const TELEMETRY_BASE_QUERY = `
WITH candidate_features AS (
    SELECT DISTINCT source_submission_feature_id AS submission_feature_id
    FROM biohub.submission_feature_closure
),

deployments AS (
    SELECT
        dep.submission_feature_id,
        dep.submission_upload_id,
        dep.parent_submission_feature_id AS survey_submission_feature_id,
        dep.data#>>'{properties,device_key}' AS device_key,
        dep.data#>>'{properties,animal_identifier}' AS animal_id
    FROM biohub.submission_feature dep
    JOIN candidate_features cf
      ON cf.submission_feature_id = dep.submission_feature_id
    JOIN biohub.feature_type ft_dep
      ON dep.feature_type_id = ft_dep.feature_type_id
    WHERE ft_dep.name = 'telemetry_deployment'
      AND dep.record_end_date IS NULL
      AND dep.record_effective_date IS NOT NULL
      AND dep.record_effective_date <= NOW()
),

telemetry_locations AS (
    SELECT
        sf_telemetry.submission_feature_id,
        biohub.try_geom_from_geojson(
          CASE
            WHEN sf_telemetry.data#>>'{properties,geometry,type}' = 'FeatureCollection'
              THEN sf_telemetry.data#>>'{properties,geometry,features,0,geometry}'
            WHEN sf_telemetry.data#>>'{properties,geometry,type}' = 'Feature'
              THEN sf_telemetry.data#>>'{properties,geometry,geometry}'
            ELSE sf_telemetry.data#>>'{properties,geometry}'
          END
        ) AS geometry
    FROM biohub.submission_feature sf_telemetry
    JOIN candidate_features cf
      ON cf.submission_feature_id = sf_telemetry.submission_feature_id
),

related_animals AS (
    SELECT
        d.submission_feature_id AS deployment_id,
        sf.submission_feature_id AS animal_feature_id,
        sf.parent_submission_feature_id AS dataset_submission_feature_id,
        sf.data#>>'{properties,taxon_id}' AS taxon_id,
        COALESCE(ccc.label, sf.data#>>'{properties,sex}') AS sex,
        sf.data#>>'{properties,animal_identifier}' AS animal_identifier
    FROM deployments d
    JOIN biohub.submission_feature sf
      ON sf.submission_upload_id = d.submission_upload_id
      AND sf.parent_submission_feature_id = d.survey_submission_feature_id
      AND sf.data#>>'{properties,animal_identifier}' = d.animal_id
    JOIN biohub.feature_type ft_animal
      ON sf.feature_type_id = ft_animal.feature_type_id
    LEFT JOIN biohub.contributor_codeset_code ccc
      ON CASE
        WHEN sf.data#>>'{properties,sex}' ~ '^\d+$'
          THEN (sf.data#>>'{properties,sex}')::int
      END = ccc.contributor_codeset_code_id
    WHERE ft_animal.name = 'animal'
      AND sf.record_end_date IS NULL
      AND sf.record_effective_date IS NOT NULL
      AND sf.record_effective_date <= NOW()
),

submissions AS (
    SELECT
        su.submission_upload_id,
        su.submission_id,
        s.name AS submission_name
    FROM biohub.submission_upload su
    JOIN biohub.submission s ON su.submission_id = s.submission_id
    WHERE su.record_end_date IS NULL
),

related_ecological_units AS (
    SELECT
        deployment_id,
        string_agg(DISTINCT ecological_unit, ';' ORDER BY ecological_unit) AS ecological_unit
    FROM (
        -- Ecological units linked directly to animals via submission_feature_feature
        SELECT
            ra.deployment_id,
            (sf_eu.data#>>'{properties,ecological_unit_type}') || '::' || (sf_eu.data#>>'{properties,ecological_unit_value}') AS ecological_unit
        FROM related_animals ra
        JOIN biohub.submission_feature_feature sff
          ON (sff.source_feature_id = ra.animal_feature_id AND sff.target_feature_id != ra.animal_feature_id)
          OR (sff.target_feature_id = ra.animal_feature_id AND sff.source_feature_id != ra.animal_feature_id)
        JOIN biohub.submission_feature sf_eu
          ON (sff.source_feature_id = sf_eu.submission_feature_id OR sff.target_feature_id = sf_eu.submission_feature_id)
        JOIN biohub.feature_type ft_eu
          ON sf_eu.feature_type_id = ft_eu.feature_type_id
          AND ft_eu.name = 'ecological_unit'
        WHERE sf_eu.record_end_date IS NULL
          AND sf_eu.record_effective_date IS NOT NULL
          AND sf_eu.record_effective_date <= NOW()

        UNION

        -- Ecological units with animal as parent
        SELECT
            ra.deployment_id,
            (sf_eu.data#>>'{properties,ecological_unit_type}') || '::' || (sf_eu.data#>>'{properties,ecological_unit_value}') AS ecological_unit
        FROM related_animals ra
        JOIN biohub.submission_feature sf_eu
          ON sf_eu.parent_submission_feature_id = ra.animal_feature_id
        JOIN biohub.feature_type ft_eu
          ON sf_eu.feature_type_id = ft_eu.feature_type_id
          AND ft_eu.name = 'ecological_unit'
        WHERE sf_eu.record_end_date IS NULL
          AND sf_eu.record_effective_date IS NOT NULL
          AND sf_eu.record_effective_date <= NOW()
    ) AS combined_ecological_units
    GROUP BY deployment_id
)

SELECT
    {columns}
FROM biohub.submission_feature sf
JOIN candidate_features cf
  ON cf.submission_feature_id = sf.submission_feature_id
JOIN biohub.feature_type ft
  ON sf.feature_type_id = ft.feature_type_id

LEFT JOIN deployments d
  ON d.submission_feature_id = sf.parent_submission_feature_id

LEFT JOIN related_animals ra
  ON ra.deployment_id = d.submission_feature_id

LEFT JOIN submissions s
  ON s.submission_upload_id = sf.submission_upload_id

LEFT JOIN related_ecological_units reu
  ON reu.deployment_id = d.submission_feature_id

LEFT JOIN telemetry_locations tl
  ON tl.submission_feature_id = sf.submission_feature_id

LEFT JOIN biohub.taxon t
  ON t.itis_tsn = ra.taxon_id::int

WHERE ft.name = 'telemetry'
  AND sf.record_end_date IS NULL
  AND sf.record_effective_date IS NOT NULL
  AND sf.record_effective_date <= NOW()
  AND (sf.data#>>'{properties,timestamp}')::timestamptz <= (NOW() - INTERVAL '3 months')
  {taxonExclusionFilter}
  {securityFilter}
`;
