-- SIMSBIOHUB-1156 pre-flight. Read-only. Run against DEV, TEST and PROD before merging.
--
-- Migrations 20260923120000 to 20260923140000 raise and abort the deploy when any of the first five
-- queries returns a row. The remaining queries are informational.
SET search_path = biohub, public;

-- 1. Stored values without a Blueprint assignment that resolve to zero or to several assignments
--    within the feature's type and the upload's Blueprint (any lifecycle). Expected: 0 rows.
WITH typed AS (
  SELECT 'string' AS tbl, submission_feature_property_string_id AS row_id, submission_feature_id, feature_type_property_id, blueprint_feature_type_property_id FROM submission_feature_property_string
  UNION ALL SELECT 'number', submission_feature_property_number_id, submission_feature_id, feature_type_property_id, blueprint_feature_type_property_id FROM submission_feature_property_number
  UNION ALL SELECT 'boolean', submission_feature_property_boolean_id, submission_feature_id, feature_type_property_id, blueprint_feature_type_property_id FROM submission_feature_property_boolean
  UNION ALL SELECT 'timestamp', submission_feature_property_timestamp_id, submission_feature_id, feature_type_property_id, blueprint_feature_type_property_id FROM submission_feature_property_timestamp
  UNION ALL SELECT 'code', submission_feature_property_code_id, submission_feature_id, feature_type_property_id, blueprint_feature_type_property_id FROM submission_feature_property_code
  UNION ALL SELECT 'taxon', submission_feature_property_taxon_id, submission_feature_id, feature_type_property_id, blueprint_feature_type_property_id FROM submission_feature_property_taxon
  UNION ALL SELECT 'geometry', submission_feature_property_geometry_id, submission_feature_id, feature_type_property_id, blueprint_feature_type_property_id FROM submission_feature_property_geometry
  UNION ALL SELECT 'feature', submission_feature_property_feature_id, submission_feature_id, feature_type_property_id, blueprint_feature_type_property_id FROM submission_feature_property_feature
),
resolved AS (
  SELECT t.tbl, t.row_id, COUNT(bftp.blueprint_feature_type_property_id) AS candidates
  FROM typed t
  JOIN submission_feature sf ON sf.submission_feature_id = t.submission_feature_id
  JOIN submission_upload su ON su.submission_upload_id = sf.submission_upload_id
  JOIN feature_type_property ftp ON ftp.feature_type_property_id = t.feature_type_property_id
  LEFT JOIN blueprint_feature_type bft ON bft.blueprint_id = su.blueprint_id AND bft.feature_type_id = sf.feature_type_id
  LEFT JOIN blueprint_feature_type_property bftp ON bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id AND bftp.feature_property_id = ftp.feature_property_id
  WHERE t.blueprint_feature_type_property_id IS NULL
  GROUP BY t.tbl, t.row_id
)
SELECT tbl, candidates, COUNT(*) AS rows, (array_agg(row_id ORDER BY row_id))[1:50] AS first_ids
FROM resolved
WHERE candidates <> 1
GROUP BY tbl, candidates
ORDER BY tbl, candidates;

-- 2. Stored values whose assignment belongs to another Blueprint or feature type. Expected: 0 rows.
WITH typed AS (
  SELECT 'string' AS tbl, submission_feature_property_string_id AS row_id, submission_feature_id, blueprint_feature_type_property_id FROM submission_feature_property_string
  UNION ALL SELECT 'number', submission_feature_property_number_id, submission_feature_id, blueprint_feature_type_property_id FROM submission_feature_property_number
  UNION ALL SELECT 'boolean', submission_feature_property_boolean_id, submission_feature_id, blueprint_feature_type_property_id FROM submission_feature_property_boolean
  UNION ALL SELECT 'timestamp', submission_feature_property_timestamp_id, submission_feature_id, blueprint_feature_type_property_id FROM submission_feature_property_timestamp
  UNION ALL SELECT 'code', submission_feature_property_code_id, submission_feature_id, blueprint_feature_type_property_id FROM submission_feature_property_code
  UNION ALL SELECT 'taxon', submission_feature_property_taxon_id, submission_feature_id, blueprint_feature_type_property_id FROM submission_feature_property_taxon
  UNION ALL SELECT 'geometry', submission_feature_property_geometry_id, submission_feature_id, blueprint_feature_type_property_id FROM submission_feature_property_geometry
  UNION ALL SELECT 'feature', submission_feature_property_feature_id, submission_feature_id, blueprint_feature_type_property_id FROM submission_feature_property_feature
  UNION ALL SELECT 'artifact', submission_feature_property_artifact_id, submission_feature_id, blueprint_feature_type_property_id FROM submission_feature_property_artifact
)
SELECT t.tbl, COUNT(*) AS rows, (array_agg(t.row_id ORDER BY t.row_id))[1:50] AS first_ids
FROM typed t
JOIN submission_feature sf ON sf.submission_feature_id = t.submission_feature_id
JOIN submission_upload su ON su.submission_upload_id = sf.submission_upload_id
JOIN blueprint_feature_type_property bftp ON bftp.blueprint_feature_type_property_id = t.blueprint_feature_type_property_id
JOIN blueprint_feature_type bft ON bft.blueprint_feature_type_id = bftp.blueprint_feature_type_id
WHERE bft.blueprint_id <> su.blueprint_id OR bft.feature_type_id <> sf.feature_type_id
GROUP BY t.tbl;

-- 3. Ingestion error rows whose pairing does not map to exactly one assignment in the upload's Blueprint.
--    Expected: 0 rows.
SELECT e.submission_feature_error_id, COUNT(bftp.blueprint_feature_type_property_id) AS candidates
FROM submission_feature_error e
JOIN submission_upload su ON su.submission_upload_id = e.submission_upload_id
JOIN feature_type_property ftp ON ftp.feature_type_property_id = e.feature_type_property_id
LEFT JOIN blueprint_feature_type bft ON bft.blueprint_id = su.blueprint_id AND bft.feature_type_id = ftp.feature_type_id
LEFT JOIN blueprint_feature_type_property bftp ON bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id AND bftp.feature_property_id = ftp.feature_property_id
WHERE e.feature_type_property_id IS NOT NULL
GROUP BY e.submission_feature_error_id
HAVING COUNT(bftp.blueprint_feature_type_property_id) <> 1;

-- 4. Predicates narrowed to a pairing carried by zero or several assignments. Expected: 0 rows.
SELECT p.predicate_id, p.feature_type_property_id, COUNT(bftp.blueprint_feature_type_property_id) AS candidates
FROM predicate p
LEFT JOIN blueprint_feature_type_property bftp ON bftp.feature_type_property_id = p.feature_type_property_id
WHERE p.feature_type_property_id IS NOT NULL
GROUP BY p.predicate_id, p.feature_type_property_id
HAVING COUNT(bftp.blueprint_feature_type_property_id) <> 1;

-- 5. Allowed-target declarations for a pairing no assignment carries. Expected: 0 rows.
SELECT f.feature_type_property_feature_id, f.feature_type_property_id
FROM feature_type_property_feature f
WHERE NOT EXISTS (
  SELECT 1 FROM blueprint_feature_type_property bftp WHERE bftp.feature_type_property_id = f.feature_type_property_id
);

-- 6. Informational: size of what the migrations touch.
SELECT
  (SELECT COUNT(*) FROM predicate WHERE feature_type_property_id IS NOT NULL) AS narrowed_predicates,
  (SELECT COUNT(*) FROM predicate WHERE record_end_date IS NULL) AS active_predicates,
  (SELECT COUNT(*) FROM submission_feature_error WHERE feature_type_property_id IS NOT NULL) AS property_errors,
  (SELECT COUNT(*) FROM feature_type_property_feature) AS target_declarations,
  (SELECT COUNT(*) FROM blueprint WHERE is_default AND record_end_date IS NULL) AS active_default_blueprints,
  (SELECT COUNT(*) FROM submission_feature_artifact sfa
     WHERE NOT EXISTS (SELECT 1 FROM submission_feature_property_artifact p WHERE p.artifact_id = sfa.artifact_id AND p.submission_feature_id = sfa.submission_feature_id)) AS artifacts_without_property_row;
