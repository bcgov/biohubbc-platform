export const OBSERVATIONS_BASE_QUERY = `
WITH candidate_features AS (
  SELECT DISTINCT source_submission_feature_id AS submission_feature_id
  FROM biohub.submission_feature_closure
),
feature_geometries AS (
  SELECT
    sf_geom.submission_feature_id,
    biohub.try_geom_from_geojson(
      CASE
        WHEN sf_geom.data->'geometry'->>'type' = 'FeatureCollection' THEN sf_geom.data #>> '{geometry,features,0,geometry}'
        WHEN sf_geom.data->'geometry'->>'type' = 'Feature' THEN sf_geom.data #>> '{geometry,geometry}'
        ELSE sf_geom.data->>'geometry'
      END
    ) AS geometry
  FROM biohub.submission_feature sf_geom
  JOIN candidate_features cf
    ON cf.submission_feature_id = sf_geom.submission_feature_id
  WHERE sf_geom.record_end_date IS NULL
),
feature_location_points AS (
  SELECT
    fg.submission_feature_id,
    CASE
      WHEN fg.geometry IS NULL THEN NULL
      WHEN public.ST_GeometryType(fg.geometry) = 'ST_Point' THEN fg.geometry
      WHEN public.ST_GeometryType(fg.geometry) = 'ST_LineString' THEN public.ST_StartPoint(fg.geometry)
      WHEN public.ST_GeometryType(fg.geometry) = 'ST_MultiLineString' THEN public.ST_StartPoint(public.ST_GeometryN(fg.geometry, 1))
      WHEN public.ST_GeometryType(fg.geometry) IN ('ST_Polygon', 'ST_MultiPolygon') THEN public.ST_Centroid(fg.geometry)
      ELSE public.ST_Centroid(fg.geometry)
    END AS location_point
  FROM feature_geometries fg
),
site_linked_observations AS (
  -- Observations whose closure reaches a sample_site via parent/property paths
  SELECT DISTINCT c.source_submission_feature_id AS submission_feature_id
  FROM biohub.submission_feature_closure c
  JOIN biohub.submission_feature sf_site
    ON sf_site.submission_feature_id = c.target_submission_feature_id
  JOIN biohub.feature_type ft_site
    ON sf_site.feature_type_id = ft_site.feature_type_id
  WHERE ft_site.name = 'sample_site'
    AND sf_site.record_end_date IS NULL
    AND sf_site.record_effective_date IS NOT NULL
    AND sf_site.record_effective_date <= NOW()::date
),
sample_site_locations AS (
  SELECT DISTINCT ON (c.source_submission_feature_id)
    c.source_submission_feature_id AS submission_feature_id,
    site_location.location_point
  FROM biohub.submission_feature_closure c
  JOIN biohub.submission_feature sf_site
    ON sf_site.submission_feature_id = c.target_submission_feature_id
  JOIN biohub.feature_type ft_site
    ON sf_site.feature_type_id = ft_site.feature_type_id
  JOIN feature_location_points site_location
    ON site_location.submission_feature_id = sf_site.submission_feature_id
  WHERE ft_site.name = 'sample_site'
    AND sf_site.record_end_date IS NULL
    AND sf_site.record_effective_date IS NOT NULL
    AND sf_site.record_effective_date <= NOW()::date
    AND site_location.location_point IS NOT NULL
  ORDER BY c.source_submission_feature_id, c.is_ancestor DESC, sf_site.submission_feature_id
),
observation_locations AS (
  SELECT
    sf_obs.submission_feature_id,
    COALESCE(
      CASE
        WHEN NULLIF(sf_obs.data->>'latitude', '') IS NOT NULL
          AND NULLIF(sf_obs.data->>'longitude', '') IS NOT NULL
          THEN public.ST_SetSRID(
            public.ST_MakePoint(
              (sf_obs.data->>'longitude')::double precision,
              (sf_obs.data->>'latitude')::double precision
            ),
            4326
          )
      END,
      observation_location.location_point,
      sample_site_locations.location_point
    ) AS location_point
  FROM biohub.submission_feature sf_obs
  JOIN candidate_features cf
    ON cf.submission_feature_id = sf_obs.submission_feature_id
  LEFT JOIN feature_location_points observation_location
    ON observation_location.submission_feature_id = sf_obs.submission_feature_id
  LEFT JOIN sample_site_locations
    ON sample_site_locations.submission_feature_id = sf_obs.submission_feature_id
  WHERE sf_obs.record_end_date IS NULL
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
JOIN candidate_features cf
  ON cf.submission_feature_id = sf.submission_feature_id
LEFT JOIN observation_subcounts parent_obs ON sf.submission_feature_id = parent_obs.parent_observation_id
LEFT JOIN biohub.submission_feature sf_subcount ON parent_obs.subcount_id = sf_subcount.submission_feature_id
LEFT JOIN submissions sub
  ON sub.submission_upload_id = COALESCE(sf_subcount.submission_upload_id, sf.submission_upload_id)
JOIN biohub.feature_type ft
  ON sf.feature_type_id = ft.feature_type_id
LEFT JOIN observation_locations ol
  ON ol.submission_feature_id = sf.submission_feature_id
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
  {taxonExclusionFilter}
  {securityFilter}
`;
