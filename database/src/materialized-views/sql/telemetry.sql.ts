export const TELEMETRY_BASE_QUERY = `
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
      AND dep.record_effective_date IS NOT NULL
      AND dep.record_effective_date <= NOW()::date
),

related_features AS (
    SELECT
        sff.source_feature_id AS deployment_id,
        sff.target_feature_id AS related_feature_id
    FROM biohub.submission_feature_feature sff
    JOIN deployments d
      ON sff.source_feature_id = d.submission_feature_id

    UNION

    SELECT
        sff.target_feature_id AS deployment_id,
        sff.source_feature_id AS related_feature_id
    FROM biohub.submission_feature_feature sff
    JOIN deployments d
      ON sff.target_feature_id = d.submission_feature_id
),

related_animals AS (
    SELECT
        rf.deployment_id,
        sf.submission_feature_id AS animal_feature_id,
        sf.parent_submission_feature_id AS dataset_submission_feature_id,
        sf.data->>'taxon_id' AS taxon_id,
        COALESCE(ccc.label, sf.data->>'sex') AS sex,
        sf.data->>'animal_identifier' AS animal_identifier
    FROM related_features rf
    JOIN biohub.submission_feature sf
      ON sf.submission_feature_id = rf.related_feature_id
    JOIN biohub.feature_type ft_animal
      ON sf.feature_type_id = ft_animal.feature_type_id
    LEFT JOIN biohub.contributor_codeset_code ccc
      ON (sf.data->>'sex')::int = ccc.contributor_codeset_code_id
    WHERE ft_animal.name = 'animal'
      AND sf.record_end_date IS NULL
      AND sf.record_effective_date IS NOT NULL
      AND sf.record_effective_date <= NOW()::date
),

submissions AS (
    SELECT
        su.submission_upload_id,
        su.submission_id,
        s.name AS submission_name
    FROM biohub.submission_upload su
    JOIN biohub.submission s ON su.submission_id = s.submission_id
    WHERE su.record_end_date IS NULL
      AND su.record_effective_date IS NOT NULL
      AND su.record_effective_date <= NOW()::date
),

related_ecological_units AS (
    SELECT
        deployment_id,
        string_agg(DISTINCT ecological_unit_value, ';' ORDER BY ecological_unit_value) AS ecological_unit_value
    FROM (
        -- Ecological units linked to animals via submission_feature_feature
        SELECT
            ra.deployment_id,
            sf_eu.data->>'ecological_unit_value' AS ecological_unit_value
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
          AND sf_eu.record_effective_date <= NOW()::date

        UNION

        -- Ecological units with animal as parent
        SELECT
            ra.deployment_id,
            sf_eu.data->>'ecological_unit_value' AS ecological_unit_value
        FROM related_animals ra
        JOIN biohub.submission_feature sf_eu
          ON sf_eu.parent_submission_feature_id = ra.animal_feature_id
        JOIN biohub.feature_type ft_eu
          ON sf_eu.feature_type_id = ft_eu.feature_type_id
          AND ft_eu.name = 'ecological_unit'
        WHERE sf_eu.record_end_date IS NULL
          AND sf_eu.record_effective_date IS NOT NULL
          AND sf_eu.record_effective_date <= NOW()::date
    ) AS combined_ecological_units
    GROUP BY deployment_id
)

SELECT
    {columns}
FROM biohub.submission_feature sf
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

LEFT JOIN biohub.taxon t
  ON t.itis_tsn = ra.taxon_id::int

WHERE ft.name = 'telemetry'
  AND sf.record_end_date IS NULL
  AND sf.record_effective_date IS NOT NULL
  AND sf.record_effective_date <= NOW()::date
  AND (sf.data->>'timestamp')::timestamptz <= (NOW() - INTERVAL '3 months')
  {securityFilter}
`;
