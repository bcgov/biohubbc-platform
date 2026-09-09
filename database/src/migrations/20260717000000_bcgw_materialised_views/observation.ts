import { MaterialisedViewColumn, MaterialisedViewCommentMap } from './types';

export const OBSERVATION_COLUMNS: MaterialisedViewColumn[] = [
  { alias: 'Feature_ID', expression: 'sf.submission_feature_id' },
  { alias: 'taxon_id', expression: "(sf.data#>>'{properties,taxon_id}')::int" },
  { alias: 'scientific_name', expression: 't.itis_scientific_name' },
  { alias: 'common_name', expression: 't.common_name' },
  { alias: 'sign', expression: "COALESCE(ccc_sign.label, (sf.data#>>'{properties,sign}')::text)" },
  {
    alias: 'group_id',
    expression:
      "CASE WHEN NULLIF(sf.data#>>'{properties,observation_id}', '') IS NULL THEN NULL ELSE sub.contributor_client_id || '::' || (sf.data#>>'{properties,observation_id}') END"
  },
  { alias: 'sex', expression: "COALESCE(ccc_sex.label, (sf.data#>>'{properties,sex}')::text)" },
  {
    alias: 'life_stage',
    expression: "COALESCE(ccc_life_stage.label, (sf.data#>>'{properties,life_stage}')::text)"
  },
  {
    alias: 'count',
    expression: "COALESCE((sf.data#>>'{properties,subcount_count}')::int, (sf.data#>>'{properties,count}')::int)"
  },
  {
    alias: 'date',
    expression:
      "(CASE WHEN NULLIF(sf.data#>>'{properties,timestamp}', '') IS NULL THEN spst.start_timestamp ELSE (sf.data#>>'{properties,timestamp}')::timestamptz END)::date"
  },
  {
    alias: 'time',
    expression:
      "(CASE WHEN NULLIF(sf.data#>>'{properties,timestamp}', '') IS NULL THEN spst.start_timestamp ELSE (sf.data#>>'{properties,timestamp}')::timestamptz END)::time"
  },
  {
    alias: 'YEAR',
    expression:
      "EXTRACT(YEAR FROM (CASE WHEN NULLIF(sf.data#>>'{properties,timestamp}', '') IS NULL THEN spst.start_timestamp ELSE (sf.data#>>'{properties,timestamp}')::timestamptz END))::int"
  },
  { alias: 'Latitude', expression: 'public.ST_Y(ol.location_point)' },
  { alias: 'Longitude', expression: 'public.ST_X(ol.location_point)' },
  { alias: 'submission_id', expression: 'sub.submission_id' },
  { alias: 'submission_name', expression: 'sub.submission_name' },
  { alias: 'SECURED', expression: '{securedColumn}' },
  {
    alias: 'source',
    expression:
      "'https://biodiversityhub.gov.bc.ca/submission/' || sf.submission_id || '/feature/' || sf.submission_feature_id"
  }
];

export const OBSERVATION_COMMENTS: MaterialisedViewCommentMap = {
  Feature_ID: 'System generated surrogate primary key identifier',
  taxon_id: 'Taxonomic identifier of the observed species',
  scientific_name: 'Scientific name of the observed species',
  common_name: 'Common name of the observed species',
  sign: 'Sign used to make the observation',
  group_id: 'Group identifier shared by species observations collected together',
  sex: 'Sex label from contributor codeset',
  life_stage: 'Life stage label from contributor codeset',
  count: 'Count value for the observation',
  date: 'The date portion of the observation timestamp',
  time: 'The time portion of the observation timestamp',
  YEAR: 'The year of the observation',
  Latitude: 'The latitude of the observation location',
  Longitude: 'The longitude of the observation location',
  submission_id: 'Submission identifier under which the feature was submitted',
  submission_name: 'Submission name under which the feature was submitted',
  SECURED: 'The indicator of whether the feature is secured (Y) or not (N)',
  source: 'A hyperlink to the source feature in the Biodiversity Hub portal'
};

export const OBSERVATION_QUERY = `
WITH
-- 1. Limit processing to features represented in the closure table.
candidates AS (
  SELECT DISTINCT source_submission_feature_id AS submission_feature_id
  FROM biohub.submission_feature_closure
),

-- 2. Resolve observation-specific geometry, sites, periods, and submission metadata.
feature_geometries AS (
  SELECT
    sf_geom.submission_feature_id,
    biohub.try_geom_from_geojson(
      CASE
        WHEN sf_geom.data#>>'{properties,geometry,type}' = 'FeatureCollection' THEN sf_geom.data #>> '{properties,geometry,features,0,geometry}'
        WHEN sf_geom.data#>>'{properties,geometry,type}' = 'Feature' THEN sf_geom.data #>> '{properties,geometry,geometry}'
        ELSE sf_geom.data#>>'{properties,geometry}'
      END
    ) AS geometry
  FROM biohub.submission_feature sf_geom
  JOIN candidates cf
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
    AND sf_site.record_effective_date <= NOW()
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
    AND sf_site.record_effective_date <= NOW()
    AND site_location.location_point IS NOT NULL
  ORDER BY c.source_submission_feature_id, c.is_ancestor DESC, sf_site.submission_feature_id
),
sample_period_start_timestamps AS (
  SELECT DISTINCT ON (c.source_submission_feature_id)
    c.source_submission_feature_id AS submission_feature_id,
    NULLIF(sf_sample_period.data#>>'{properties,start_date}', '')::timestamptz AS start_timestamp
  FROM biohub.submission_feature_closure c
  JOIN biohub.submission_feature sf_sample_period
    ON sf_sample_period.submission_feature_id = c.target_submission_feature_id
  JOIN biohub.feature_type ft_sample_period
    ON sf_sample_period.feature_type_id = ft_sample_period.feature_type_id
  WHERE ft_sample_period.name = 'sample_period'
    AND sf_sample_period.record_end_date IS NULL
    AND sf_sample_period.record_effective_date IS NOT NULL
    AND sf_sample_period.record_effective_date <= NOW()
    AND NULLIF(sf_sample_period.data#>>'{properties,start_date}', '') IS NOT NULL
  ORDER BY c.source_submission_feature_id, c.is_ancestor DESC, sf_sample_period.submission_feature_id
),
observation_locations AS (
  SELECT
    sf_obs.submission_feature_id,
    COALESCE(
      CASE
        WHEN NULLIF(sf_obs.data#>>'{properties,latitude}', '') IS NOT NULL
          AND NULLIF(sf_obs.data#>>'{properties,longitude}', '') IS NOT NULL
          THEN public.ST_SetSRID(
            public.ST_MakePoint(
              (sf_obs.data#>>'{properties,longitude}')::double precision,
              (sf_obs.data#>>'{properties,latitude}')::double precision
            ),
            4326
          )
      END,
      observation_location.location_point,
      sample_site_locations.location_point
    ) AS location_point
  FROM biohub.submission_feature sf_obs
  JOIN candidates cf
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
    s.name AS submission_name,
    LOWER(c.client_id) AS contributor_client_id
  FROM biohub.submission_upload su
  JOIN biohub.submission s ON su.submission_id = s.submission_id
  JOIN biohub.contributor c ON s.contributor_id = c.contributor_id
  WHERE su.record_end_date IS NULL
    AND c.record_end_date IS NULL
),

-- 3. Build the complete, unfiltered materialised-view row shape.
columns AS (
  SELECT
    {columns},
    sf.submission_feature_id AS filter_feature_id,
    t.taxon_id AS filter_taxon_id
  FROM biohub.submission_feature sf
  JOIN candidates cf
  ON cf.submission_feature_id = sf.submission_feature_id
LEFT JOIN submissions sub
  ON sub.submission_upload_id = sf.submission_upload_id
JOIN biohub.feature_type ft
  ON sf.feature_type_id = ft.feature_type_id
LEFT JOIN observation_locations ol
  ON ol.submission_feature_id = sf.submission_feature_id
LEFT JOIN sample_period_start_timestamps spst
  ON spst.submission_feature_id = sf.submission_feature_id
LEFT JOIN biohub.taxon t
  ON t.itis_tsn = (sf.data#>>'{properties,taxon_id}')::int
LEFT JOIN biohub.contributor_codeset_code ccc_sign
  ON CASE
    WHEN sf.data#>>'{properties,sign}' ~ '^code::observation_sign::[0-9]+$'
      THEN split_part(sf.data#>>'{properties,sign}', '::', 3)::int
  END = ccc_sign.contributor_codeset_code_id
LEFT JOIN biohub.contributor_codeset_code ccc_sex
  ON CASE
    WHEN sf.data#>>'{properties,sex}' ~ '^[0-9]+$'
      THEN (sf.data#>>'{properties,sex}')::int
  END = ccc_sex.contributor_codeset_code_id
LEFT JOIN biohub.contributor_codeset_code ccc_life_stage
  ON CASE
    WHEN sf.data#>>'{properties,life_stage}' ~ '^[0-9]+$'
      THEN (sf.data#>>'{properties,life_stage}')::int
  END = ccc_life_stage.contributor_codeset_code_id
WHERE ft.name = 'species_observation'
  AND sf.record_end_date IS NULL
  AND sf.record_effective_date IS NOT NULL
  AND sf.record_effective_date <= NOW()
  {siteFilter}
),

-- 4. Apply the taxon and security rules.
filters AS (
  SELECT *
  FROM columns
  WHERE 1 = 1
    {taxonExclusionFilter}
    {securityFilter}
)

-- 5. Select only the observation columns established for the BCGW..
SELECT
  {selectedColumns}
FROM filters
`;
