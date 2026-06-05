export const OBSERVATIONS_BASE_QUERY = `
WITH site_linked_observations AS (
  SELECT DISTINCT sf.submission_feature_id
  FROM biohub.submission_feature sf
  WHERE sf.parent_submission_feature_id IS NOT NULL
    AND sf.record_effective_date IS NOT NULL
    AND sf.record_effective_date <= NOW()::date
    AND sf.parent_submission_feature_id IN (
      SELECT submission_feature_id
      FROM biohub.submission_feature sf_parent
      JOIN biohub.feature_type ft_parent ON sf_parent.feature_type_id = ft_parent.feature_type_id
      WHERE ft_parent.name = 'sample_site' AND sf_parent.record_end_date IS NULL
        AND sf_parent.record_effective_date IS NOT NULL
        AND sf_parent.record_effective_date <= NOW()::date
    )

  UNION
  SELECT DISTINCT sf.submission_feature_id
  FROM biohub.submission_feature sf
  JOIN biohub.submission_feature_feature sff ON (
    sff.source_feature_id = sf.submission_feature_id OR sff.target_feature_id = sf.submission_feature_id
  )
  JOIN biohub.submission_feature sf_site ON (
    (sff.source_feature_id = sf_site.submission_feature_id AND sff.target_feature_id = sf.submission_feature_id)
    OR
    (sff.target_feature_id = sf_site.submission_feature_id AND sff.source_feature_id = sf.submission_feature_id)
  )
  JOIN biohub.feature_type ft_site ON sf_site.feature_type_id = ft_site.feature_type_id
  WHERE ft_site.name = 'sample_site' AND sf_site.record_end_date IS NULL
    AND sf.record_effective_date IS NOT NULL
    AND sf.record_effective_date <= NOW()::date
    AND sf_site.record_effective_date IS NOT NULL
    AND sf_site.record_effective_date <= NOW()::date
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
observation_subcounts AS (
  -- Link parent observations to their subcounts via submission_feature_feature
  SELECT DISTINCT
    sff.source_feature_id AS parent_observation_id,
    sff.target_feature_id AS subcount_id
  FROM biohub.submission_feature_feature sff
  JOIN biohub.submission_feature sf_parent ON sff.source_feature_id = sf_parent.submission_feature_id
  JOIN biohub.submission_feature sf_subcount ON sff.target_feature_id = sf_subcount.submission_feature_id
  JOIN biohub.feature_type ft_parent ON sf_parent.feature_type_id = ft_parent.feature_type_id
  JOIN biohub.feature_type ft_subcount ON sf_subcount.feature_type_id = ft_subcount.feature_type_id
  WHERE ft_parent.name = 'species_observation'
    AND ft_subcount.name = 'species_observation'
    AND sf_parent.data::text LIKE '%subcount%' IS FALSE  -- parent doesn't have subcount_ fields
    AND sf_subcount.data::text LIKE '%subcount%'  -- subcount has subcount_ fields
    AND sf_parent.record_effective_date IS NOT NULL
    AND sf_parent.record_effective_date <= NOW()::date
    AND sf_subcount.record_effective_date IS NOT NULL
    AND sf_subcount.record_effective_date <= NOW()::date
)
SELECT
    {columns}
FROM biohub.submission_feature sf
LEFT JOIN observation_subcounts parent_obs ON sf.submission_feature_id = parent_obs.parent_observation_id
LEFT JOIN biohub.submission_feature sf_subcount ON parent_obs.subcount_id = sf_subcount.submission_feature_id
LEFT JOIN submissions sub
  ON sub.submission_upload_id = COALESCE(sf_subcount.submission_upload_id, sf.submission_upload_id)
JOIN biohub.feature_type ft
  ON sf.feature_type_id = ft.feature_type_id
LEFT JOIN biohub.taxon t
  ON t.itis_tsn = (COALESCE(sf_subcount.data->>'taxon_id', sf.data->>'taxon_id'))::int
LEFT JOIN biohub.contributor_codeset_code ccc_sex
  ON (COALESCE(sf_subcount.data->>'sex', sf.data->>'sex'))::int = ccc_sex.contributor_codeset_code_id
LEFT JOIN biohub.contributor_codeset_code ccc_life_stage
  ON (COALESCE(sf_subcount.data->>'life_stage', sf.data->>'life_stage'))::int = ccc_life_stage.contributor_codeset_code_id
WHERE ft.name = 'species_observation'
  AND sf.record_end_date IS NULL
  AND sf.record_effective_date IS NOT NULL
  AND sf.record_effective_date <= NOW()::date
  {siteFilter}
  {securityFilter}
`;
