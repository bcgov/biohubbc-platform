import { Knex } from 'knex';
import {
  BCGW_SCHEMA,
  EXCLUDED_FISH_TAXON_BRANCHES,
  MaterialisedViewCommentMap,
  MATERIALISED_VIEW_NAMES,
  OBSERVATION_COMMENTS,
  TaxonBranch,
  TELEMETRY_COMMENTS
} from '../constants/materialised-views';

// ----------------------------------------------------------------------------------------
// Shared migration configuration and types
// ----------------------------------------------------------------------------------------
const DB_USER_BCGW_PASS = process.env.DB_USER_BCGW_PASS;
const DB_USER_BCGW = process.env.DB_USER_BCGW;

interface MaterialisedViewColumn {
  alias: string;
  expression: string;
}

type SiteFilter = 'linked' | 'incidental';

// ----------------------------------------------------------------------------------------
// Defining the telemetry materialised-view columns
// ----------------------------------------------------------------------------------------
const TELEMETRY_COLUMNS: MaterialisedViewColumn[] = [
  { alias: 'Feature_ID', expression: 'sf.submission_feature_id' },
  { alias: 'taxon_id', expression: 'ra.taxon_id::int' },
  { alias: 'scientific_name', expression: 't.itis_scientific_name' },
  { alias: 'common_name', expression: 't.common_name' },
  { alias: 'animal_id', expression: 'd.animal_id' },
  { alias: 'sex', expression: 'ra.sex' },
  { alias: 'eco_unit', expression: 'reu.ecological_unit' },
  { alias: 'device_key', expression: 'd.device_key' },
  { alias: 'date', expression: "((sf.data#>>'{properties,timestamp}')::timestamptz)::date" },
  { alias: 'time', expression: "((sf.data#>>'{properties,timestamp}')::timestamptz)::time" },
  { alias: 'YEAR', expression: "EXTRACT(YEAR FROM (sf.data#>>'{properties,timestamp}')::timestamptz)::int" },
  { alias: 'Latitude', expression: 'public.ST_Y(tl.geometry)' },
  { alias: 'Longitude', expression: 'public.ST_X(tl.geometry)' },
  { alias: 'dop', expression: "(sf.data#>>'{properties,dop}')::numeric" },
  { alias: 'submission_id', expression: 's.submission_id' },
  { alias: 'submission_name', expression: 's.submission_name' },
  { alias: 'SECURED', expression: '{securedColumn}' },
  {
    alias: 'source',
    expression:
      "'https://biodiversityhub.gov.bc.ca/submission/' || sf.submission_id || '/feature/' || sf.submission_feature_id"
  }
];

// ----------------------------------------------------------------------------------------
// Defining the observation and incidental materialised-view columns
// ----------------------------------------------------------------------------------------
const OBSERVATION_COLUMNS: MaterialisedViewColumn[] = [
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

// ----------------------------------------------------------------------------------------
// TELEMETRY MATERIALISED VIEW QUERY
//
// This query shares a skeleton with the observations query below, including: candidates -> source CTEs -> columns -> filters -> final SELECT
// ----------------------------------------------------------------------------------------
const TELEMETRY_QUERY = `
WITH
-- 1. Limit processing to features represented in the closure table.
candidates AS (
    SELECT DISTINCT source_submission_feature_id AS submission_feature_id
    FROM biohub.submission_feature_closure
),

-- 2. Resolve telemetry-specific deployments, locations, animals, and ecological units.
deployments AS (
    SELECT
        dep.submission_feature_id,
        dep.submission_upload_id,
        dep.parent_submission_feature_id AS survey_submission_feature_id,
        dep.data#>>'{properties,device_key}' AS device_key,
        dep.data#>>'{properties,animal_identifier}' AS animal_id
    FROM biohub.submission_feature dep
    JOIN candidates cf
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
    JOIN candidates cf
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
        WHEN sf.data#>>'{properties,sex}' ~ '^\\d+$'
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
),

-- 4. Applying the taxon and security rules.
filters AS (
  SELECT *
  FROM columns
  WHERE 1 = 1
    {taxonExclusionFilter}
    {securityFilter}
)

-- 5. Select only the telemetry columns established for the BCGW.
SELECT
  {selectedColumns}
FROM filters
`;

// ----------------------------------------------------------------------------------------
// OBSERVATION MATERIALISED VIEW QUERY
//
// This query shares a skeleton with the telemetry query above, including: candidates -> source CTEs -> columns -> filters -> final SELECT
// ----------------------------------------------------------------------------------------
const OBSERVATION_QUERY = `
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

// ----------------------------------------------------------------------------------------
// Shared SQL literal and security helpers
// ----------------------------------------------------------------------------------------
const quoteLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`;

const effectivelySecuredExpression = (featureIdExpression: string): string => `(
  EXISTS (
    SELECT 1
    FROM biohub.submission_feature_closure security_closure
    JOIN biohub.submission_feature_security feature_security
      ON feature_security.submission_feature_id = security_closure.target_submission_feature_id
    JOIN biohub.submission_feature secured_feature
      ON secured_feature.submission_feature_id = security_closure.target_submission_feature_id
    WHERE security_closure.source_submission_feature_id = ${featureIdExpression}
      AND security_closure.is_ancestor = true
      AND feature_security.record_end_date IS NULL
      AND secured_feature.record_effective_date <= NOW()
  )
  OR NOT EXISTS (
    SELECT 1
    FROM biohub.submission_feature_closure security_closure
    WHERE security_closure.source_submission_feature_id = ${featureIdExpression}
      AND security_closure.target_submission_feature_id = ${featureIdExpression}
  )
)`;

// ----------------------------------------------------------------------------------------
// Shared taxon-exclusion SQL helpers
// ----------------------------------------------------------------------------------------
const buildTaxonBranchPredicate = (branch: TaxonBranch): string => {
  const rootMatch = `EXISTS (
    SELECT 1
    FROM taxon_ancestors branch_root
    WHERE branch_root.itis_tsn = ${branch.rootItisTsn}
  )`;

  if (!branch.exceptDescendantItisTsns?.length) {
    return `(${rootMatch})`;
  }

  return `(
    ${rootMatch}
    AND NOT EXISTS (
      SELECT 1
      FROM taxon_ancestors exception
      WHERE exception.itis_tsn IN (${branch.exceptDescendantItisTsns.join(', ')})
    )
  )`;
};

const buildTaxonFilter = (taxonIdExpression: string): string => `AND (
  ${taxonIdExpression} IS NULL
  OR EXISTS (
    WITH RECURSIVE taxon_ancestors AS (
      SELECT
        taxon_id,
        itis_tsn,
        parent_taxon_id,
        ARRAY[taxon_id] AS visited_taxon_ids
      FROM biohub.taxon
      WHERE taxon_id = ${taxonIdExpression}
        AND record_end_date IS NULL

      UNION ALL

      SELECT
        parent.taxon_id,
        parent.itis_tsn,
        parent.parent_taxon_id,
        ancestor.visited_taxon_ids || parent.taxon_id
      FROM biohub.taxon parent
      JOIN taxon_ancestors ancestor
        ON parent.taxon_id = ancestor.parent_taxon_id
      WHERE parent.record_end_date IS NULL
        AND NOT parent.taxon_id = ANY(ancestor.visited_taxon_ids)
    )
    SELECT 1
    WHERE NOT (
      ${EXCLUDED_FISH_TAXON_BRANCHES.map(buildTaxonBranchPredicate).join('\n      OR ')}
    )
  )
)`;

// ----------------------------------------------------------------------------------------
// Shared materialised-view column and SQL builders
// ----------------------------------------------------------------------------------------
const buildColumns = (columns: MaterialisedViewColumn[], isPublic: boolean): string => {
  const securedColumn = isPublic
    ? "'N'"
    : `CASE WHEN ${effectivelySecuredExpression('sf.submission_feature_id')} THEN 'Y' ELSE 'N' END`;

  return columns
    .map((column) => `${column.expression.replace('{securedColumn}', securedColumn)} AS ${column.alias}`)
    .join(',\n    ');
};

const buildViewSQL = (
  name: string,
  query: string,
  columns: MaterialisedViewColumn[],
  isPublic: boolean,
  siteFilter?: SiteFilter
): string => {
  const selectedColumns = columns.map((column) => column.alias).join(',\n  ');
  const securityFilter = isPublic ? `AND NOT ${effectivelySecuredExpression('filter_feature_id')}` : '';
  const observationSiteFilter =
    siteFilter === 'linked'
      ? 'AND sf.submission_feature_id IN (SELECT submission_feature_id FROM site_linked_observations)'
      : siteFilter === 'incidental'
      ? 'AND sf.submission_feature_id NOT IN (SELECT submission_feature_id FROM site_linked_observations)'
      : '';

  const sql = query
    .replace('{columns}', buildColumns(columns, isPublic))
    .replace('{selectedColumns}', selectedColumns)
    .replace('{siteFilter}', observationSiteFilter)
    .replace('{taxonExclusionFilter}', buildTaxonFilter('filter_taxon_id'))
    .replace('{securityFilter}', securityFilter);

  return `CREATE MATERIALIZED VIEW ${BCGW_SCHEMA}.${name}_new AS
${sql};`;
};

// Each view is declared independently below. The shared constants and builders above
// remain the single place to change columns, joins, filters, and comments.

// ----------------------------------------------------------------------------------------
// Creating wildlife observations public materialised view
// ----------------------------------------------------------------------------------------
const WLD_OBSERVATIONS_PUBLIC_SQL = buildViewSQL(
  'wld_observations_public',
  OBSERVATION_QUERY,
  OBSERVATION_COLUMNS,
  true,
  'linked'
);

// ----------------------------------------------------------------------------------------
// Creating wildlife observations all materialised view
// ----------------------------------------------------------------------------------------
const WLD_OBSERVATIONS_ALL_SQL = buildViewSQL(
  'wld_observations_all',
  OBSERVATION_QUERY,
  OBSERVATION_COLUMNS,
  false,
  'linked'
);

// ----------------------------------------------------------------------------------------
// Creating wildlife telemetry obs public materialised view
// ----------------------------------------------------------------------------------------
const WLD_TELEMETRY_PUBLIC_SQL = buildViewSQL('wld_telemetry_public', TELEMETRY_QUERY, TELEMETRY_COLUMNS, true);

// ----------------------------------------------------------------------------------------
// Creating wildlife telemetry obs all materialised view
// ----------------------------------------------------------------------------------------
const WLD_TELEMETRY_ALL_SQL = buildViewSQL('wld_telemetry_all', TELEMETRY_QUERY, TELEMETRY_COLUMNS, false);

// ----------------------------------------------------------------------------------------
// Creating wildlife incidental obs public materialised view
// ----------------------------------------------------------------------------------------
const WLD_INCIDENTAL_PUBLIC_SQL = buildViewSQL(
  'wld_incidental_public',
  OBSERVATION_QUERY,
  OBSERVATION_COLUMNS,
  true,
  'incidental'
);

// ----------------------------------------------------------------------------------------
// Creating wildlife incidental obs all materialised view
// ----------------------------------------------------------------------------------------
const WLD_INCIDENTAL_ALL_SQL = buildViewSQL(
  'wld_incidental_all',
  OBSERVATION_QUERY,
  OBSERVATION_COLUMNS,
  false,
  'incidental'
);

// ----------------------------------------------------------------------------------------
// Materialised-view creation order and column-comment metadata
// ----------------------------------------------------------------------------------------
const VIEW_SQL = [
  { name: 'wld_observations_public', sql: WLD_OBSERVATIONS_PUBLIC_SQL, comments: OBSERVATION_COMMENTS },
  { name: 'wld_observations_all', sql: WLD_OBSERVATIONS_ALL_SQL, comments: OBSERVATION_COMMENTS },
  { name: 'wld_telemetry_public', sql: WLD_TELEMETRY_PUBLIC_SQL, comments: TELEMETRY_COMMENTS },
  { name: 'wld_telemetry_all', sql: WLD_TELEMETRY_ALL_SQL, comments: TELEMETRY_COMMENTS },
  { name: 'wld_incidental_public', sql: WLD_INCIDENTAL_PUBLIC_SQL, comments: OBSERVATION_COMMENTS },
  { name: 'wld_incidental_all', sql: WLD_INCIDENTAL_ALL_SQL, comments: OBSERVATION_COMMENTS }
] as const;

// ----------------------------------------------------------------------------------------
// Materialised-view comments and rebuild lifecycle
// ----------------------------------------------------------------------------------------
const addComments = async (knex: Knex, viewName: string, comments: MaterialisedViewCommentMap): Promise<void> => {
  for (const [column, comment] of Object.entries(comments)) {
    await knex.raw(`COMMENT ON COLUMN ${BCGW_SCHEMA}.${viewName}_new.${column} IS ${quoteLiteral(comment)};`);
  }
};

const rebuildMaterialisedView = async (knex: Knex, view: (typeof VIEW_SQL)[number]): Promise<void> => {
  await knex.raw(`DROP MATERIALIZED VIEW IF EXISTS ${BCGW_SCHEMA}.${view.name}_new;`);
  await knex.raw(view.sql);
  await addComments(knex, view.name, view.comments);
  await knex.raw(`DROP MATERIALIZED VIEW IF EXISTS ${BCGW_SCHEMA}.${view.name};`);
  await knex.raw(`ALTER MATERIALIZED VIEW ${BCGW_SCHEMA}.${view.name}_new RENAME TO ${view.name};`);
};

// ----------------------------------------------------------------------------------------
// Apply migration: create BCGW schema, user, helper function, and materialised views
// ----------------------------------------------------------------------------------------
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    -- ----------------------------------------------------------------------------------------
    -- 1. Create BCGW schema
    -- ----------------------------------------------------------------------------------------
    CREATE SCHEMA bcgw;

    -- ----------------------------------------------------------------------------------------
    -- 2. Create BCGW user and grant access
    -- ----------------------------------------------------------------------------------------
    CREATE ROLE ${DB_USER_BCGW} LOGIN PASSWORD '${DB_USER_BCGW_PASS}';
    GRANT USAGE ON SCHEMA bcgw TO ${DB_USER_BCGW};
    ALTER ROLE ${DB_USER_BCGW} SET search_path TO bcgw;

    -- Grant the BCGW user access to future tables, views, and materialised views.
    ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA bcgw
    GRANT SELECT ON TABLES TO ${DB_USER_BCGW};
  `);

  await knex.raw(`
    -- ----------------------------------------------------------------------------------------
    -- Create the shared safe GeoJSON conversion function
    -- ----------------------------------------------------------------------------------------
    SET search_path = biohub, public;

    CREATE OR REPLACE FUNCTION biohub.try_geom_from_geojson(geojson_text text)
    RETURNS geometry
    LANGUAGE plpgsql
    IMMUTABLE
    STRICT
    AS $fn$
    BEGIN
      RETURN public.ST_GeomFromGeoJSON(geojson_text);
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
    $fn$;
  `);

  for (const view of VIEW_SQL) {
    await rebuildMaterialisedView(knex, view);
  }
}

// ----------------------------------------------------------------------------------------
// Revert migration: remove materialised views, BCGW schema, and BCGW user
// ----------------------------------------------------------------------------------------
export async function down(knex: Knex): Promise<void> {
  for (const viewName of [...MATERIALISED_VIEW_NAMES].reverse()) {
    await knex.raw(`DROP MATERIALIZED VIEW IF EXISTS ${BCGW_SCHEMA}.${viewName};`);
    await knex.raw(`DROP MATERIALIZED VIEW IF EXISTS ${BCGW_SCHEMA}.${viewName}_new;`);
  }

  await knex.raw(`
    ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA bcgw
    REVOKE SELECT ON TABLES FROM ${DB_USER_BCGW};

    DROP SCHEMA IF EXISTS bcgw CASCADE;
    DROP USER IF EXISTS ${DB_USER_BCGW};
  `);
}
