import SQL from 'sql-template-strings';
import { z } from 'zod';
import { BaseRepository } from './base-repository';

const ErrorCountRow = z.object({
  error_code: z.string(),
  error_count: z.number()
});

const IngestionErrorTotalCountRow = z.object({
  count: z.number()
});

const IngestionErrorSampleRow = z.object({
  submission_feature_id: z.number().nullable(),
  property_name: z.string().nullable(),
  feature_type_property_id: z.number().nullable(),
  error_code: z.string(),
  error_message: z.string(),
  raw_value: z.any().nullable(),
  details: z.any().nullable()
});

export type IngestionErrorSample = z.infer<typeof IngestionErrorSampleRow>;
export type IngestionErrorCount = z.infer<typeof ErrorCountRow>;

/**
 * Upload-scoped repository for set-based submission feature property ingestion.
 *
 * Important: temp working tables in this repository are session-scoped under `pg_temp`.
 * Callers must execute all phases for a job on a single open DB connection.
 */
export class SubmissionFeaturePropertyIngestionRepository extends BaseRepository {
  /**
   * Delete previously derived canonical property rows for one upload.
   *
   * This keeps reruns idempotent by removing all typed-property and artifact-link rows that
   * were derived from `submission_feature.data.properties` for the upload.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async deletePropertyRecordsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      WITH upload_features AS (
        SELECT submission_feature_id
        FROM submission_feature
        WHERE submission_upload_id = ${submissionUploadId}::uuid
          AND record_end_date IS NULL
      ),
      delete_artifact AS (
        DELETE FROM submission_feature_artifact sfa
        USING upload_features uf
        WHERE sfa.submission_feature_id = uf.submission_feature_id
        RETURNING 1
      ),
      delete_string AS (
        DELETE FROM submission_feature_property_string sfps
        USING upload_features uf
        WHERE sfps.submission_feature_id = uf.submission_feature_id
        RETURNING 1
      ),
      delete_number AS (
        DELETE FROM submission_feature_property_number sfpn
        USING upload_features uf
        WHERE sfpn.submission_feature_id = uf.submission_feature_id
        RETURNING 1
      ),
      delete_boolean AS (
        DELETE FROM submission_feature_property_boolean sfpb
        USING upload_features uf
        WHERE sfpb.submission_feature_id = uf.submission_feature_id
        RETURNING 1
      ),
      delete_timestamp AS (
        DELETE FROM submission_feature_property_timestamp sfpt
        USING upload_features uf
        WHERE sfpt.submission_feature_id = uf.submission_feature_id
        RETURNING 1
      ),
      delete_geometry AS (
        DELETE FROM submission_feature_property_geometry sfpg
        USING upload_features uf
        WHERE sfpg.submission_feature_id = uf.submission_feature_id
        RETURNING 1
      ),
      delete_code AS (
        DELETE FROM submission_feature_property_code sfpc
        USING upload_features uf
        WHERE sfpc.submission_feature_id = uf.submission_feature_id
        RETURNING 1
      ),
      delete_taxon AS (
        DELETE FROM submission_feature_property_taxon sfptx
        USING upload_features uf
        WHERE sfptx.submission_feature_id = uf.submission_feature_id
        RETURNING 1
      )
      SELECT 1;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Delete all staged property rows for one upload from the persistent staging table.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async deleteStagingRowsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      DELETE FROM submission_feature_property_staging
      WHERE submission_upload_id = ${submissionUploadId}::uuid;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Delete all temp ingestion error rows for one upload.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async deleteIngestionErrorsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      DELETE FROM pg_temp.submission_feature_ingestion_error
      WHERE submission_upload_id = ${submissionUploadId}::uuid;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Expand `submission_feature.data.properties` into upload-scoped staging rows.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async stageExpandedPropertiesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      INSERT INTO submission_feature_property_staging (
        submission_feature_id,
        submission_upload_id,
        property_name,
        value
      )
      SELECT
        sf.submission_feature_id,
        sf.submission_upload_id,
        props.key,
        props.value
      FROM submission_feature sf
      CROSS JOIN LATERAL jsonb_each(
        CASE
          WHEN jsonb_typeof(sf.data -> 'properties') = 'object' THEN sf.data -> 'properties'
          ELSE '{}'::jsonb
        END
      ) AS props
      WHERE sf.submission_upload_id = ${submissionUploadId}::uuid
        AND sf.record_end_date IS NULL;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Create the session-scoped ingestion diagnostics table in `pg_temp`.
   *
   * @returns {Promise<void>}
   */
  async createIngestionErrorTempTable(): Promise<void> {
    const sql = SQL`
      CREATE TEMP TABLE IF NOT EXISTS pg_temp.submission_feature_ingestion_error (
        submission_feature_ingestion_error_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        submission_upload_id uuid NOT NULL,
        submission_feature_id integer,
        property_name text,
        feature_type_property_id integer,
        error_code text NOT NULL,
        error_message text NOT NULL,
        raw_value jsonb,
        details jsonb,
        create_date timestamptz(6) DEFAULT now() NOT NULL
      ) ON COMMIT DROP;
    `;
    await this.connection.sql(sql);
  }

  /**
   * Create an upload-scope index on `pg_temp.submission_feature_ingestion_error`.
   *
   * @returns {Promise<void>}
   */
  async createIngestionErrorTempUploadIndex(): Promise<void> {
    const sql = SQL`
      CREATE INDEX IF NOT EXISTS tmp_submission_feature_ingestion_error_idx1
      ON pg_temp.submission_feature_ingestion_error (submission_upload_id);
    `;
    await this.connection.sql(sql);
  }

  /**
   * Create an upload-and-error-code index on `pg_temp.submission_feature_ingestion_error`.
   *
   * @returns {Promise<void>}
   */
  async createIngestionErrorTempErrorCodeIndex(): Promise<void> {
    const sql = SQL`
      CREATE INDEX IF NOT EXISTS tmp_submission_feature_ingestion_error_idx2
      ON pg_temp.submission_feature_ingestion_error (submission_upload_id, error_code);
    `;
    await this.connection.sql(sql);
  }

  /**
   * Create an upload-and-feature index on `pg_temp.submission_feature_ingestion_error`.
   *
   * @returns {Promise<void>}
   */
  async createIngestionErrorTempFeatureIndex(): Promise<void> {
    const sql = SQL`
      CREATE INDEX IF NOT EXISTS tmp_submission_feature_ingestion_error_idx3
      ON pg_temp.submission_feature_ingestion_error (submission_upload_id, submission_feature_id);
    `;
    await this.connection.sql(sql);
  }

  /**
   * Drop `pg_temp.tmp_upload_property_values` if it exists.
   *
   * @returns {Promise<void>}
   */
  async dropTmpUploadPropertyValuesTable(): Promise<void> {
    const sql = SQL`DROP TABLE IF EXISTS pg_temp.tmp_upload_property_values;`;
    await this.connection.sql(sql);
  }

  /**
   * Drop `pg_temp.tmp_resolved_staged_properties` if it exists.
   *
   * @returns {Promise<void>}
   */
  async dropTmpResolvedStagedPropertiesTable(): Promise<void> {
    const sql = SQL`DROP TABLE IF EXISTS pg_temp.tmp_resolved_staged_properties;`;
    await this.connection.sql(sql);
  }

  /**
   * Drop `pg_temp.tmp_resolved_feature_type_property_keys` if it exists.
   *
   * @returns {Promise<void>}
   */
  async dropTmpResolvedFeatureTypePropertyKeysTable(): Promise<void> {
    const sql = SQL`DROP TABLE IF EXISTS pg_temp.tmp_resolved_feature_type_property_keys;`;
    await this.connection.sql(sql);
  }

  /**
   * Drop `pg_temp.tmp_upload_feature_type_property_keys` if it exists.
   *
   * @returns {Promise<void>}
   */
  async dropTmpUploadFeatureTypePropertyKeysTable(): Promise<void> {
    const sql = SQL`DROP TABLE IF EXISTS pg_temp.tmp_upload_feature_type_property_keys;`;
    await this.connection.sql(sql);
  }

  /**
   * Drop `pg_temp.tmp_upload_feature_type_property_map` if it exists.
   *
   * @returns {Promise<void>}
   */
  async dropTmpUploadFeatureTypePropertyMapTable(): Promise<void> {
    const sql = SQL`DROP TABLE IF EXISTS pg_temp.tmp_upload_feature_type_property_map;`;
    await this.connection.sql(sql);
  }

  /**
   * Create `pg_temp.tmp_upload_feature_type_property_map` for an upload.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async createTmpUploadFeatureTypePropertyMapBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      CREATE TEMP TABLE pg_temp.tmp_upload_feature_type_property_map ON COMMIT DROP AS
      SELECT
        ftp.feature_type_id,
        fp.name AS property_name,
        ftp.feature_type_property_id,
        COALESCE(ftp.allow_multiple, false) AS allow_multiple,
        COALESCE(ftp.required_value, false) AS required_value,
        fpt.name AS property_type_name
      FROM feature_type_property ftp
      JOIN feature_property fp
        ON fp.feature_property_id = ftp.feature_property_id
       AND fp.record_end_date IS NULL
      JOIN feature_property_type fpt
        ON fpt.feature_property_type_id = fp.feature_property_type_id
       AND fpt.record_end_date IS NULL
      JOIN (
        SELECT DISTINCT feature_type_id
        FROM submission_feature
        WHERE submission_upload_id = ${submissionUploadId}::uuid
          AND record_end_date IS NULL
      ) upload_types
        ON upload_types.feature_type_id = ftp.feature_type_id
      WHERE ftp.record_end_date IS NULL;
    `;
    await this.connection.sql(sql);
  }

  /**
   * Create `(feature_type_id, property_name)` index on `pg_temp.tmp_upload_feature_type_property_map`.
   *
   * @returns {Promise<void>}
   */
  async createTmpUploadFeatureTypePropertyMapFeatureTypePropertyNameIndex(): Promise<void> {
    const sql = SQL`
      CREATE INDEX tmp_upload_feature_type_property_map_idx1
      ON pg_temp.tmp_upload_feature_type_property_map (feature_type_id, property_name);
    `;
    await this.connection.sql(sql);
  }

  /**
   * Create `feature_type_property_id` index on `pg_temp.tmp_upload_feature_type_property_map`.
   *
   * @returns {Promise<void>}
   */
  async createTmpUploadFeatureTypePropertyMapFeatureTypePropertyIdIndex(): Promise<void> {
    const sql = SQL`
      CREATE INDEX tmp_upload_feature_type_property_map_idx2
      ON pg_temp.tmp_upload_feature_type_property_map (feature_type_property_id);
    `;
    await this.connection.sql(sql);
  }

  /**
   * Create `pg_temp.tmp_upload_feature_type_property_keys` for an upload.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async createTmpUploadFeatureTypePropertyKeysBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      CREATE TEMP TABLE pg_temp.tmp_upload_feature_type_property_keys ON COMMIT DROP AS
      SELECT DISTINCT
        sf.feature_type_id,
        s.property_name
      FROM submission_feature_property_staging s
      JOIN submission_feature sf
        ON sf.submission_feature_id = s.submission_feature_id
       AND sf.submission_upload_id = ${submissionUploadId}::uuid
       AND sf.record_end_date IS NULL
      WHERE s.submission_upload_id = ${submissionUploadId}::uuid;
    `;
    await this.connection.sql(sql);
  }

  /**
   * Create `(feature_type_id, property_name)` index on `pg_temp.tmp_upload_feature_type_property_keys`.
   *
   * @returns {Promise<void>}
   */
  async createTmpUploadFeatureTypePropertyKeysIndex(): Promise<void> {
    const sql = SQL`
      CREATE INDEX tmp_upload_feature_type_property_keys_idx1
      ON pg_temp.tmp_upload_feature_type_property_keys (feature_type_id, property_name);
    `;
    await this.connection.sql(sql);
  }

  /**
   * Create `pg_temp.tmp_resolved_feature_type_property_keys`.
   *
   * @returns {Promise<void>}
   */
  async createTmpResolvedFeatureTypePropertyKeysTable(): Promise<void> {
    const sql = SQL`
      CREATE TEMP TABLE pg_temp.tmp_resolved_feature_type_property_keys ON COMMIT DROP AS
      SELECT
        k.feature_type_id,
        k.property_name,
        m.feature_type_property_id,
        m.allow_multiple,
        m.required_value,
        m.property_type_name
      FROM pg_temp.tmp_upload_feature_type_property_keys k
      LEFT JOIN pg_temp.tmp_upload_feature_type_property_map m
        ON m.feature_type_id = k.feature_type_id
       AND m.property_name = k.property_name;
    `;
    await this.connection.sql(sql);
  }

  /**
   * Create `(feature_type_id, property_name)` index on `pg_temp.tmp_resolved_feature_type_property_keys`.
   *
   * @returns {Promise<void>}
   */
  async createTmpResolvedFeatureTypePropertyKeysFeatureTypePropertyNameIndex(): Promise<void> {
    const sql = SQL`
      CREATE INDEX tmp_resolved_feature_type_property_keys_idx1
      ON pg_temp.tmp_resolved_feature_type_property_keys (feature_type_id, property_name);
    `;
    await this.connection.sql(sql);
  }

  /**
   * Create `feature_type_property_id` index on `pg_temp.tmp_resolved_feature_type_property_keys`.
   *
   * @returns {Promise<void>}
   */
  async createTmpResolvedFeatureTypePropertyKeysFeatureTypePropertyIdIndex(): Promise<void> {
    const sql = SQL`
      CREATE INDEX tmp_resolved_feature_type_property_keys_idx2
      ON pg_temp.tmp_resolved_feature_type_property_keys (feature_type_property_id);
    `;
    await this.connection.sql(sql);
  }

  /**
   * Create `pg_temp.tmp_resolved_staged_properties` for an upload.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async createTmpResolvedStagedPropertiesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      CREATE TEMP TABLE pg_temp.tmp_resolved_staged_properties ON COMMIT DROP AS
      SELECT
        s.submission_feature_property_staging_id,
        s.submission_feature_id,
        s.submission_upload_id,
        sf.feature_type_id,
        s.property_name,
        s.value,
        r.feature_type_property_id,
        r.allow_multiple,
        r.required_value,
        r.property_type_name
      FROM submission_feature_property_staging s
      JOIN submission_feature sf
        ON sf.submission_feature_id = s.submission_feature_id
       AND sf.submission_upload_id = ${submissionUploadId}::uuid
       AND sf.record_end_date IS NULL
      LEFT JOIN pg_temp.tmp_resolved_feature_type_property_keys r
        ON r.feature_type_id = sf.feature_type_id
       AND r.property_name = s.property_name
      WHERE s.submission_upload_id = ${submissionUploadId}::uuid;
    `;
    await this.connection.sql(sql);
  }

  /**
   * Create `submission_feature_id` index on `pg_temp.tmp_resolved_staged_properties`.
   *
   * @returns {Promise<void>}
   */
  async createTmpResolvedStagedPropertiesSubmissionFeatureIndex(): Promise<void> {
    const sql = SQL`
      CREATE INDEX tmp_resolved_staged_properties_idx1
      ON pg_temp.tmp_resolved_staged_properties (submission_feature_id);
    `;
    await this.connection.sql(sql);
  }

  /**
   * Create `feature_type_property_id` index on `pg_temp.tmp_resolved_staged_properties`.
   *
   * @returns {Promise<void>}
   */
  async createTmpResolvedStagedPropertiesFeatureTypePropertyIndex(): Promise<void> {
    const sql = SQL`
      CREATE INDEX tmp_resolved_staged_properties_idx2
      ON pg_temp.tmp_resolved_staged_properties (feature_type_property_id);
    `;
    await this.connection.sql(sql);
  }

  /**
   * Create `property_type_name` index on `pg_temp.tmp_resolved_staged_properties`.
   *
   * @returns {Promise<void>}
   */
  async createTmpResolvedStagedPropertiesPropertyTypeIndex(): Promise<void> {
    const sql = SQL`
      CREATE INDEX tmp_resolved_staged_properties_idx3
      ON pg_temp.tmp_resolved_staged_properties (property_type_name);
    `;
    await this.connection.sql(sql);
  }

  /**
   * Create `pg_temp.tmp_upload_property_values` with one logical value per row.
   *
   * Note: `jsonb_typeof(...)= 'array'` here is checking JSON transport shape only.
   * It is not a logical `feature_property_type` of `array`. Logical multiplicity is
   * controlled by `allow_multiple` on `feature_type_property`.
   *
   * @returns {Promise<void>}
   */
  async createTmpUploadPropertyValuesTable(): Promise<void> {
    const sql = SQL`
      CREATE TEMP TABLE pg_temp.tmp_upload_property_values ON COMMIT DROP AS
      SELECT
        rsp.submission_feature_id,
        rsp.submission_upload_id,
        rsp.feature_type_id,
        rsp.feature_type_property_id,
        rsp.property_name,
        rsp.property_type_name,
        rsp.allow_multiple,
        rsp.value AS logical_value
      FROM pg_temp.tmp_resolved_staged_properties rsp
      WHERE rsp.feature_type_property_id IS NOT NULL
        AND jsonb_typeof(rsp.value) <> 'array'
        AND rsp.value IS NOT NULL
        AND rsp.value <> 'null'::jsonb
      UNION ALL
      SELECT
        rsp.submission_feature_id,
        rsp.submission_upload_id,
        rsp.feature_type_id,
        rsp.feature_type_property_id,
        rsp.property_name,
        rsp.property_type_name,
        rsp.allow_multiple,
        arr.value AS logical_value
      FROM pg_temp.tmp_resolved_staged_properties rsp
      CROSS JOIN LATERAL jsonb_array_elements(rsp.value) AS arr(value)
      WHERE rsp.feature_type_property_id IS NOT NULL
        AND jsonb_typeof(rsp.value) = 'array'
        AND rsp.allow_multiple = TRUE
        AND arr.value <> 'null'::jsonb;
    `;
    await this.connection.sql(sql);
  }

  /**
   * Create `property_type_name` index on `pg_temp.tmp_upload_property_values`.
   *
   * @returns {Promise<void>}
   */
  async createTmpUploadPropertyValuesPropertyTypeIndex(): Promise<void> {
    const sql = SQL`
      CREATE INDEX tmp_upload_property_values_idx1
      ON pg_temp.tmp_upload_property_values (property_type_name);
    `;
    await this.connection.sql(sql);
  }

  /**
   * Create `feature_type_property_id` index on `pg_temp.tmp_upload_property_values`.
   *
   * @returns {Promise<void>}
   */
  async createTmpUploadPropertyValuesFeatureTypePropertyIndex(): Promise<void> {
    const sql = SQL`
      CREATE INDEX tmp_upload_property_values_idx2
      ON pg_temp.tmp_upload_property_values (feature_type_property_id);
    `;
    await this.connection.sql(sql);
  }

  /**
   * Create `submission_feature_id` index on `pg_temp.tmp_upload_property_values`.
   *
   * @returns {Promise<void>}
   */
  async createTmpUploadPropertyValuesSubmissionFeatureIndex(): Promise<void> {
    const sql = SQL`
      CREATE INDEX tmp_upload_property_values_idx3
      ON pg_temp.tmp_upload_property_values (submission_feature_id);
    `;
    await this.connection.sql(sql);
  }

  /**
   * Record missing required-property errors for features in an upload.
   *
   * Requiredness is evaluated by feature type against active metadata. A required property is
   * considered present only when staging has a non-null value and, for arrays, at least one element.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async recordMissingRequiredPropertyErrorsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      WITH required_properties AS (
        SELECT
          feature_type_id,
          feature_type_property_id,
          property_name
        FROM pg_temp.tmp_upload_feature_type_property_map
        WHERE required_value = TRUE
      ),
      present_properties AS (
        SELECT DISTINCT
          rsp.submission_feature_id,
          rsp.feature_type_property_id
        FROM pg_temp.tmp_resolved_staged_properties rsp
        WHERE rsp.feature_type_property_id IS NOT NULL
          AND rsp.value IS NOT NULL
          AND rsp.value <> 'null'::jsonb
          AND NOT (jsonb_typeof(rsp.value) = 'array' AND jsonb_array_length(rsp.value) = 0)
      )
      INSERT INTO pg_temp.submission_feature_ingestion_error (
        submission_upload_id,
        submission_feature_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        raw_value
      )
      SELECT
        sf.submission_upload_id,
        sf.submission_feature_id,
        rp.property_name,
        rp.feature_type_property_id,
        'MISSING_REQUIRED_PROPERTY',
        'Missing required property value',
        NULL::jsonb
      FROM submission_feature sf
      JOIN required_properties rp
        ON rp.feature_type_id = sf.feature_type_id
      LEFT JOIN present_properties pp
        ON pp.submission_feature_id = sf.submission_feature_id
       AND pp.feature_type_property_id = rp.feature_type_property_id
      WHERE sf.submission_upload_id = ${submissionUploadId}::uuid
        AND sf.record_end_date IS NULL
        AND pp.submission_feature_id IS NULL;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Record primitive/cardinality validation errors for staged property values.
   *
   * This phase captures:
   * - array cardinality violations when `allow_multiple = false`
   * - JSON primitive type mismatches by logical property type
   * - unsupported logical property types
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async recordPrimitiveValidationErrorsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      WITH cardinality_errors AS (
        SELECT
          m.submission_upload_id,
          m.submission_feature_id,
          m.property_name,
          m.feature_type_property_id,
          'MULTIPLE_VALUES_NOT_ALLOWED'::text AS error_code,
          'Property does not allow multiple values'::text AS error_message,
          m.value AS raw_value
        FROM pg_temp.tmp_resolved_staged_properties m
        WHERE m.feature_type_property_id IS NOT NULL
          AND jsonb_typeof(m.value) = 'array'
          AND m.allow_multiple = FALSE
      ),
      type_errors AS (
        SELECT
          v.submission_upload_id,
          v.submission_feature_id,
          v.property_name,
          v.feature_type_property_id,
          CASE
            WHEN v.property_type_name = 'taxon' THEN 'INVALID_TAXON_VALUE'
            WHEN v.property_type_name = 'spatial' THEN 'INVALID_SPATIAL_VALUE'
            ELSE 'TYPE_MISMATCH'
          END AS error_code,
          CASE
            WHEN v.property_type_name = 'taxon' THEN 'Taxon property value must be an integer TSN'
            WHEN v.property_type_name = 'spatial' THEN 'Spatial property value must be a GeoJSON object'
            ELSE 'Property value type mismatch'
          END AS error_message,
          v.logical_value AS raw_value
        FROM pg_temp.tmp_upload_property_values v
        WHERE
          (
            v.property_type_name IN ('string', 'datetime', 'code', 'artifact_key')
            AND jsonb_typeof(v.logical_value) <> 'string'
          )
          OR (
            v.property_type_name = 'number'
            AND jsonb_typeof(v.logical_value) <> 'number'
          )
          OR (
            v.property_type_name = 'boolean'
            AND jsonb_typeof(v.logical_value) <> 'boolean'
          )
          OR (
            v.property_type_name = 'taxon'
            AND (
              jsonb_typeof(v.logical_value) <> 'number'
              OR (v.logical_value #>> '{}') !~ '^-?[0-9]+$'
            )
          )
          OR (
            v.property_type_name = 'spatial'
            AND jsonb_typeof(v.logical_value) <> 'object'
          )
      ),
      unsupported_type_errors AS (
        SELECT
          m.submission_upload_id,
          m.submission_feature_id,
          m.property_name,
          m.feature_type_property_id,
          'UNSUPPORTED_PROPERTY_TYPE'::text AS error_code,
          'Unsupported property type'::text AS error_message,
          m.value AS raw_value
        FROM pg_temp.tmp_resolved_staged_properties m
        WHERE m.feature_type_property_id IS NOT NULL
          AND m.property_type_name NOT IN (
            'string',
            'number',
            'boolean',
            'datetime',
            'spatial',
            'artifact_key',
            'code',
            'taxon'
          )
      )
      INSERT INTO pg_temp.submission_feature_ingestion_error (
        submission_upload_id,
        submission_feature_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        raw_value
      )
      SELECT * FROM cardinality_errors
      UNION ALL
      SELECT * FROM type_errors
      UNION ALL
      SELECT * FROM unsupported_type_errors;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Record malformed or unresolved code property references.
   *
   * @param {string} submissionUploadId Upload scope.
   * @param {number} contributorId Contributor scope for code resolution.
   * @returns {Promise<void>}
   */
  async recordCodePropertyResolutionErrorsBySubmissionUploadId(
    submissionUploadId: string,
    contributorId: number
  ): Promise<void> {
    const sql = SQL`
      WITH candidates AS (
        SELECT
          v.submission_upload_id,
          v.submission_feature_id,
          v.property_name,
          v.feature_type_property_id,
          v.logical_value AS raw_value
        FROM pg_temp.tmp_upload_property_values v
        WHERE v.property_type_name = 'code'
          AND jsonb_typeof(v.logical_value) = 'string'
          AND NOT EXISTS (
            SELECT 1
            FROM pg_temp.submission_feature_ingestion_error e
            WHERE e.submission_upload_id = ${submissionUploadId}::uuid
              AND e.submission_feature_id = v.submission_feature_id
              AND e.feature_type_property_id = v.feature_type_property_id
              AND COALESCE(e.property_name, '') = COALESCE(v.property_name, '')
          )
      ),
      parsed AS (
        SELECT
          c.*,
          regexp_split_to_array(btrim(c.raw_value #>> '{}'), '::') AS parts
        FROM candidates c
      ),
      format_errors AS (
        SELECT
          p.submission_upload_id,
          p.submission_feature_id,
          p.property_name,
          p.feature_type_property_id,
          'INVALID_CODE_REFERENCE_FORMAT'::text AS error_code,
          'Code property value must match code::<contributor-codeset-key>::<contributor-codeset-code-key>'::text AS error_message,
          p.raw_value,
          NULL::jsonb AS details
        FROM parsed p
        WHERE cardinality(p.parts) <> 3
           OR p.parts[1] <> 'code'
           OR btrim(p.parts[2]) = ''
           OR btrim(p.parts[3]) = ''
      ),
      parsed_valid AS (
        SELECT
          p.submission_upload_id,
          p.submission_feature_id,
          p.property_name,
          p.feature_type_property_id,
          p.raw_value,
          btrim(p.parts[2]) AS contributor_codeset_key,
          btrim(p.parts[3]) AS contributor_codeset_code_key,
          ('code::' || btrim(p.parts[2]) || '::' || btrim(p.parts[3])) AS normalized_slug
        FROM parsed p
        WHERE cardinality(p.parts) = 3
          AND p.parts[1] = 'code'
          AND btrim(p.parts[2]) <> ''
          AND btrim(p.parts[3]) <> ''
      ),
      distinct_values AS (
        SELECT DISTINCT
          contributor_codeset_key,
          contributor_codeset_code_key,
          normalized_slug
        FROM parsed_valid
      ),
      resolved_values AS (
        SELECT
          dv.normalized_slug,
          ccc.contributor_codeset_code_id
        FROM distinct_values dv
        LEFT JOIN contributor_codeset cc
          ON cc.contributor_id = ${contributorId}
         AND cc.key = dv.contributor_codeset_key
         AND cc.record_end_date IS NULL
        LEFT JOIN contributor_codeset_code ccc
          ON ccc.contributor_codeset_id = cc.contributor_codeset_id
         AND ccc.key = dv.contributor_codeset_code_key
         AND ccc.record_end_date IS NULL
      ),
      unresolved AS (
        SELECT
          pv.submission_upload_id,
          pv.submission_feature_id,
          pv.property_name,
          pv.feature_type_property_id,
          'UNRESOLVED_CODE_REFERENCE'::text AS error_code,
          'Failed to resolve code slug to contributor_codeset_code_id'::text AS error_message,
          pv.raw_value,
          jsonb_build_object('normalized_code_slug', pv.normalized_slug) AS details
        FROM parsed_valid pv
        LEFT JOIN resolved_values rv
          ON rv.normalized_slug = pv.normalized_slug
        WHERE rv.contributor_codeset_code_id IS NULL
      )
      INSERT INTO pg_temp.submission_feature_ingestion_error (
        submission_upload_id,
        submission_feature_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        raw_value,
        details
      )
      SELECT * FROM format_errors
      UNION ALL
      SELECT * FROM unresolved;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Record unresolved taxon TSN values for taxon properties.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async recordTaxonPropertyResolutionErrorsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      WITH candidates AS (
        SELECT
          v.submission_upload_id,
          v.submission_feature_id,
          v.property_name,
          v.feature_type_property_id,
          v.logical_value AS raw_value
        FROM pg_temp.tmp_upload_property_values v
        WHERE v.property_type_name = 'taxon'
          AND jsonb_typeof(v.logical_value) = 'number'
          AND (v.logical_value #>> '{}') ~ '^-?[0-9]+$'
          AND NOT EXISTS (
            SELECT 1
            FROM pg_temp.submission_feature_ingestion_error e
            WHERE e.submission_upload_id = ${submissionUploadId}::uuid
              AND e.submission_feature_id = v.submission_feature_id
              AND e.feature_type_property_id = v.feature_type_property_id
              AND COALESCE(e.property_name, '') = COALESCE(v.property_name, '')
          )
      ),
      distinct_values AS (
        SELECT DISTINCT
          (c.raw_value #>> '{}')::integer AS tsn
        FROM candidates c
      ),
      resolved_values AS (
        SELECT
          dv.tsn,
          t.taxon_id
        FROM distinct_values dv
        LEFT JOIN taxon t
          ON t.itis_tsn = dv.tsn
         AND t.record_end_date IS NULL
      )
      INSERT INTO pg_temp.submission_feature_ingestion_error (
        submission_upload_id,
        submission_feature_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        raw_value
      )
      SELECT
        c.submission_upload_id,
        c.submission_feature_id,
        c.property_name,
        c.feature_type_property_id,
        'UNRESOLVED_TAXON',
        'Failed to resolve taxon TSN to taxon_id',
        c.raw_value
      FROM candidates c
      LEFT JOIN resolved_values rv
        ON rv.tsn = (c.raw_value #>> '{}')::integer
      WHERE rv.taxon_id IS NULL;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Record unresolved or invalid artifact references for artifact-backed properties.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async recordArtifactPropertyResolutionErrorsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      WITH upload_scope AS (
        SELECT su.upload_id
        FROM submission_upload su
        WHERE su.submission_upload_id = ${submissionUploadId}::uuid
        LIMIT 1
      ),
      candidates AS (
        SELECT
          v.submission_upload_id,
          v.submission_feature_id,
          v.property_name,
          v.feature_type_property_id,
          v.logical_value AS raw_value
        FROM pg_temp.tmp_upload_property_values v
        WHERE v.property_type_name = 'artifact_key'
          AND jsonb_typeof(v.logical_value) = 'string'
          AND NOT EXISTS (
            SELECT 1
            FROM pg_temp.submission_feature_ingestion_error e
            WHERE e.submission_upload_id = ${submissionUploadId}::uuid
              AND e.submission_feature_id = v.submission_feature_id
              AND e.feature_type_property_id = v.feature_type_property_id
              AND COALESCE(e.property_name, '') = COALESCE(v.property_name, '')
          )
      ),
      normalized AS (
        SELECT
          c.*,
          regexp_replace(
            CASE
              WHEN btrim(c.raw_value #>> '{}') LIKE 'files/%' THEN substring(btrim(c.raw_value #>> '{}') FROM 7)
              ELSE btrim(c.raw_value #>> '{}')
            END,
            '^/+',
            ''
          ) AS normalized_reference
        FROM candidates c
      ),
      distinct_values AS (
        SELECT DISTINCT
          normalized_reference
        FROM normalized
        WHERE COALESCE(normalized_reference, '') <> ''
      ),
      resolved_values AS (
        SELECT
          dv.normalized_reference,
          ua.artifact_id
        FROM distinct_values dv
        CROSS JOIN upload_scope us
        LEFT JOIN upload_artifact ua
          ON ua.upload_id = us.upload_id
         AND ua.path = dv.normalized_reference
      ),
      normalized_empty AS (
        SELECT
          n.submission_upload_id,
          n.submission_feature_id,
          n.property_name,
          n.feature_type_property_id,
          'INVALID_ARTIFACT_REFERENCE'::text AS error_code,
          'Artifact key resolved to an empty normalized reference'::text AS error_message,
          n.raw_value,
          NULL::jsonb AS details
        FROM normalized n
        WHERE COALESCE(n.normalized_reference, '') = ''
      ),
      unresolved AS (
        SELECT
          n.submission_upload_id,
          n.submission_feature_id,
          n.property_name,
          n.feature_type_property_id,
          'UNRESOLVED_ARTIFACT_REFERENCE'::text AS error_code,
          'Failed to resolve artifact reference to artifact_id'::text AS error_message,
          n.raw_value,
          jsonb_build_object('normalized_reference', n.normalized_reference) AS details
        FROM normalized n
        LEFT JOIN resolved_values rv
          ON rv.normalized_reference = n.normalized_reference
        WHERE COALESCE(n.normalized_reference, '') <> ''
          AND rv.artifact_id IS NULL
      )
      INSERT INTO pg_temp.submission_feature_ingestion_error (
        submission_upload_id,
        submission_feature_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        raw_value,
        details
      )
      SELECT * FROM normalized_empty
      UNION ALL
      SELECT * FROM unresolved;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Record invalid datetime normalization/parsing errors.
   *
   * Datetime strings are parsed into split `date_value` and `time_value` semantics. Rows where both
   * parsed components are null are flagged as invalid timestamp values.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async recordDatetimeNormalizationErrorsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      WITH candidates AS (
        SELECT
          v.submission_upload_id,
          v.submission_feature_id,
          v.property_name,
          v.feature_type_property_id,
          btrim(v.logical_value #>> '{}') AS value_text,
          v.logical_value AS raw_value
        FROM pg_temp.tmp_upload_property_values v
        WHERE v.property_type_name = 'datetime'
          AND jsonb_typeof(v.logical_value) = 'string'
          AND NOT EXISTS (
            SELECT 1
            FROM pg_temp.submission_feature_ingestion_error e
            WHERE e.submission_upload_id = ${submissionUploadId}::uuid
              AND e.submission_feature_id = v.submission_feature_id
              AND e.feature_type_property_id = v.feature_type_property_id
              AND COALESCE(e.property_name, '') = COALESCE(v.property_name, '')
          )
      ),
      parsed AS (
        SELECT
          c.*,
          CASE
            WHEN c.value_text ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN c.value_text::date
            WHEN c.value_text ~ '^\\d{4}-\\d{2}-\\d{2}[T\\s]\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,6})?)?(Z|[+-]\\d{2}:\\d{2})?$'
              THEN substring(c.value_text FROM 1 FOR 10)::date
            ELSE NULL::date
          END AS date_value,
          CASE
            WHEN c.value_text ~ '^\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,6})?)?$' THEN c.value_text::time
            WHEN c.value_text ~ '^\\d{4}-\\d{2}-\\d{2}[T\\s]\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,6})?)?(Z|[+-]\\d{2}:\\d{2})?$'
              THEN regexp_replace(
                regexp_replace(c.value_text, '^\\d{4}-\\d{2}-\\d{2}[T\\s]', ''),
                '(Z|[+-]\\d{2}:\\d{2})$',
                ''
              )::time
            ELSE NULL::time
          END AS time_value
        FROM candidates c
      )
      INSERT INTO pg_temp.submission_feature_ingestion_error (
        submission_upload_id,
        submission_feature_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        raw_value
      )
      SELECT
        p.submission_upload_id,
        p.submission_feature_id,
        p.property_name,
        p.feature_type_property_id,
        'INVALID_TIMESTAMP_VALUE',
        'Invalid timestamp property value',
        p.raw_value
      FROM parsed p
      WHERE p.date_value IS NULL
        AND p.time_value IS NULL;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Insert valid datetime values into `submission_feature_property_timestamp`.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async insertTimestampPropertiesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      WITH candidates AS (
        SELECT
          v.submission_feature_id,
          v.property_name,
          v.feature_type_property_id,
          btrim(v.logical_value #>> '{}') AS value_text
        FROM pg_temp.tmp_upload_property_values v
        WHERE v.property_type_name = 'datetime'
          AND jsonb_typeof(v.logical_value) = 'string'
          AND NOT EXISTS (
            SELECT 1
            FROM pg_temp.submission_feature_ingestion_error e
            WHERE e.submission_upload_id = ${submissionUploadId}::uuid
              AND e.submission_feature_id = v.submission_feature_id
              AND e.feature_type_property_id = v.feature_type_property_id
              AND COALESCE(e.property_name, '') = COALESCE(v.property_name, '')
          )
      ),
      parsed AS (
        SELECT
          c.submission_feature_id,
          c.feature_type_property_id,
          CASE
            WHEN c.value_text ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN c.value_text::date
            WHEN c.value_text ~ '^\\d{4}-\\d{2}-\\d{2}[T\\s]\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,6})?)?(Z|[+-]\\d{2}:\\d{2})?$'
              THEN substring(c.value_text FROM 1 FOR 10)::date
            ELSE NULL::date
          END AS date_value,
          CASE
            WHEN c.value_text ~ '^\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,6})?)?$' THEN c.value_text::time
            WHEN c.value_text ~ '^\\d{4}-\\d{2}-\\d{2}[T\\s]\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,6})?)?(Z|[+-]\\d{2}:\\d{2})?$'
              THEN regexp_replace(
                regexp_replace(c.value_text, '^\\d{4}-\\d{2}-\\d{2}[T\\s]', ''),
                '(Z|[+-]\\d{2}:\\d{2})$',
                ''
              )::time
            ELSE NULL::time
          END AS time_value
        FROM candidates c
      )
      INSERT INTO submission_feature_property_timestamp (
        submission_feature_id,
        feature_type_property_id,
        date_value,
        time_value
      )
      SELECT
        p.submission_feature_id,
        p.feature_type_property_id,
        p.date_value,
        p.time_value
      FROM parsed p
      WHERE p.date_value IS NOT NULL
         OR p.time_value IS NOT NULL;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Record invalid spatial values after GeoJSON normalization and PostGIS validation.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async recordSpatialNormalizationErrorsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      WITH candidates AS (
        SELECT
          v.submission_upload_id,
          v.submission_feature_id,
          v.property_name,
          v.feature_type_property_id,
          v.logical_value
        FROM pg_temp.tmp_upload_property_values v
        WHERE v.property_type_name = 'spatial'
          AND jsonb_typeof(v.logical_value) = 'object'
          AND NOT EXISTS (
            SELECT 1
            FROM pg_temp.submission_feature_ingestion_error e
            WHERE e.submission_upload_id = ${submissionUploadId}::uuid
              AND e.submission_feature_id = v.submission_feature_id
              AND e.feature_type_property_id = v.feature_type_property_id
              AND COALESCE(e.property_name, '') = COALESCE(v.property_name, '')
          )
      ),
      normalized AS (
        SELECT
          c.*,
          CASE
            WHEN c.logical_value ->> 'type' = 'Feature' THEN c.logical_value -> 'geometry'
            WHEN c.logical_value ->> 'type' = 'FeatureCollection' THEN (
              SELECT CASE
                WHEN COUNT(*) = 0 THEN NULL::jsonb
                ELSE jsonb_build_object(
                  'type', 'GeometryCollection',
                  'geometries', jsonb_agg(feature_item.value -> 'geometry')
                )
              END
              FROM jsonb_array_elements(
                CASE
                  WHEN jsonb_typeof(c.logical_value -> 'features') = 'array' THEN c.logical_value -> 'features'
                  ELSE '[]'::jsonb
                END
              ) AS feature_item(value)
              WHERE jsonb_typeof(feature_item.value) = 'object'
                AND jsonb_typeof(feature_item.value -> 'geometry') = 'object'
            )
            ELSE c.logical_value
          END AS geometry_json
        FROM candidates c
      ),
      parsed AS (
        SELECT
          n.*,
          CASE
            WHEN n.geometry_json IS NULL OR jsonb_typeof(n.geometry_json) <> 'object' THEN NULL::geometry
            ELSE biohub.try_geom_from_geojson(n.geometry_json::text)
          END AS parsed_geom
        FROM normalized n
      )
      INSERT INTO pg_temp.submission_feature_ingestion_error (
        submission_upload_id,
        submission_feature_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        raw_value,
        details
      )
      SELECT
        p.submission_upload_id,
        p.submission_feature_id,
        p.property_name,
        p.feature_type_property_id,
        'INVALID_SPATIAL_VALUE',
        'Invalid geometry value for geometry property',
        p.logical_value,
        jsonb_build_object(
          'reason',
          CASE
            WHEN p.geometry_json IS NULL THEN 'Geometry payload is missing after normalization'
            WHEN p.parsed_geom IS NULL THEN 'Unable to parse geometry'
            ELSE public.ST_IsValidReason(p.parsed_geom)
          END
        )
      FROM parsed p
      WHERE p.geometry_json IS NULL
         OR p.parsed_geom IS NULL
         OR NOT public.ST_IsValid(p.parsed_geom);
    `;

    await this.connection.sql(sql);
  }

  /**
   * Insert valid spatial values into `submission_feature_property_geometry`.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async insertGeometryPropertiesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      WITH candidates AS (
        SELECT
          v.submission_feature_id,
          v.property_name,
          v.feature_type_property_id,
          v.logical_value
        FROM pg_temp.tmp_upload_property_values v
        WHERE v.property_type_name = 'spatial'
          AND jsonb_typeof(v.logical_value) = 'object'
          AND NOT EXISTS (
            SELECT 1
            FROM pg_temp.submission_feature_ingestion_error e
            WHERE e.submission_upload_id = ${submissionUploadId}::uuid
              AND e.submission_feature_id = v.submission_feature_id
              AND e.feature_type_property_id = v.feature_type_property_id
              AND COALESCE(e.property_name, '') = COALESCE(v.property_name, '')
          )
      ),
      normalized AS (
        SELECT
          c.*,
          CASE
            WHEN c.logical_value ->> 'type' = 'Feature' THEN c.logical_value -> 'geometry'
            WHEN c.logical_value ->> 'type' = 'FeatureCollection' THEN (
              SELECT CASE
                WHEN COUNT(*) = 0 THEN NULL::jsonb
                ELSE jsonb_build_object(
                  'type', 'GeometryCollection',
                  'geometries', jsonb_agg(feature_item.value -> 'geometry')
                )
              END
              FROM jsonb_array_elements(
                CASE
                  WHEN jsonb_typeof(c.logical_value -> 'features') = 'array' THEN c.logical_value -> 'features'
                  ELSE '[]'::jsonb
                END
              ) AS feature_item(value)
              WHERE jsonb_typeof(feature_item.value) = 'object'
                AND jsonb_typeof(feature_item.value -> 'geometry') = 'object'
            )
            ELSE c.logical_value
          END AS geometry_json
        FROM candidates c
      ),
      parsed AS (
        SELECT
          n.submission_feature_id,
          n.feature_type_property_id,
          CASE
            WHEN n.geometry_json IS NULL OR jsonb_typeof(n.geometry_json) <> 'object' THEN NULL::geometry
            ELSE biohub.try_geom_from_geojson(n.geometry_json::text)
          END AS parsed_geom
        FROM normalized n
      )
      INSERT INTO submission_feature_property_geometry (
        submission_feature_id,
        feature_type_property_id,
        value
      )
      SELECT
        p.submission_feature_id,
        p.feature_type_property_id,
        public.ST_Force2D(p.parsed_geom)
      FROM parsed p
      WHERE p.parsed_geom IS NOT NULL
        AND public.ST_IsValid(p.parsed_geom);
    `;

    await this.connection.sql(sql);
  }

  /**
   * Insert valid string properties into `submission_feature_property_string`.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async insertStringPropertiesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      INSERT INTO submission_feature_property_string (
        submission_feature_id,
        feature_type_property_id,
        value
      )
      SELECT
        v.submission_feature_id,
        v.feature_type_property_id,
        v.logical_value #>> '{}'
      FROM pg_temp.tmp_upload_property_values v
      WHERE v.property_type_name = 'string'
        AND jsonb_typeof(v.logical_value) = 'string'
        AND NOT EXISTS (
          SELECT 1
          FROM pg_temp.submission_feature_ingestion_error e
          WHERE e.submission_upload_id = ${submissionUploadId}::uuid
            AND e.submission_feature_id = v.submission_feature_id
            AND e.feature_type_property_id = v.feature_type_property_id
            AND COALESCE(e.property_name, '') = COALESCE(v.property_name, '')
        );
    `;

    await this.connection.sql(sql);
  }

  /**
   * Insert valid numeric properties into `submission_feature_property_number`.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async insertNumberPropertiesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      INSERT INTO submission_feature_property_number (
        submission_feature_id,
        feature_type_property_id,
        value
      )
      SELECT
        v.submission_feature_id,
        v.feature_type_property_id,
        (v.logical_value #>> '{}')::numeric
      FROM pg_temp.tmp_upload_property_values v
      WHERE v.property_type_name = 'number'
        AND jsonb_typeof(v.logical_value) = 'number'
        AND NOT EXISTS (
          SELECT 1
          FROM pg_temp.submission_feature_ingestion_error e
          WHERE e.submission_upload_id = ${submissionUploadId}::uuid
            AND e.submission_feature_id = v.submission_feature_id
            AND e.feature_type_property_id = v.feature_type_property_id
            AND COALESCE(e.property_name, '') = COALESCE(v.property_name, '')
        );
    `;

    await this.connection.sql(sql);
  }

  /**
   * Insert valid boolean properties into `submission_feature_property_boolean`.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async insertBooleanPropertiesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      INSERT INTO submission_feature_property_boolean (
        submission_feature_id,
        feature_type_property_id,
        value
      )
      SELECT
        v.submission_feature_id,
        v.feature_type_property_id,
        (v.logical_value #>> '{}')::boolean
      FROM pg_temp.tmp_upload_property_values v
      WHERE v.property_type_name = 'boolean'
        AND jsonb_typeof(v.logical_value) = 'boolean'
        AND NOT EXISTS (
          SELECT 1
          FROM pg_temp.submission_feature_ingestion_error e
          WHERE e.submission_upload_id = ${submissionUploadId}::uuid
            AND e.submission_feature_id = v.submission_feature_id
            AND e.feature_type_property_id = v.feature_type_property_id
            AND COALESCE(e.property_name, '') = COALESCE(v.property_name, '')
        );
    `;

    await this.connection.sql(sql);
  }

  /**
   * Insert valid resolved code references into `submission_feature_property_code`.
   *
   * @param {string} submissionUploadId Upload scope.
   * @param {number} contributorId Contributor scope for code resolution.
   * @returns {Promise<void>}
   */
  async insertCodePropertiesBySubmissionUploadId(submissionUploadId: string, contributorId: number): Promise<void> {
    const sql = SQL`
      WITH expanded AS (
        SELECT
          v.submission_feature_id,
          v.feature_type_property_id,
          v.logical_value AS raw_value
        FROM pg_temp.tmp_upload_property_values v
        WHERE v.property_type_name = 'code'
          AND jsonb_typeof(v.logical_value) = 'string'
          AND NOT EXISTS (
            SELECT 1
            FROM pg_temp.submission_feature_ingestion_error e
            WHERE e.submission_upload_id = ${submissionUploadId}::uuid
              AND e.submission_feature_id = v.submission_feature_id
              AND e.feature_type_property_id = v.feature_type_property_id
              AND COALESCE(e.property_name, '') = COALESCE(v.property_name, '')
          )
      ),
      parsed AS (
        SELECT
          e.submission_feature_id,
          e.feature_type_property_id,
          regexp_split_to_array(btrim(e.raw_value #>> '{}'), '::') AS parts
        FROM expanded e
      ),
      parsed_valid AS (
        SELECT
          p.submission_feature_id,
          p.feature_type_property_id,
          btrim(p.parts[2]) AS contributor_codeset_key,
          btrim(p.parts[3]) AS contributor_codeset_code_key
        FROM parsed p
        WHERE cardinality(p.parts) = 3
          AND p.parts[1] = 'code'
          AND btrim(p.parts[2]) <> ''
          AND btrim(p.parts[3]) <> ''
      ),
      distinct_values AS (
        SELECT DISTINCT
          pv.contributor_codeset_key,
          pv.contributor_codeset_code_key
        FROM parsed_valid pv
      ),
      resolved_values AS (
        SELECT
          dv.contributor_codeset_key,
          dv.contributor_codeset_code_key,
          ccc.contributor_codeset_code_id
        FROM distinct_values dv
        JOIN contributor_codeset cc
          ON cc.contributor_id = ${contributorId}
         AND cc.key = dv.contributor_codeset_key
         AND cc.record_end_date IS NULL
        JOIN contributor_codeset_code ccc
          ON ccc.contributor_codeset_id = cc.contributor_codeset_id
         AND ccc.key = dv.contributor_codeset_code_key
         AND ccc.record_end_date IS NULL
      )
      INSERT INTO submission_feature_property_code (
        submission_feature_id,
        feature_type_property_id,
        contributor_codeset_code_id
      )
      SELECT
        pv.submission_feature_id,
        pv.feature_type_property_id,
        rv.contributor_codeset_code_id
      FROM parsed_valid pv
      JOIN resolved_values rv
        ON rv.contributor_codeset_key = pv.contributor_codeset_key
       AND rv.contributor_codeset_code_key = pv.contributor_codeset_code_key;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Insert valid resolved taxon values into `submission_feature_property_taxon`.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async insertTaxonPropertiesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      WITH expanded AS (
        SELECT
          v.submission_feature_id,
          v.feature_type_property_id,
          v.logical_value AS raw_value
        FROM pg_temp.tmp_upload_property_values v
        WHERE v.property_type_name = 'taxon'
          AND jsonb_typeof(v.logical_value) = 'number'
          AND (v.logical_value #>> '{}') ~ '^-?[0-9]+$'
          AND NOT EXISTS (
            SELECT 1
            FROM pg_temp.submission_feature_ingestion_error e
            WHERE e.submission_upload_id = ${submissionUploadId}::uuid
              AND e.submission_feature_id = v.submission_feature_id
              AND e.feature_type_property_id = v.feature_type_property_id
              AND COALESCE(e.property_name, '') = COALESCE(v.property_name, '')
          )
      ),
      distinct_values AS (
        SELECT DISTINCT
          (e.raw_value #>> '{}')::integer AS tsn
        FROM expanded e
      ),
      resolved_values AS (
        SELECT
          dv.tsn,
          t.taxon_id
        FROM distinct_values dv
        JOIN taxon t
          ON t.itis_tsn = dv.tsn
         AND t.record_end_date IS NULL
      )
      INSERT INTO submission_feature_property_taxon (
        submission_feature_id,
        feature_type_property_id,
        taxon_id
      )
      SELECT
        e.submission_feature_id,
        e.feature_type_property_id,
        rv.taxon_id
      FROM expanded e
      JOIN resolved_values rv
        ON rv.tsn = (e.raw_value #>> '{}')::integer;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Insert valid artifact links into `submission_feature_artifact`.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async insertArtifactLinksBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      WITH upload_scope AS (
        SELECT su.upload_id
        FROM submission_upload su
        WHERE su.submission_upload_id = ${submissionUploadId}::uuid
        LIMIT 1
      ),
      expanded AS (
        SELECT
          v.submission_feature_id,
          v.logical_value AS raw_value
        FROM pg_temp.tmp_upload_property_values v
        WHERE v.property_type_name = 'artifact_key'
          AND jsonb_typeof(v.logical_value) = 'string'
          AND NOT EXISTS (
            SELECT 1
            FROM pg_temp.submission_feature_ingestion_error e
            WHERE e.submission_upload_id = ${submissionUploadId}::uuid
              AND e.submission_feature_id = v.submission_feature_id
              AND e.feature_type_property_id = v.feature_type_property_id
              AND COALESCE(e.property_name, '') = COALESCE(v.property_name, '')
          )
      ),
      normalized AS (
        SELECT
          e.submission_feature_id,
          regexp_replace(
            CASE
              WHEN btrim(e.raw_value #>> '{}') LIKE 'files/%' THEN substring(btrim(e.raw_value #>> '{}') FROM 7)
              ELSE btrim(e.raw_value #>> '{}')
            END,
            '^/+',
            ''
          ) AS normalized_reference
        FROM expanded e
      ),
      distinct_values AS (
        SELECT DISTINCT
          normalized_reference
        FROM normalized
        WHERE COALESCE(normalized_reference, '') <> ''
      ),
      resolved_values AS (
        SELECT
          dv.normalized_reference,
          ua.artifact_id
        FROM distinct_values dv
        CROSS JOIN upload_scope us
        JOIN upload_artifact ua
          ON ua.upload_id = us.upload_id
         AND ua.path = dv.normalized_reference
      )
      INSERT INTO submission_feature_artifact (
        submission_feature_id,
        artifact_id
      )
      SELECT DISTINCT
        n.submission_feature_id,
        rv.artifact_id
      FROM normalized n
      JOIN resolved_values rv
        ON rv.normalized_reference = n.normalized_reference
      WHERE COALESCE(n.normalized_reference, '') <> ''
      ON CONFLICT (submission_feature_id, artifact_id) WHERE record_end_date IS NULL DO NOTHING;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Insert resolved feature-to-feature relationships for one upload.
   *
   * Relationships are extracted from `submission_feature.data.content` string references, resolved
   * within the same upload by `source_id`, filtered to exclude self-links, and inserted idempotently.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async insertFeatureRelationshipsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      WITH expanded AS (
        SELECT
          sf.submission_feature_id AS source_feature_id,
          btrim(content_item.reference_source_id) AS reference_source_id
        FROM submission_feature sf
        CROSS JOIN LATERAL (
          SELECT content_value #>> '{}' AS reference_source_id
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(sf.data -> 'content') = 'array' THEN sf.data -> 'content'
              ELSE '[]'::jsonb
            END
          ) AS content_value
          WHERE jsonb_typeof(content_value) = 'string'
        ) AS content_item
        WHERE sf.submission_upload_id = ${submissionUploadId}::uuid
          AND sf.record_end_date IS NULL
          AND btrim(content_item.reference_source_id) <> ''
      ),
      resolved AS (
        SELECT
          e.source_feature_id,
          target.submission_feature_id AS target_feature_id
        FROM expanded e
        JOIN submission_feature target
          ON target.submission_upload_id = ${submissionUploadId}::uuid
         AND target.record_end_date IS NULL
         AND target.source_id = e.reference_source_id
        WHERE target.submission_feature_id <> e.source_feature_id
      )
      INSERT INTO submission_feature_feature (
        source_feature_id,
        target_feature_id
      )
      SELECT DISTINCT
        source_feature_id,
        target_feature_id
      FROM resolved
      ON CONFLICT (source_feature_id, target_feature_id) DO NOTHING;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Record unresolved or invalid feature-reference errors from `data.content`.
   *
   * This phase captures:
   * - unresolved target source-id references within the upload
   * - self-reference violations
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async recordReferenceErrorsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      WITH expanded AS (
        SELECT
          sf.submission_feature_id AS source_feature_id,
          btrim(content_item.reference_source_id) AS reference_source_id
        FROM submission_feature sf
        CROSS JOIN LATERAL (
          SELECT content_value #>> '{}' AS reference_source_id
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(sf.data -> 'content') = 'array' THEN sf.data -> 'content'
              ELSE '[]'::jsonb
            END
          ) AS content_value
          WHERE jsonb_typeof(content_value) = 'string'
        ) AS content_item
        WHERE sf.submission_upload_id = ${submissionUploadId}::uuid
          AND sf.record_end_date IS NULL
          AND btrim(content_item.reference_source_id) <> ''
      )
      INSERT INTO pg_temp.submission_feature_ingestion_error (
        submission_upload_id,
        submission_feature_id,
        error_code,
        error_message,
        raw_value,
        details
      )
      SELECT
        ${submissionUploadId}::uuid,
        e.source_feature_id,
        CASE
          WHEN target.submission_feature_id IS NULL THEN 'UNRESOLVED_REFERENCE'
          ELSE 'INVALID_SELF_REFERENCE'
        END,
        CASE
          WHEN target.submission_feature_id IS NULL THEN 'Failed to resolve feature reference source_id within upload'
          ELSE 'Feature reference cannot point to itself'
        END,
        to_jsonb(e.reference_source_id),
        jsonb_build_object('reference_source_id', e.reference_source_id)
      FROM expanded e
      LEFT JOIN submission_feature target
        ON target.submission_upload_id = ${submissionUploadId}::uuid
       AND target.record_end_date IS NULL
       AND target.source_id = e.reference_source_id
      WHERE target.submission_feature_id IS NULL
         OR target.submission_feature_id = e.source_feature_id;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Record unresolved parent source-id references for the upload.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async recordUnresolvedParentErrorsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      INSERT INTO pg_temp.submission_feature_ingestion_error (
        submission_upload_id,
        submission_feature_id,
        error_code,
        error_message,
        raw_value,
        details
      )
      SELECT
        ${submissionUploadId}::uuid,
        child.submission_feature_id,
        'UNRESOLVED_PARENT',
        'Failed to resolve parent feature source_id within upload',
        to_jsonb(NULLIF(child.data ->> 'parent', '')),
        jsonb_build_object('parent_source_id', NULLIF(child.data ->> 'parent', ''))
      FROM submission_feature child
      LEFT JOIN submission_feature parent
        ON parent.submission_upload_id = child.submission_upload_id
       AND parent.record_end_date IS NULL
       AND parent.source_id = NULLIF(child.data ->> 'parent', '')
      WHERE child.submission_upload_id = ${submissionUploadId}::uuid
        AND child.record_end_date IS NULL
        AND NULLIF(child.data ->> 'parent', '') IS NOT NULL
        AND parent.submission_feature_id IS NULL;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Get total number of ingestion error rows for one upload.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<number>}
   */
  async getIngestionErrorCountBySubmissionUploadId(submissionUploadId: string): Promise<number> {
    const sql = SQL`
      SELECT COUNT(*)::integer AS count
      FROM pg_temp.submission_feature_ingestion_error
      WHERE submission_upload_id = ${submissionUploadId}::uuid;
    `;

    const response = await this.connection.sql(sql, IngestionErrorTotalCountRow);
    return response.rows[0]?.count ?? 0;
  }

  /**
   * Get grouped ingestion error counts by `error_code` for one upload.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<IngestionErrorCount[]>}
   */
  async getIngestionErrorCountsByCode(submissionUploadId: string): Promise<IngestionErrorCount[]> {
    const sql = SQL`
      SELECT
        error_code,
        COUNT(*)::integer AS error_count
      FROM pg_temp.submission_feature_ingestion_error
      WHERE submission_upload_id = ${submissionUploadId}::uuid
      GROUP BY error_code
      ORDER BY error_count DESC, error_code ASC;
    `;

    const response = await this.connection.sql(sql, ErrorCountRow);
    return response.rows;
  }

  /**
   * Get representative sample ingestion errors for one upload.
   *
   * @param {string} submissionUploadId Upload scope.
   * @param {number} [limit=25] Max rows to return.
   * @returns {Promise<IngestionErrorSample[]>}
   */
  async getIngestionErrorSamplesBySubmissionUploadId(
    submissionUploadId: string,
    limit = 25
  ): Promise<IngestionErrorSample[]> {
    const sql = SQL`
      SELECT
        submission_feature_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        raw_value,
        details
      FROM pg_temp.submission_feature_ingestion_error
      WHERE submission_upload_id = ${submissionUploadId}::uuid
      ORDER BY submission_feature_ingestion_error_id ASC
      LIMIT ${limit};
    `;

    const response = await this.connection.sql(sql, IngestionErrorSampleRow);
    return response.rows;
  }
}
