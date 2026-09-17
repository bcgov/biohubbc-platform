import type { Knex } from 'knex';
import { quoteIdentifier, quoteLiteral } from '../utils/migrations';

// Keep domain mappings and SQL generation here; shared helpers only quote SQL values and names.
const featureTypes = {
  telemetry: 'telemetry',
  deployment: 'telemetry_deployment',
  animal: 'animal',
  unit: 'ecological_unit'
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
  deployment_animal_identifier: { featureType: 'deployment', property: 'animal_identifier', kind: 'string' },
  deployment_device_key: { featureType: 'deployment', property: 'device_key', kind: 'string' },
  animal_identifier: { featureType: 'animal', property: 'animal_identifier', kind: 'string' },
  animal_taxon_id: { featureType: 'animal', property: 'taxon_id', kind: 'taxon' },
  unit_type: { featureType: 'unit', property: 'ecological_unit_type', kind: 'string' },
  unit_value: { featureType: 'unit', property: 'ecological_unit_value', kind: 'string' },
  telemetry_timestamp: { featureType: 'telemetry', property: 'timestamp', kind: 'datetime' },
  telemetry_geometry: { featureType: 'telemetry', property: 'geometry', kind: 'spatial' },
  telemetry_dop: { featureType: 'telemetry', property: 'dop', kind: 'number', column: 'value', cast: 'numeric' },
  sex: { featureType: 'animal', property: 'sex', kind: 'label', column: 'sex' }
};

// The external contract is independent of which configured properties currently exist.
const exportColumns: Record<string, { comment: string; expression?: string }> = {
  feature_id: { comment: 'System generated surrogate primary key identifier' },
  taxon_id: { comment: 'Taxonomic identifier of the observed species' },
  scientific_name: { comment: 'Scientific name of the observed species' },
  common_name: { comment: 'Common name of the observed species' },
  animal_id: { comment: 'The identifier of the animal wearing the telemetry device' },
  sex: { comment: 'Sex label from contributor codeset' },
  eco_unit: { comment: 'Ecological unit type and value linked to the animal' },
  device_key: { comment: 'The vendor and device serial' },
  date: { comment: 'The date portion of the GPS location timestamp' },
  time: { comment: 'The time portion of the GPS location timestamp' },
  year: { comment: 'The year that the GPS location was recorded' },
  latitude: { comment: 'The latitude of the GPS location' },
  longitude: { comment: 'The longitude of the GPS location' },
  dop: { comment: 'The dilution of precision of the GPS location' },
  submission_id: { comment: 'Submission identifier under which the feature was submitted' },
  submission_name: { comment: 'Submission name under which the feature was submitted' },
  secured: {
    comment: 'The indicator of whether the feature is secured (Y) or not (N)',
    expression: "CASE WHEN is_secured THEN 'Y' ELSE 'N' END"
  },
  source: { comment: 'A hyperlink to the source feature in the Biodiversity Hub portal' }
};

const exportViews = {
  wld_telemetry_public: 'NOT is_secured',
  wld_telemetry_all: 'true'
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
    CREATE VIEW bcgw_internal.telemetry_export_rows AS
    -- Eligibility: one row per active, closure-backed feature.
    WITH RECURSIVE current_features AS (
      SELECT sf.submission_feature_id, sf.submission_id,
        sf.submission_upload_id, sf.parent_submission_feature_id, ft.name AS feature_type
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
    ), taxon_values AS (
      -- Taxonomy: preserve each property value and exclude fish independently.
      SELECT p.submission_feature_id, p.submission_feature_property_taxon_id AS ordinal,
        p.taxon_id, t.itis_tsn, t.itis_scientific_name, t.common_name
      FROM current_features f
      CROSS JOIN property_ids ids
      JOIN biohub.submission_feature_property_taxon p ON p.submission_feature_id = f.submission_feature_id
        AND p.feature_type_property_id = ids.animal_taxon_id
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
    ), deployments AS (
      -- Relationships: one row per deployment after animal/unit aggregation.
      SELECT sf.submission_feature_id, sf.submission_upload_id, sf.parent_submission_feature_id,
        properties.animal_identifiers, properties.animal_id, properties.device_key
      FROM current_features sf CROSS JOIN property_ids ids
      LEFT JOIN LATERAL (
        SELECT
          array_agg(p.value ORDER BY p.submission_feature_property_string_id)
            FILTER (WHERE p.feature_type_property_id = ids.deployment_animal_identifier) AS animal_identifiers,
          string_agg(p.value, ';' ORDER BY p.submission_feature_property_string_id)
            FILTER (WHERE p.feature_type_property_id = ids.deployment_animal_identifier) AS animal_id,
          string_agg(p.value, ';' ORDER BY p.submission_feature_property_string_id)
            FILTER (WHERE p.feature_type_property_id = ids.deployment_device_key) AS device_key
        FROM biohub.submission_feature_property_string p
        WHERE p.submission_feature_id = sf.submission_feature_id
          AND p.feature_type_property_id IN (ids.deployment_animal_identifier, ids.deployment_device_key)
      ) properties ON true
      WHERE sf.feature_type = ${quoteLiteral(featureTypes.deployment)}
    ), animals AS (
      SELECT d.submission_feature_id AS deployment_id, a.submission_feature_id AS animal_feature_id,
        t.taxon_id, t.scientific_name, t.common_name, labels.sex,
        COALESCE(t.has_allowed_taxon, true) AS has_allowed_taxon
      FROM deployments d CROSS JOIN property_ids ids
      JOIN current_features a ON a.submission_upload_id = d.submission_upload_id
        AND a.parent_submission_feature_id = d.parent_submission_feature_id AND a.feature_type = ${quoteLiteral(
          featureTypes.animal
        )}
      LEFT JOIN taxon_properties t ON t.submission_feature_id = a.submission_feature_id
      LEFT JOIN labels ON labels.submission_feature_id = a.submission_feature_id
      WHERE EXISTS (
        SELECT 1 FROM biohub.submission_feature_property_string p
        WHERE p.submission_feature_id = a.submission_feature_id AND p.feature_type_property_id = ids.animal_identifier
          AND p.value = ANY(d.animal_identifiers)
      )
    ), deployment_animals AS (
      SELECT deployment_id,
        string_agg(taxon_id, ';' ORDER BY animal_feature_id) FILTER (WHERE has_allowed_taxon) AS taxon_id,
        string_agg(scientific_name, ';' ORDER BY animal_feature_id) FILTER (WHERE has_allowed_taxon) AS scientific_name,
        string_agg(common_name, ';' ORDER BY animal_feature_id) FILTER (WHERE has_allowed_taxon) AS common_name,
        string_agg(sex, ';' ORDER BY animal_feature_id) FILTER (WHERE has_allowed_taxon) AS sex,
        bool_or(has_allowed_taxon) AS has_allowed_taxon
      FROM animals GROUP BY deployment_id
    ), ecological_units AS (
      SELECT links.deployment_id, string_agg(DISTINCT unit_type.value || '::' || unit_value.value, ';' ORDER BY unit_type.value || '::' || unit_value.value) AS value
      FROM (
        SELECT a.deployment_id, CASE WHEN edge.source_feature_id = a.animal_feature_id
          THEN edge.target_feature_id ELSE edge.source_feature_id END AS feature_id
        FROM animals a JOIN biohub.submission_feature_feature edge
          ON a.animal_feature_id IN (edge.source_feature_id, edge.target_feature_id)
        WHERE edge.source_feature_id <> edge.target_feature_id
        UNION ALL
        SELECT a.deployment_id, child.submission_feature_id
        FROM animals a JOIN current_features child ON child.parent_submission_feature_id = a.animal_feature_id
      ) links
      CROSS JOIN property_ids ids
      JOIN current_features eu ON eu.submission_feature_id = links.feature_id AND eu.feature_type = ${quoteLiteral(
        featureTypes.unit
      )}
      JOIN biohub.submission_feature_property_string unit_type ON unit_type.submission_feature_id = eu.submission_feature_id
        AND unit_type.feature_type_property_id = ids.unit_type
      JOIN biohub.submission_feature_property_string unit_value ON unit_value.submission_feature_id = eu.submission_feature_id
        AND unit_value.feature_type_property_id = ids.unit_value
      GROUP BY links.deployment_id
    ), telemetry_properties AS (
      -- One row per telemetry feature with qualifying timestamps.
      SELECT sf.submission_feature_id, sf.submission_id, sf.submission_upload_id, sf.parent_submission_feature_id,
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
        timestamp.date, timestamp.time, timestamp.year, geometry.latitude, geometry.longitude, dop.value AS dop
      FROM current_features sf CROSS JOIN property_ids ids
      LEFT JOIN LATERAL (
        SELECT count(*) > 0 AS present,
          string_agg(to_char(p.date_value, 'YYYY-MM-DD'), ';' ORDER BY p.submission_feature_property_timestamp_id) AS date,
          string_agg(p.time_value::text, ';' ORDER BY p.submission_feature_property_timestamp_id) AS time,
          string_agg(EXTRACT(YEAR FROM p.date_value)::int::text, ';' ORDER BY p.submission_feature_property_timestamp_id) AS year
        FROM biohub.submission_feature_property_timestamp p
        WHERE p.submission_feature_id = sf.submission_feature_id
          AND p.feature_type_property_id = ids.telemetry_timestamp
          AND p.date_value + COALESCE(p.time_value, TIME '00:00') <= LOCALTIMESTAMP - INTERVAL '3 months'
      ) timestamp ON true
      LEFT JOIN LATERAL (
        SELECT string_agg(public.ST_Y(p.value)::text, ';' ORDER BY p.submission_feature_property_geometry_id) AS latitude,
          string_agg(public.ST_X(p.value)::text, ';' ORDER BY p.submission_feature_property_geometry_id) AS longitude
        FROM biohub.submission_feature_property_geometry p
        WHERE p.submission_feature_id = sf.submission_feature_id
          AND p.feature_type_property_id = ids.telemetry_geometry
      ) geometry ON true
      LEFT JOIN LATERAL (
        SELECT ${numberColumns}
        FROM biohub.submission_feature_property_number p
        WHERE p.submission_feature_id = sf.submission_feature_id
          AND p.feature_type_property_id IN (${numberIds})
      ) dop ON true
      WHERE sf.feature_type = ${quoteLiteral(featureTypes.telemetry)} AND timestamp.present
    )
    SELECT sf.submission_feature_id AS feature_id, a.taxon_id, a.scientific_name, a.common_name,
      d.animal_id, a.sex, eu.value AS eco_unit, d.device_key,
      sf.date, sf.time, sf.year, sf.latitude, sf.longitude, sf.dop,
      sub.submission_id, sub.name AS submission_name,
      sf.is_secured,
      'https://biodiversityhub.gov.bc.ca/submission/' || sf.submission_id || '/feature/' || sf.submission_feature_id AS source
    FROM telemetry_properties sf
    LEFT JOIN deployments d ON d.submission_feature_id = sf.parent_submission_feature_id
    LEFT JOIN deployment_animals a ON a.deployment_id = d.submission_feature_id
    LEFT JOIN ecological_units eu ON eu.deployment_id = d.submission_feature_id
    LEFT JOIN (
      biohub.submission_upload su
      JOIN biohub.submission sub ON sub.submission_id = su.submission_id
    ) ON su.submission_upload_id = sf.submission_upload_id AND su.record_end_date IS NULL
    WHERE COALESCE(a.has_allowed_taxon, true);

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
        FROM bcgw_internal.telemetry_export_rows
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
  await knex.raw('DROP VIEW IF EXISTS bcgw_internal.telemetry_export_rows;');
}
