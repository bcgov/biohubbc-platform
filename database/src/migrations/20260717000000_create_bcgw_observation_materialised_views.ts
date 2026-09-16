import type { Knex } from 'knex';
import { quoteIdentifier, quoteLiteral } from '../utils/migrations';

// Keep domain mappings and SQL generation here; shared helpers only quote SQL values and names.
const featureTypes = {
  observation: 'species_observation',
  site: 'sample_site',
  period: 'sample_period'
} as const;

type PropertyMapping = {
  featureType: keyof typeof featureTypes;
  property: string;
} & (
  | { kind: 'string' | 'datetime' | 'spatial' | 'taxon' }
  | { kind: 'label'; column: string }
  | { kind: 'number'; column: string; cast: 'integer' | 'double precision' | 'numeric' }
);

// Keys name SQL inputs; column names identify direct projections. Labels support string or code storage.
const properties: Record<string, PropertyMapping> = {
  sample_period_start_date: { featureType: 'period', property: 'start_date', kind: 'datetime' },
  observation_taxon_id: { featureType: 'observation', property: 'taxon_id', kind: 'taxon' },
  observation_identifier: { featureType: 'observation', property: 'observation_id', kind: 'string' },
  observation_subcount: {
    featureType: 'observation',
    property: 'subcount_count',
    kind: 'number',
    column: 'subcount',
    cast: 'integer'
  },
  observation_count: {
    featureType: 'observation',
    property: 'count',
    kind: 'number',
    column: 'count',
    cast: 'integer'
  },
  observation_latitude: {
    featureType: 'observation',
    property: 'latitude',
    kind: 'number',
    column: 'latitude',
    cast: 'double precision'
  },
  observation_longitude: {
    featureType: 'observation',
    property: 'longitude',
    kind: 'number',
    column: 'longitude',
    cast: 'double precision'
  },
  observation_timestamp: { featureType: 'observation', property: 'timestamp', kind: 'datetime' },
  observation_geometry: { featureType: 'observation', property: 'geometry', kind: 'spatial' },
  sample_site_geometry: { featureType: 'site', property: 'geometry', kind: 'spatial' },
  sign: { featureType: 'observation', property: 'sign', kind: 'label', column: 'sign' },
  sex: { featureType: 'observation', property: 'sex', kind: 'label', column: 'sex' },
  life_stage: { featureType: 'observation', property: 'life_stage', kind: 'label', column: 'life_stage' }
};

// The external contract is independent of which configured properties currently exist.
const exportColumns: Record<string, { comment: string; expression?: string }> = {
  feature_id: { comment: 'System generated surrogate primary key identifier' },
  taxon_id: { comment: 'Taxonomic identifier of the observed species' },
  scientific_name: { comment: 'Scientific name of the observed species' },
  common_name: { comment: 'Common name of the observed species' },
  sign: { comment: 'Sign used to make the observation' },
  group_id: { comment: 'Group identifier shared by species observations collected together' },
  sex: { comment: 'Sex label from contributor codeset' },
  life_stage: { comment: 'Life stage label from contributor codeset' },
  count: { comment: 'Count value for the observation' },
  date: { comment: 'The date portion of the observation timestamp' },
  time: { comment: 'The time portion of the observation timestamp' },
  year: { comment: 'The year of the observation' },
  latitude: { comment: 'The latitude of the observation location' },
  longitude: { comment: 'The longitude of the observation location' },
  submission_id: { comment: 'Submission identifier under which the feature was submitted' },
  submission_name: { comment: 'Submission name under which the feature was submitted' },
  secured: {
    comment: 'The indicator of whether the feature is secured (Y) or not (N)',
    expression: "CASE WHEN is_secured THEN 'Y' ELSE 'N' END"
  },
  source: { comment: 'A hyperlink to the source feature in the Biodiversity Hub portal' }
};

const exportViews = {
  wld_observations_public: 'has_sample_site AND NOT is_secured',
  wld_observations_all: 'has_sample_site',
  wld_incidental_public: 'NOT has_sample_site AND NOT is_secured',
  wld_incidental_all: 'NOT has_sample_site'
};

/** Define the domain query once; each export remains independently refreshable. */
export async function up(knex: Knex): Promise<void> {
  const featureTypeNames = Object.values(featureTypes).map(quoteLiteral).join(', ');
  const entries = Object.entries(properties);
  const propertyIds = entries
    .filter(([, property]) => property.kind !== 'label')
    .map(
      ([name, property]) => `(SELECT feature_type_property_id FROM property_definitions
      WHERE feature_type = ${quoteLiteral(featureTypes[property.featureType])}
        AND name = ${quoteLiteral(property.property)} AND kind = ${quoteLiteral(property.kind)}) AS ${quoteIdentifier(
        name
      )}`
    )
    .join(',\n        ');
  const labels = entries
    .map(([, property]) => property)
    .filter((property): property is Extract<PropertyMapping, { kind: 'label' }> => property.kind === 'label');
  const labelMappings = labels
    .map(
      (property) =>
        `(${quoteLiteral(featureTypes[property.featureType])}, ${quoteLiteral(property.property)}, ${quoteLiteral(
          property.column
        )})`
    )
    .join(', ');
  const labelColumns = labels
    .map(
      (property) => `string_agg(value, ';' ORDER BY ordinal)
      FILTER (WHERE column_name = ${quoteLiteral(property.column)}) AS ${quoteIdentifier(property.column)}`
    )
    .join(',\n        ');
  const numbers = entries.filter(
    (entry): entry is [string, Extract<PropertyMapping, { kind: 'number' }>] => entry[1].kind === 'number'
  );
  const numberColumns = numbers
    .map(
      ([name, property]) => `string_agg((p.value::${
        property.cast
      })::text, ';' ORDER BY p.submission_feature_property_number_id)
      FILTER (WHERE p.feature_type_property_id = ids.${quoteIdentifier(name)}) AS ${quoteIdentifier(property.column)}`
    )
    .join(',\n          ');
  const numberIds = numbers.map(([name]) => `ids.${quoteIdentifier(name)}`).join(', ');

  await knex.raw(`--sql
    -- One row per eligible feature. This ordinary view stores no snapshot.
    CREATE VIEW bcgw_internal.observation_export_rows AS
    -- Eligibility: one row per active, closure-backed feature.
    WITH RECURSIVE current_features AS (
      SELECT sf.submission_feature_id, sf.submission_id,
        sf.submission_upload_id, ft.name AS feature_type
      FROM biohub.submission_feature sf
      JOIN biohub.feature_type ft ON ft.feature_type_id = sf.feature_type_id
      -- Closure supplies version membership, including drafts; search eligibility supplies the active window.
      WHERE EXISTS (
        SELECT 1 FROM biohub.submission_feature_closure c
        WHERE c.source_submission_feature_id = sf.submission_feature_id
      ) AND sf.record_effective_date <= NOW() AND (sf.record_end_date IS NULL OR NOW() < sf.record_end_date)
        AND ft.record_end_date IS NULL AND ft.name IN (${featureTypeNames})
    ), property_definitions AS (
      -- Fixed property assignments; no feature values are collapsed here.
      SELECT ftp.feature_type_property_id, ft.name AS feature_type, fp.name, fpt.name AS kind
      FROM biohub.feature_type_property ftp
      JOIN biohub.feature_type ft ON ft.feature_type_id = ftp.feature_type_id AND ft.record_end_date IS NULL
      JOIN biohub.feature_property fp ON fp.feature_property_id = ftp.feature_property_id AND fp.record_end_date IS NULL
      JOIN biohub.feature_property_type fpt ON fpt.feature_property_type_id = fp.feature_property_type_id AND fpt.record_end_date IS NULL
      WHERE ftp.record_end_date IS NULL
    ), property_ids AS (
      -- Resolve each fixed assignment once; missing metadata yields NULL, duplicates raise an error.
      SELECT ${propertyIds}
    ), label_mappings(feature_type, property_name, column_name) AS (
      VALUES ${labelMappings}
    ), labels AS (
      -- One row per feature; mapped labels retain their independent property-row order.
      SELECT submission_feature_id, ${labelColumns}
      FROM (
        SELECT p.submission_feature_id, mapping.column_name,
          p.submission_feature_property_string_id AS ordinal, p.value::text AS value
        FROM current_features f
        JOIN biohub.submission_feature_property_string p ON p.submission_feature_id = f.submission_feature_id
        JOIN property_definitions d ON d.feature_type_property_id = p.feature_type_property_id
        JOIN label_mappings mapping ON mapping.feature_type = d.feature_type AND mapping.property_name = d.name
        WHERE d.kind = 'string'
        UNION ALL
        SELECT p.submission_feature_id, mapping.column_name, p.submission_feature_property_code_id, code.label::text
        FROM current_features f
        JOIN biohub.submission_feature_property_code p ON p.submission_feature_id = f.submission_feature_id
        JOIN property_definitions d ON d.feature_type_property_id = p.feature_type_property_id
        JOIN label_mappings mapping ON mapping.feature_type = d.feature_type AND mapping.property_name = d.name
        JOIN biohub.contributor_codeset_code code ON code.contributor_codeset_code_id = p.contributor_codeset_code_id
        JOIN biohub.contributor_codeset cs ON cs.contributor_codeset_id = code.contributor_codeset_id
        WHERE d.kind = 'code' AND code.record_end_date IS NULL AND cs.record_end_date IS NULL
      ) label_values
      GROUP BY submission_feature_id
    ), locations AS (
      SELECT f.submission_feature_id, g.submission_feature_property_geometry_id,
        CASE public.ST_GeometryType(g.value)
          WHEN 'ST_Point' THEN g.value
          WHEN 'ST_LineString' THEN public.ST_StartPoint(g.value)
          WHEN 'ST_MultiLineString' THEN public.ST_StartPoint(public.ST_GeometryN(g.value, 1))
          ELSE public.ST_Centroid(g.value)
        END AS point
      FROM current_features f
      CROSS JOIN property_ids ids
      JOIN biohub.submission_feature_property_geometry g ON g.submission_feature_id = f.submission_feature_id
        AND g.feature_type_property_id = CASE f.feature_type
          WHEN ${quoteLiteral(featureTypes.observation)} THEN ids.observation_geometry
          WHEN ${quoteLiteral(featureTypes.site)} THEN ids.sample_site_geometry
        END
    ), selected_sites AS (
      SELECT DISTINCT ON (c.source_submission_feature_id) c.source_submission_feature_id, l.point
      FROM biohub.submission_feature_closure c
      JOIN current_features s ON s.submission_feature_id = c.target_submission_feature_id AND s.feature_type = ${quoteLiteral(
        featureTypes.site
      )}
      LEFT JOIN locations l ON l.submission_feature_id = s.submission_feature_id
      -- Choose usable geometry first, but retain site membership when no geometry exists.
      ORDER BY c.source_submission_feature_id, l.point IS NULL, c.is_ancestor DESC,
        s.submission_feature_id, l.submission_feature_property_geometry_id
    ), selected_sample_periods AS (
      SELECT DISTINCT ON (c.source_submission_feature_id) c.source_submission_feature_id, start.date_value, start.time_value
      FROM biohub.submission_feature_closure c
      CROSS JOIN property_ids ids
      JOIN current_features p ON p.submission_feature_id = c.target_submission_feature_id AND p.feature_type = ${quoteLiteral(
        featureTypes.period
      )}
      JOIN biohub.submission_feature_property_timestamp start ON start.submission_feature_id = p.submission_feature_id
        AND start.feature_type_property_id = ids.sample_period_start_date
      WHERE start.date_value IS NOT NULL
      ORDER BY c.source_submission_feature_id, c.is_ancestor DESC, p.submission_feature_id, start.submission_feature_property_timestamp_id
    ), observations AS (
      SELECT f.* FROM current_features f
      WHERE f.feature_type = ${quoteLiteral(featureTypes.observation)}
    ), taxon_values AS (
      -- Taxonomy: preserve each property value and exclude fish independently.
      SELECT p.submission_feature_id, p.submission_feature_property_taxon_id AS ordinal,
        p.taxon_id, t.itis_tsn, t.itis_scientific_name, t.common_name
      FROM observations f
      CROSS JOIN property_ids ids
      JOIN biohub.submission_feature_property_taxon p ON p.submission_feature_id = f.submission_feature_id
        AND p.feature_type_property_id = ids.observation_taxon_id
      LEFT JOIN biohub.taxon t ON t.taxon_id = p.taxon_id AND t.record_end_date IS NULL
    ), taxon_ancestors AS (
      SELECT t.taxon_id AS root_taxon_id, t.taxon_id, t.itis_tsn, t.parent_taxon_id
      FROM biohub.taxon t
      WHERE t.record_end_date IS NULL AND EXISTS (SELECT 1 FROM taxon_values v WHERE v.taxon_id = t.taxon_id)
      UNION
      SELECT a.root_taxon_id, p.taxon_id, p.itis_tsn, p.parent_taxon_id
      FROM taxon_ancestors a
      JOIN biohub.taxon p ON p.taxon_id = a.parent_taxon_id AND p.record_end_date IS NULL
    ), excluded_taxa AS (
      -- UNION terminates cycles. Tetrapoda is exempt from Sarcopterygii.
      SELECT root_taxon_id FROM taxon_ancestors
      GROUP BY root_taxon_id
      HAVING bool_or(itis_tsn IN (161061, 159785, 914178))
        OR (bool_or(itis_tsn = 161048) AND NOT bool_or(itis_tsn = 914181))
    ), taxon_properties AS (
      SELECT v.submission_feature_id,
        string_agg(v.itis_tsn::text, ';' ORDER BY v.ordinal) FILTER (WHERE e.root_taxon_id IS NULL) AS taxon_id,
        string_agg(v.itis_scientific_name, ';' ORDER BY v.ordinal) FILTER (WHERE e.root_taxon_id IS NULL) AS scientific_name,
        string_agg(v.common_name, ';' ORDER BY v.ordinal) FILTER (WHERE e.root_taxon_id IS NULL) AS common_name,
        bool_or(e.root_taxon_id IS NULL) AS has_allowed_taxon
      FROM taxon_values v LEFT JOIN excluded_taxa e ON e.root_taxon_id = v.taxon_id
      GROUP BY v.submission_feature_id
    ), observation_properties AS (
      -- One row per observation; aggregate independent properties before joining.
      SELECT sf.submission_feature_id, sf.submission_id, sf.submission_upload_id,
        -- Missing self-links fail closed; only ancestry propagates security.
        NOT EXISTS (
          SELECT 1 FROM biohub.submission_feature_closure c
          WHERE c.source_submission_feature_id = sf.submission_feature_id
            AND c.target_submission_feature_id = sf.submission_feature_id
        ) OR EXISTS (
          SELECT 1 FROM biohub.submission_feature_closure c
          JOIN biohub.submission_feature_security sfs ON sfs.submission_feature_id = c.target_submission_feature_id
          JOIN biohub.submission_feature secured ON secured.submission_feature_id = c.target_submission_feature_id
          WHERE c.source_submission_feature_id = sf.submission_feature_id AND c.is_ancestor
            AND sfs.record_end_date IS NULL AND secured.record_effective_date <= NOW()
        ) AS is_secured,
        t.taxon_id, t.scientific_name, t.common_name,
        observation_ids.values AS observation_ids,
        COALESCE(numbers.subcount, numbers.count) AS count,
        numbers.latitude, numbers.longitude,
        timestamp.present AS has_timestamp, timestamp.date, timestamp.time, timestamp.year,
        labels.sign, labels.sex, labels.life_stage
      FROM observations sf CROSS JOIN property_ids ids
      LEFT JOIN taxon_properties t ON t.submission_feature_id = sf.submission_feature_id
      LEFT JOIN LATERAL (
        SELECT array_agg(p.value ORDER BY p.submission_feature_property_string_id) AS values
        FROM biohub.submission_feature_property_string p
        WHERE p.submission_feature_id = sf.submission_feature_id
          AND p.feature_type_property_id = ids.observation_identifier
      ) observation_ids ON true
      LEFT JOIN LATERAL (
        SELECT ${numberColumns}
        FROM biohub.submission_feature_property_number p
        WHERE p.submission_feature_id = sf.submission_feature_id
          AND p.feature_type_property_id IN (${numberIds})
      ) numbers ON true
      LEFT JOIN LATERAL (
        SELECT count(*) > 0 AS present,
          string_agg(to_char(p.date_value, 'YYYY-MM-DD'), ';' ORDER BY p.submission_feature_property_timestamp_id) AS date,
          string_agg(p.time_value::text, ';' ORDER BY p.submission_feature_property_timestamp_id) AS time,
          string_agg(EXTRACT(YEAR FROM p.date_value)::int::text, ';' ORDER BY p.submission_feature_property_timestamp_id) AS year
        FROM biohub.submission_feature_property_timestamp p
        WHERE p.submission_feature_id = sf.submission_feature_id
          AND p.feature_type_property_id = ids.observation_timestamp
      ) timestamp ON true
      LEFT JOIN labels ON labels.submission_feature_id = sf.submission_feature_id
      WHERE COALESCE(t.has_allowed_taxon, true)
    ), observation_rows AS (
      -- Resolve site membership and coordinate/timestamp precedence.
      SELECT sf.submission_feature_id, sf.submission_id, sf.submission_upload_id,
        sf.taxon_id, sf.scientific_name, sf.common_name, sf.observation_ids, sf.is_secured,
        site.source_submission_feature_id IS NOT NULL AS has_sample_site,
        sf.sign, sf.sex, sf.life_stage, sf.count,
        CASE WHEN sf.has_timestamp THEN sf.date ELSE to_char(period.date_value, 'YYYY-MM-DD') END AS date,
        CASE WHEN sf.has_timestamp THEN sf.time ELSE period.time_value::text END AS time,
        CASE WHEN sf.has_timestamp THEN sf.year ELSE EXTRACT(YEAR FROM period.date_value)::int::text END AS year,
        CASE WHEN sf.latitude IS NOT NULL AND sf.longitude IS NOT NULL THEN sf.latitude
          ELSE COALESCE(own_location.latitude, public.ST_Y(site.point)::text) END AS latitude,
        CASE WHEN sf.latitude IS NOT NULL AND sf.longitude IS NOT NULL THEN sf.longitude
          ELSE COALESCE(own_location.longitude, public.ST_X(site.point)::text) END AS longitude
      FROM observation_properties sf
      LEFT JOIN selected_sites site ON site.source_submission_feature_id = sf.submission_feature_id
      LEFT JOIN LATERAL (
        SELECT string_agg(public.ST_Y(COALESCE(l.point, site.point))::text, ';' ORDER BY l.submission_feature_property_geometry_id) AS latitude,
          string_agg(public.ST_X(COALESCE(l.point, site.point))::text, ';' ORDER BY l.submission_feature_property_geometry_id) AS longitude
        FROM locations l WHERE l.submission_feature_id = sf.submission_feature_id
      ) own_location ON true
      LEFT JOIN selected_sample_periods period ON period.source_submission_feature_id = sf.submission_feature_id
    )
    SELECT sf.submission_feature_id AS feature_id, sf.taxon_id, sf.scientific_name, sf.common_name, sf.sign,
      (SELECT string_agg(LOWER(contributor.client_id) || '::' || NULLIF(value, ''), ';' ORDER BY ordinal)
        FROM unnest(sf.observation_ids) WITH ORDINALITY AS identifiers(value, ordinal)) AS group_id,
      sf.sex, sf.life_stage, sf.count, sf.date, sf.time, sf.year, sf.latitude, sf.longitude,
      sub.submission_id, sub.name AS submission_name,
      sf.has_sample_site, sf.is_secured,
      'https://biodiversityhub.gov.bc.ca/submission/' || sf.submission_id || '/feature/' || sf.submission_feature_id AS source
    FROM observation_rows sf
    LEFT JOIN (
      biohub.submission_upload su
      JOIN biohub.submission sub ON sub.submission_id = su.submission_id
      JOIN biohub.contributor contributor ON contributor.contributor_id = sub.contributor_id
        AND contributor.record_end_date IS NULL
    ) ON su.submission_upload_id = sf.submission_upload_id AND su.record_end_date IS NULL;

  `);

  const projection = Object.entries(exportColumns)
    .map(([name, column]) => `${column.expression ?? quoteIdentifier(name)} AS ${quoteIdentifier(name)}`)
    .join(', ');
  for (const [name, filter] of Object.entries(exportViews)) {
    const view = `bcgw.${quoteIdentifier(name)}`;
    const comments = Object.entries(exportColumns)
      .map(
        ([column, definition]) =>
          `COMMENT ON COLUMN ${view}.${quoteIdentifier(column)} IS ${quoteLiteral(definition.comment)};`
      )
      .join('\n');
    await knex.raw(`--sql
      CREATE MATERIALIZED VIEW ${view} AS
        SELECT ${projection}
        FROM bcgw_internal.observation_export_rows
        WHERE ${filter};
      ${comments}
    `);
  }
}

/** Drop snapshots before their source view. */
export async function down(knex: Knex): Promise<void> {
  for (const name of Object.keys(exportViews).reverse()) {
    await knex.raw(`DROP MATERIALIZED VIEW IF EXISTS bcgw.${quoteIdentifier(name)};`);
  }
  await knex.raw('DROP VIEW IF EXISTS bcgw_internal.observation_export_rows;');
}
