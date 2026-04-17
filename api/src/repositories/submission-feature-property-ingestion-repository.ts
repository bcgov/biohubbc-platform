import SQL from 'sql-template-strings';
import z from 'zod';
import {
  IngestionErrorCount,
  IngestionErrorCountRow,
  IngestionErrorSummary,
  IngestionErrorSummaryRow
} from '../models/submission-feature-property-ingestion';
import { getLogger } from '../utils/logger';
import { BaseRepository } from './base-repository';

const defaultLog = getLogger('repositories/submission-feature-property-ingestion-repository');

/**
 * Upload-scoped repository for set-based submission feature property ingestion.
 *
 * Working tables in this repository are durable upload-scoped tables.
 * Callers must clean and repopulate rows by `submission_upload_id` per job run.
 */
export class SubmissionFeaturePropertyIngestionRepository extends BaseRepository {
  /**
   * Execute one upload-scoped SQL phase and emit timing/row-count diagnostics.
   *
   * @param {string} phaseName Human-readable phase identifier.
   * @param {string} submissionUploadId Upload scope.
   * @param {SQLStatement} sqlStatement SQL statement to execute.
   * @returns {Promise<void>}
   */
  private async executeUploadScopedPhase(
    phaseName: string,
    submissionUploadId: string,
    sqlStatement: any
  ): Promise<void> {
    const startedAt = Date.now();
    const response = await this.connection.sql(sqlStatement);

    defaultLog.debug({
      label: 'executeUploadScopedPhase',
      message: 'phase complete',
      phase_name: phaseName,
      submission_upload_id: submissionUploadId,
      elapsed_ms: Date.now() - startedAt,
      rows_written: response?.rowCount ?? 0
    });
  }

  /**
   * Clear staging rows for one upload.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async clearRawPropertyStagingBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      DELETE FROM submission_upload_staging_raw_property
      WHERE submission_upload_id = ${submissionUploadId}::uuid;
    `;
    await this.executeUploadScopedPhase('clear raw property staging', submissionUploadId, sql);
  }

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
   * Delete all temp ingestion error rows for one upload.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async deleteIngestionErrorsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      DELETE FROM submission_feature_error
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
      INSERT INTO submission_upload_staging_raw_property (
        submission_feature_id,
        submission_upload_id,
        feature_type_id,
        property_name,
        value
      )
      SELECT
        sf.submission_feature_id,
        sf.submission_upload_id,
        sf.feature_type_id,
        props.key,
        props.value
      FROM submission_feature sf
      CROSS JOIN LATERAL jsonb_each(sf.data -> 'properties') AS props
      WHERE sf.submission_upload_id = ${submissionUploadId}::uuid
        AND sf.record_end_date IS NULL
        AND jsonb_typeof(sf.data -> 'properties') = 'object';
    `;

    await this.executeUploadScopedPhase('stage expanded properties', submissionUploadId, sql);
  }

  /**
   * Drop `submission_upload_staging_typed_property_value` if it exists.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async clearTypedPropertyValueStagingBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      DELETE FROM submission_upload_staging_typed_property_value
      WHERE submission_upload_id = ${submissionUploadId}::uuid;
    `;
    await this.executeUploadScopedPhase('clear typed property value staging', submissionUploadId, sql);
  }

  /**
   * Drop `submission_upload_staging_resolved_property` if it exists.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async clearResolvedPropertyStagingBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      DELETE FROM submission_upload_staging_resolved_property
      WHERE submission_upload_id = ${submissionUploadId}::uuid;
    `;
    await this.executeUploadScopedPhase('clear resolved property staging', submissionUploadId, sql);
  }

  /**
   * Create `submission_upload_staging_resolved_property` for an upload.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async populateResolvedPropertyStagingBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      INSERT INTO submission_upload_staging_resolved_property (
        submission_feature_property_staging_id,
        submission_feature_id,
        submission_upload_id,
        feature_type_id,
        property_name,
        value,
        feature_type_property_id,
        allow_multiple,
        required_value,
        property_type_name
      )
      SELECT
        s.submission_feature_property_staging_id,
        s.submission_feature_id,
        s.submission_upload_id,
        s.feature_type_id,
        s.property_name,
        s.value,
        ftp.feature_type_property_id,
        COALESCE(ftp.allow_multiple, false) AS allow_multiple,
        COALESCE(ftp.required_value, false) AS required_value,
        fpt.name AS property_type_name
      FROM submission_upload_staging_raw_property s
      LEFT JOIN feature_property fp
        ON fp.name = s.property_name
       AND fp.record_end_date IS NULL
      LEFT JOIN feature_property_type fpt
        ON fpt.feature_property_type_id = fp.feature_property_type_id
       AND fpt.record_end_date IS NULL
      LEFT JOIN feature_type_property ftp
        ON ftp.feature_type_id = s.feature_type_id
       AND ftp.feature_property_id = fp.feature_property_id
       AND ftp.record_end_date IS NULL
      WHERE s.submission_upload_id = ${submissionUploadId}::uuid;
    `;
    await this.executeUploadScopedPhase('populate resolved property staging', submissionUploadId, sql);
  }

  /**
   * Create `submission_upload_staging_typed_property_value` with one logical value per row.
   *
   * Note: `jsonb_typeof(...)= 'array'` here is checking JSON transport shape only.
   * It is not a logical `feature_property_type` of `array`. Logical multiplicity is
   * controlled by `allow_multiple` on `feature_type_property`.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async populateTypedPropertyValueStagingBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      INSERT INTO submission_upload_staging_typed_property_value (
        submission_feature_id,
        submission_upload_id,
        feature_type_id,
        feature_type_property_id,
        property_name,
        property_type_name,
        allow_multiple,
        logical_value
      )
      SELECT
        rsp.submission_feature_id,
        rsp.submission_upload_id,
        rsp.feature_type_id,
        rsp.feature_type_property_id,
        rsp.property_name,
        rsp.property_type_name,
        rsp.allow_multiple,
        rsp.value AS logical_value
      FROM submission_upload_staging_resolved_property rsp
      WHERE rsp.feature_type_property_id IS NOT NULL
        AND rsp.submission_upload_id = ${submissionUploadId}::uuid
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
      FROM submission_upload_staging_resolved_property rsp
      CROSS JOIN LATERAL jsonb_array_elements(rsp.value) AS arr(value)
      WHERE rsp.feature_type_property_id IS NOT NULL
        AND rsp.submission_upload_id = ${submissionUploadId}::uuid
        AND jsonb_typeof(rsp.value) = 'array'
        AND rsp.allow_multiple = TRUE
        AND arr.value <> 'null'::jsonb;
    `;
    await this.executeUploadScopedPhase('populate typed property value staging', submissionUploadId, sql);
  }

  /**
   * Drop `submission_upload_staging_datetime_candidate` if it exists.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async clearDatetimeCandidateStagingBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      DELETE FROM submission_upload_staging_datetime_candidate
      WHERE submission_upload_id = ${submissionUploadId}::uuid;
    `;
    await this.executeUploadScopedPhase('clear datetime candidate staging', submissionUploadId, sql);
  }

  /**
   * Drop `submission_upload_staging_spatial_candidate` if it exists.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async clearSpatialCandidateStagingBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      DELETE FROM submission_upload_staging_spatial_candidate
      WHERE submission_upload_id = ${submissionUploadId}::uuid;
    `;
    await this.executeUploadScopedPhase('clear spatial candidate staging', submissionUploadId, sql);
  }

  /**
   * Drop `submission_upload_staging_code_candidate` if it exists.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async clearCodeCandidateStagingBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      DELETE FROM submission_upload_staging_code_candidate
      WHERE submission_upload_id = ${submissionUploadId}::uuid;
    `;
    await this.executeUploadScopedPhase('clear code candidate staging', submissionUploadId, sql);
  }

  /**
   * Drop `submission_upload_staging_taxon_candidate` if it exists.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async clearTaxonCandidateStagingBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      DELETE FROM submission_upload_staging_taxon_candidate
      WHERE submission_upload_id = ${submissionUploadId}::uuid;
    `;
    await this.executeUploadScopedPhase('clear taxon candidate staging', submissionUploadId, sql);
  }

  /**
   * Drop `submission_upload_staging_artifact_candidate` if it exists.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async clearArtifactCandidateStagingBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      DELETE FROM submission_upload_staging_artifact_candidate
      WHERE submission_upload_id = ${submissionUploadId}::uuid;
    `;
    await this.executeUploadScopedPhase('clear artifact candidate staging', submissionUploadId, sql);
  }

  /**
   * Clear upload property working-set staging rows in one round trip.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async clearUploadPropertyWorkingSetStagingBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      WITH clear_typed AS (
        DELETE FROM submission_upload_staging_typed_property_value
        WHERE submission_upload_id = ${submissionUploadId}::uuid
        RETURNING 1
      ),
      clear_resolved AS (
        DELETE FROM submission_upload_staging_resolved_property
        WHERE submission_upload_id = ${submissionUploadId}::uuid
        RETURNING 1
      )
      SELECT 1;
    `;
    await this.executeUploadScopedPhase('clear upload property working-set staging', submissionUploadId, sql);
  }

  /**
   * Clear complex candidate staging rows in one round trip.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async clearComplexPropertyCandidateStagingBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      WITH clear_datetime AS (
        DELETE FROM submission_upload_staging_datetime_candidate
        WHERE submission_upload_id = ${submissionUploadId}::uuid
        RETURNING 1
      ),
      clear_spatial AS (
        DELETE FROM submission_upload_staging_spatial_candidate
        WHERE submission_upload_id = ${submissionUploadId}::uuid
        RETURNING 1
      ),
      clear_code AS (
        DELETE FROM submission_upload_staging_code_candidate
        WHERE submission_upload_id = ${submissionUploadId}::uuid
        RETURNING 1
      ),
      clear_taxon AS (
        DELETE FROM submission_upload_staging_taxon_candidate
        WHERE submission_upload_id = ${submissionUploadId}::uuid
        RETURNING 1
      ),
      clear_artifact AS (
        DELETE FROM submission_upload_staging_artifact_candidate
        WHERE submission_upload_id = ${submissionUploadId}::uuid
        RETURNING 1
      )
      SELECT 1;
    `;
    await this.executeUploadScopedPhase('clear complex candidate staging', submissionUploadId, sql);
  }

  /**
   * Create `submission_upload_staging_datetime_candidate` with parsed date/time values.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async populateDatetimeCandidateStagingBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      INSERT INTO submission_upload_staging_datetime_candidate (
        submission_upload_id,
        submission_feature_id,
        property_name,
        feature_type_property_id,
        value_text,
        raw_value,
        date_value,
        time_value
      )
      WITH valid_property_values AS (
        SELECT
          v.submission_upload_id,
          v.submission_feature_id,
          v.property_name,
          v.feature_type_property_id,
          v.property_type_name,
          v.logical_value
        FROM submission_upload_staging_typed_property_value v
        WHERE v.submission_upload_id = ${submissionUploadId}::uuid
      ),
      candidates AS (
        SELECT
          v.submission_upload_id,
          v.submission_feature_id,
          v.property_name,
          v.feature_type_property_id,
          btrim(v.logical_value #>> '{}') AS value_text,
          v.logical_value AS raw_value
        FROM valid_property_values v
        WHERE v.property_type_name = 'datetime'
          AND jsonb_typeof(v.logical_value) = 'string'
      )
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
      FROM candidates c;
    `;
    await this.executeUploadScopedPhase('populate datetime candidate staging', submissionUploadId, sql);
  }

  /**
   * Create `submission_upload_staging_spatial_candidate` with normalized geometry and validity metadata.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async populateSpatialCandidateStagingBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      INSERT INTO submission_upload_staging_spatial_candidate (
        submission_upload_id,
        submission_feature_id,
        property_name,
        feature_type_property_id,
        logical_value,
        geometry_json,
        parsed_geom,
        validity_reason,
        is_valid
      )
      WITH valid_property_values AS (
        SELECT
          v.submission_upload_id,
          v.submission_feature_id,
          v.property_name,
          v.feature_type_property_id,
          v.property_type_name,
          v.logical_value
        FROM submission_upload_staging_typed_property_value v
        WHERE v.submission_upload_id = ${submissionUploadId}::uuid
      ),
      candidates AS (
        SELECT
          v.submission_upload_id,
          v.submission_feature_id,
          v.property_name,
          v.feature_type_property_id,
          v.logical_value
        FROM valid_property_values v
        WHERE v.property_type_name = 'spatial'
          AND jsonb_typeof(v.logical_value) = 'object'
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
      SELECT
        p.submission_upload_id,
        p.submission_feature_id,
        p.property_name,
        p.feature_type_property_id,
        p.logical_value,
        p.geometry_json,
        p.parsed_geom,
        CASE
          WHEN p.geometry_json IS NULL THEN 'Geometry payload is missing after normalization'
          WHEN p.parsed_geom IS NULL THEN 'Unable to parse geometry'
          ELSE public.ST_IsValidReason(p.parsed_geom)
        END AS validity_reason,
        (p.parsed_geom IS NOT NULL AND public.ST_IsValid(p.parsed_geom)) AS is_valid
      FROM parsed p;
    `;
    await this.executeUploadScopedPhase('populate spatial candidate staging', submissionUploadId, sql);
  }

  /**
   * Create `submission_upload_staging_code_candidate` with parsed code key parts and resolved IDs.
   *
   * @param {number} contributorId Contributor scope for code resolution.
   * @returns {Promise<void>}
   */
  async populateCodeCandidateStagingBySubmissionUploadId(
    submissionUploadId: string,
    contributorId: number
  ): Promise<void> {
    const sql = SQL`
      INSERT INTO submission_upload_staging_code_candidate (
        submission_upload_id,
        submission_feature_id,
        property_name,
        feature_type_property_id,
        raw_value,
        is_format_valid,
        normalized_slug,
        contributor_codeset_code_id
      )
      WITH valid_property_values AS (
        SELECT
          v.submission_upload_id,
          v.submission_feature_id,
          v.property_name,
          v.feature_type_property_id,
          v.property_type_name,
          v.logical_value
        FROM submission_upload_staging_typed_property_value v
        WHERE v.submission_upload_id = ${submissionUploadId}::uuid
      ),
      candidates AS (
        SELECT
          v.submission_upload_id,
          v.submission_feature_id,
          v.property_name,
          v.feature_type_property_id,
          v.logical_value AS raw_value,
          regexp_split_to_array(btrim(v.logical_value #>> '{}'), '::') AS parts
        FROM valid_property_values v
        WHERE v.property_type_name = 'code'
          AND jsonb_typeof(v.logical_value) = 'string'
      ),
      normalized AS (
        SELECT
          c.*,
          (cardinality(c.parts) = 3
            AND c.parts[1] = 'code'
            AND btrim(c.parts[2]) <> ''
            AND btrim(c.parts[3]) <> '') AS is_format_valid,
          btrim(c.parts[2]) AS contributor_codeset_key,
          btrim(c.parts[3]) AS contributor_codeset_code_key,
          ('code::' || btrim(c.parts[2]) || '::' || btrim(c.parts[3])) AS normalized_slug
        FROM candidates c
      )
      SELECT
        n.submission_upload_id,
        n.submission_feature_id,
        n.property_name,
        n.feature_type_property_id,
        n.raw_value,
        n.is_format_valid,
        n.normalized_slug,
        ccc.contributor_codeset_code_id
      FROM normalized n
      LEFT JOIN contributor_codeset cc
        ON n.is_format_valid
       AND cc.contributor_id = ${contributorId}
       AND cc.key = n.contributor_codeset_key
       AND cc.record_end_date IS NULL
      LEFT JOIN contributor_codeset_code ccc
        ON ccc.contributor_codeset_id = cc.contributor_codeset_id
       AND ccc.key = n.contributor_codeset_code_key
       AND ccc.record_end_date IS NULL;
    `;
    await this.executeUploadScopedPhase('populate code candidate staging', submissionUploadId, sql);
  }

  /**
   * Create `submission_upload_staging_taxon_candidate` with parsed TSNs and resolved taxon IDs.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async populateTaxonCandidateStagingBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      INSERT INTO submission_upload_staging_taxon_candidate (
        submission_upload_id,
        submission_feature_id,
        property_name,
        feature_type_property_id,
        raw_value,
        tsn,
        taxon_id
      )
      WITH valid_property_values AS (
        SELECT
          v.submission_upload_id,
          v.submission_feature_id,
          v.property_name,
          v.feature_type_property_id,
          v.property_type_name,
          v.logical_value
        FROM submission_upload_staging_typed_property_value v
        WHERE v.submission_upload_id = ${submissionUploadId}::uuid
      )
      SELECT
        v.submission_upload_id,
        v.submission_feature_id,
        v.property_name,
        v.feature_type_property_id,
        v.logical_value AS raw_value,
        (v.logical_value #>> '{}')::integer AS tsn,
        t.taxon_id
      FROM valid_property_values v
      LEFT JOIN taxon t
        ON t.itis_tsn = (v.logical_value #>> '{}')::integer
       AND t.record_end_date IS NULL
      WHERE v.property_type_name = 'taxon'
        AND jsonb_typeof(v.logical_value) = 'number'
        AND (v.logical_value #>> '{}') ~ '^-?[0-9]+$';
    `;
    await this.executeUploadScopedPhase('populate taxon candidate staging', submissionUploadId, sql);
  }

  /**
   * Create `submission_upload_staging_artifact_candidate` with normalized references and resolved artifact IDs.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  async populateArtifactCandidateStagingBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      INSERT INTO submission_upload_staging_artifact_candidate (
        submission_upload_id,
        submission_feature_id,
        property_name,
        feature_type_property_id,
        raw_value,
        normalized_reference,
        artifact_id
      )
      WITH upload_scope AS (
        SELECT su.upload_id
        FROM submission_upload su
        WHERE su.submission_upload_id = ${submissionUploadId}::uuid
        LIMIT 1
      ),
      valid_property_values AS (
        SELECT
          v.submission_upload_id,
          v.submission_feature_id,
          v.property_name,
          v.feature_type_property_id,
          v.property_type_name,
          v.logical_value
        FROM submission_upload_staging_typed_property_value v
        WHERE v.submission_upload_id = ${submissionUploadId}::uuid
      ),
      candidates AS (
        SELECT
          v.submission_upload_id,
          v.submission_feature_id,
          v.property_name,
          v.feature_type_property_id,
          v.logical_value AS raw_value
        FROM valid_property_values v
        WHERE v.property_type_name = 'artifact_key'
          AND jsonb_typeof(v.logical_value) = 'string'
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
      )
      SELECT
        n.submission_upload_id,
        n.submission_feature_id,
        n.property_name,
        n.feature_type_property_id,
        n.raw_value,
        n.normalized_reference,
        ua.artifact_id
      FROM normalized n
      CROSS JOIN upload_scope us
      LEFT JOIN upload_artifact ua
        ON ua.upload_id = us.upload_id
       AND ua.path = n.normalized_reference;
    `;
    await this.executeUploadScopedPhase('populate artifact candidate staging', submissionUploadId, sql);
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
      WITH upload_feature_types AS (
        SELECT DISTINCT feature_type_id
        FROM submission_upload_staging_raw_property
        WHERE submission_upload_id = ${submissionUploadId}::uuid
      ),
      required_properties AS (
        SELECT
          ftp.feature_type_id,
          ftp.feature_type_property_id,
          fp.name AS property_name
        FROM feature_type_property ftp
        JOIN feature_property fp
          ON fp.feature_property_id = ftp.feature_property_id
         AND fp.record_end_date IS NULL
        JOIN upload_feature_types uft
          ON uft.feature_type_id = ftp.feature_type_id
        WHERE ftp.record_end_date IS NULL
          AND COALESCE(ftp.required_value, false) = TRUE
      ),
      present_properties AS (
        SELECT DISTINCT
          rsp.submission_feature_id,
          rsp.feature_type_property_id
        FROM submission_upload_staging_resolved_property rsp
        WHERE rsp.submission_upload_id = ${submissionUploadId}::uuid
          AND rsp.feature_type_property_id IS NOT NULL
          AND rsp.value IS NOT NULL
          AND rsp.value <> 'null'::jsonb
          AND NOT (jsonb_typeof(rsp.value) = 'array' AND jsonb_array_length(rsp.value) = 0)
      ),
      grouped_errors AS (
        SELECT
          sf.submission_upload_id,
          rp.property_name,
          rp.feature_type_property_id,
          'MISSING_REQUIRED_PROPERTY'::text AS error_code,
          'Missing required property value'::text AS error_message,
          COUNT(*)::integer AS count
        FROM submission_feature sf
        JOIN required_properties rp
          ON rp.feature_type_id = sf.feature_type_id
        LEFT JOIN present_properties pp
          ON pp.submission_feature_id = sf.submission_feature_id
         AND pp.feature_type_property_id = rp.feature_type_property_id
        WHERE sf.submission_upload_id = ${submissionUploadId}::uuid
          AND sf.record_end_date IS NULL
          AND pp.submission_feature_id IS NULL
        GROUP BY sf.submission_upload_id, rp.feature_type_property_id, rp.property_name
      )
      INSERT INTO submission_feature_error (
        submission_upload_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        count,
        details
      )
      SELECT
        submission_upload_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        count,
        NULL::jsonb
      FROM grouped_errors
      ON CONFLICT (
        submission_upload_id,
        error_code,
        feature_type_property_id,
        property_name
      )
      DO UPDATE SET
        count = submission_feature_error.count + EXCLUDED.count,
        error_message = EXCLUDED.error_message,
        details = COALESCE(EXCLUDED.details, submission_feature_error.details);
    `;

    await this.executeUploadScopedPhase('record required property validation errors', submissionUploadId, sql);
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
          m.property_name,
          m.feature_type_property_id,
          'MULTIPLE_VALUES_NOT_ALLOWED'::text AS error_code,
          'Property does not allow multiple values'::text AS error_message
        FROM submission_upload_staging_resolved_property m
        WHERE m.feature_type_property_id IS NOT NULL
          AND m.submission_upload_id = ${submissionUploadId}::uuid
          AND jsonb_typeof(m.value) = 'array'
          AND m.allow_multiple = FALSE
      ),
      type_errors AS (
        SELECT
          v.submission_upload_id,
          v.property_name,
          v.feature_type_property_id,
          CASE
            WHEN v.property_type_name = 'taxon' THEN 'INVALID_TAXON_VALUE'
            WHEN v.property_type_name = 'spatial' THEN 'INVALID_SPATIAL_VALUE'
            ELSE 'TYPE_MISMATCH'
          END AS error_code,
          CASE
            WHEN v.property_type_name = 'taxon' THEN 'Invalid taxon value'
            WHEN v.property_type_name = 'spatial' THEN 'Invalid spatial value'
            ELSE 'Property value type mismatch'
          END AS error_message
        FROM submission_upload_staging_typed_property_value v
        WHERE
          v.submission_upload_id = ${submissionUploadId}::uuid
          AND (
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
          )
      ),
      unsupported_type_errors AS (
        SELECT
          m.submission_upload_id,
          m.property_name,
          m.feature_type_property_id,
          'UNSUPPORTED_PROPERTY_TYPE'::text AS error_code,
          'Unsupported property type'::text AS error_message
        FROM submission_upload_staging_resolved_property m
        WHERE m.feature_type_property_id IS NOT NULL
          AND m.submission_upload_id = ${submissionUploadId}::uuid
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
      ),
      grouped_errors AS (
        SELECT
          aggregated.submission_upload_id,
          aggregated.property_name,
          aggregated.feature_type_property_id,
          aggregated.error_code,
          aggregated.error_message,
          COUNT(*)::integer AS count
        FROM (
          SELECT * FROM cardinality_errors
          UNION ALL
          SELECT * FROM type_errors
          UNION ALL
          SELECT * FROM unsupported_type_errors
        ) AS aggregated
        GROUP BY
          aggregated.submission_upload_id,
          aggregated.property_name,
          aggregated.feature_type_property_id,
          aggregated.error_code,
          aggregated.error_message
      )
      INSERT INTO submission_feature_error (
        submission_upload_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        count,
        details
      )
      SELECT
        submission_upload_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        count,
        NULL::jsonb
      FROM grouped_errors
      ON CONFLICT (
        submission_upload_id,
        error_code,
        feature_type_property_id,
        property_name
      )
      DO UPDATE SET
        count = submission_feature_error.count + EXCLUDED.count,
        error_message = EXCLUDED.error_message,
        details = COALESCE(EXCLUDED.details, submission_feature_error.details);
    `;

    await this.connection.sql(sql);
  }

  /**
   * Record malformed or unresolved code property references.
   *
   * @param {string} submissionUploadId Upload scope.
   * @param {number} _contributorId Unused at this stage; kept for interface compatibility.
   * @returns {Promise<void>}
   */
  async recordCodePropertyResolutionErrorsBySubmissionUploadId(
    submissionUploadId: string,
    _contributorId: number
  ): Promise<void> {
    const sql = SQL`
      WITH format_errors AS (
        SELECT
          c.submission_upload_id,
          c.property_name,
          c.feature_type_property_id,
          'INVALID_CODE_REFERENCE_FORMAT'::text AS error_code,
          'Code property value must match code::<contributor-codeset-key>::<contributor-codeset-code-key>'::text AS error_message
        FROM submission_upload_staging_code_candidate c
        WHERE c.submission_upload_id = ${submissionUploadId}::uuid
          AND NOT c.is_format_valid
      ),
      unresolved AS (
        SELECT
          c.submission_upload_id,
          c.property_name,
          c.feature_type_property_id,
          'UNRESOLVED_CODE_REFERENCE'::text AS error_code,
          'Failed to resolve code slug to contributor_codeset_code_id'::text AS error_message
        FROM submission_upload_staging_code_candidate c
        WHERE c.submission_upload_id = ${submissionUploadId}::uuid
          AND c.is_format_valid
          AND c.contributor_codeset_code_id IS NULL
      ),
      grouped_errors AS (
        SELECT
          aggregated.submission_upload_id,
          aggregated.property_name,
          aggregated.feature_type_property_id,
          aggregated.error_code,
          aggregated.error_message,
          COUNT(*)::integer AS count
        FROM (
          SELECT * FROM format_errors
          UNION ALL
          SELECT * FROM unresolved
        ) AS aggregated
        GROUP BY
          aggregated.submission_upload_id,
          aggregated.property_name,
          aggregated.feature_type_property_id,
          aggregated.error_code,
          aggregated.error_message
      )
      INSERT INTO submission_feature_error (
        submission_upload_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        count,
        details
      )
      SELECT
        submission_upload_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        count,
        NULL::jsonb
      FROM grouped_errors
      ON CONFLICT (
        submission_upload_id,
        error_code,
        feature_type_property_id,
        property_name
      )
      DO UPDATE SET
        count = submission_feature_error.count + EXCLUDED.count,
        error_message = EXCLUDED.error_message,
        details = COALESCE(EXCLUDED.details, submission_feature_error.details);
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
      WITH grouped_errors AS (
        SELECT
          c.submission_upload_id,
          c.property_name,
          c.feature_type_property_id,
          'UNRESOLVED_TAXON'::text AS error_code,
          'Failed to resolve taxon TSN to taxon_id'::text AS error_message,
          COUNT(*)::integer AS count
        FROM submission_upload_staging_taxon_candidate c
        WHERE c.submission_upload_id = ${submissionUploadId}::uuid
          AND c.taxon_id IS NULL
        GROUP BY c.submission_upload_id, c.property_name, c.feature_type_property_id
      )
      INSERT INTO submission_feature_error (
        submission_upload_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        count,
        details
      )
      SELECT
        submission_upload_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        count,
        NULL::jsonb
      FROM grouped_errors
      ON CONFLICT (
        submission_upload_id,
        error_code,
        feature_type_property_id,
        property_name
      )
      DO UPDATE SET
        count = submission_feature_error.count + EXCLUDED.count,
        error_message = EXCLUDED.error_message,
        details = COALESCE(EXCLUDED.details, submission_feature_error.details);
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
      WITH normalized_empty AS (
        SELECT
          n.submission_upload_id,
          n.property_name,
          n.feature_type_property_id,
          'INVALID_ARTIFACT_REFERENCE'::text AS error_code,
          'Artifact key resolved to an empty normalized reference'::text AS error_message
        FROM submission_upload_staging_artifact_candidate n
        WHERE n.submission_upload_id = ${submissionUploadId}::uuid
          AND COALESCE(n.normalized_reference, '') = ''
      ),
      unresolved AS (
        SELECT
          n.submission_upload_id,
          n.property_name,
          n.feature_type_property_id,
          'UNRESOLVED_ARTIFACT_REFERENCE'::text AS error_code,
          'Failed to resolve artifact reference to artifact_id'::text AS error_message
        FROM submission_upload_staging_artifact_candidate n
        WHERE n.submission_upload_id = ${submissionUploadId}::uuid
          AND COALESCE(n.normalized_reference, '') <> ''
          AND n.artifact_id IS NULL
      ),
      grouped_errors AS (
        SELECT
          aggregated.submission_upload_id,
          aggregated.property_name,
          aggregated.feature_type_property_id,
          aggregated.error_code,
          aggregated.error_message,
          COUNT(*)::integer AS count
        FROM (
          SELECT * FROM normalized_empty
          UNION ALL
          SELECT * FROM unresolved
        ) AS aggregated
        GROUP BY
          aggregated.submission_upload_id,
          aggregated.property_name,
          aggregated.feature_type_property_id,
          aggregated.error_code,
          aggregated.error_message
      )
      INSERT INTO submission_feature_error (
        submission_upload_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        count,
        details
      )
      SELECT
        submission_upload_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        count,
        NULL::jsonb
      FROM grouped_errors
      ON CONFLICT (
        submission_upload_id,
        error_code,
        feature_type_property_id,
        property_name
      )
      DO UPDATE SET
        count = submission_feature_error.count + EXCLUDED.count,
        error_message = EXCLUDED.error_message,
        details = COALESCE(EXCLUDED.details, submission_feature_error.details);
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
      WITH grouped_errors AS (
        SELECT
          p.submission_upload_id,
          p.property_name,
          p.feature_type_property_id,
          'INVALID_TIMESTAMP_VALUE'::text AS error_code,
          'Invalid timestamp property value'::text AS error_message,
          COUNT(*)::integer AS count
        FROM submission_upload_staging_datetime_candidate p
        WHERE p.submission_upload_id = ${submissionUploadId}::uuid
          AND p.date_value IS NULL
          AND p.time_value IS NULL
        GROUP BY p.submission_upload_id, p.property_name, p.feature_type_property_id
      )
      INSERT INTO submission_feature_error (
        submission_upload_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        count,
        details
      )
      SELECT
        submission_upload_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        count,
        NULL::jsonb
      FROM grouped_errors
      ON CONFLICT (
        submission_upload_id,
        error_code,
        feature_type_property_id,
        property_name
      )
      DO UPDATE SET
        count = submission_feature_error.count + EXCLUDED.count,
        error_message = EXCLUDED.error_message,
        details = COALESCE(EXCLUDED.details, submission_feature_error.details);
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
      FROM submission_upload_staging_datetime_candidate p
      WHERE p.submission_upload_id = ${submissionUploadId}::uuid
        AND (
          p.date_value IS NOT NULL
         OR p.time_value IS NOT NULL
        );
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
      WITH grouped_errors AS (
        SELECT
          p.submission_upload_id,
          p.property_name,
          p.feature_type_property_id,
          'INVALID_SPATIAL_VALUE'::text AS error_code,
          'Invalid spatial value'::text AS error_message,
          COUNT(*)::integer AS count
        FROM submission_upload_staging_spatial_candidate p
        WHERE p.submission_upload_id = ${submissionUploadId}::uuid
          AND (
            p.geometry_json IS NULL
            OR p.parsed_geom IS NULL
            OR NOT public.ST_IsValid(p.parsed_geom)
          )
        GROUP BY p.submission_upload_id, p.property_name, p.feature_type_property_id
      )
      INSERT INTO submission_feature_error (
        submission_upload_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        count,
        details
      )
      SELECT
        submission_upload_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        count,
        NULL::jsonb
      FROM grouped_errors
      ON CONFLICT (
        submission_upload_id,
        error_code,
        feature_type_property_id,
        property_name
      )
      DO UPDATE SET
        count = submission_feature_error.count + EXCLUDED.count,
        error_message = EXCLUDED.error_message,
        details = COALESCE(EXCLUDED.details, submission_feature_error.details);
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
      INSERT INTO submission_feature_property_geometry (
        submission_feature_id,
        feature_type_property_id,
        value
      )
      SELECT
        p.submission_feature_id,
        p.feature_type_property_id,
        public.ST_Force2D(p.parsed_geom)
      FROM submission_upload_staging_spatial_candidate p
      WHERE p.submission_upload_id = ${submissionUploadId}::uuid
        AND p.parsed_geom IS NOT NULL
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
      FROM submission_upload_staging_typed_property_value v
      WHERE v.submission_upload_id = ${submissionUploadId}::uuid
        AND v.property_type_name = 'string'
        AND jsonb_typeof(v.logical_value) = 'string';
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
      FROM submission_upload_staging_typed_property_value v
      WHERE v.submission_upload_id = ${submissionUploadId}::uuid
        AND v.property_type_name = 'number'
        AND jsonb_typeof(v.logical_value) = 'number';
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
      FROM submission_upload_staging_typed_property_value v
      WHERE v.submission_upload_id = ${submissionUploadId}::uuid
        AND v.property_type_name = 'boolean'
        AND jsonb_typeof(v.logical_value) = 'boolean';
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
  async insertCodePropertiesBySubmissionUploadId(submissionUploadId: string, _contributorId: number): Promise<void> {
    const sql = SQL`
      INSERT INTO submission_feature_property_code (
        submission_feature_id,
        feature_type_property_id,
        contributor_codeset_code_id
      )
      SELECT
        c.submission_feature_id,
        c.feature_type_property_id,
        c.contributor_codeset_code_id
      FROM submission_upload_staging_code_candidate c
      WHERE c.submission_upload_id = ${submissionUploadId}::uuid
        AND c.is_format_valid
        AND c.contributor_codeset_code_id IS NOT NULL;
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
      INSERT INTO submission_feature_property_taxon (
        submission_feature_id,
        feature_type_property_id,
        taxon_id
      )
      SELECT
        c.submission_feature_id,
        c.feature_type_property_id,
        c.taxon_id
      FROM submission_upload_staging_taxon_candidate c
      WHERE c.submission_upload_id = ${submissionUploadId}::uuid
        AND c.taxon_id IS NOT NULL;
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
      INSERT INTO submission_feature_artifact (
        submission_feature_id,
        artifact_id
      )
      SELECT DISTINCT
        n.submission_feature_id,
        n.artifact_id
      FROM submission_upload_staging_artifact_candidate n
      WHERE n.submission_upload_id = ${submissionUploadId}::uuid
        AND COALESCE(n.normalized_reference, '') <> ''
        AND n.artifact_id IS NOT NULL
      ON CONFLICT (submission_feature_id, artifact_id) DO NOTHING;
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
      ),
      error_rows AS (
        SELECT
          CASE
            WHEN target.submission_feature_id IS NULL THEN 'UNRESOLVED_REFERENCE'
            ELSE 'INVALID_SELF_REFERENCE'
          END AS error_code,
          CASE
            WHEN target.submission_feature_id IS NULL THEN 'Failed to resolve feature reference source_id within upload'
            ELSE 'Feature reference cannot point to itself'
          END AS error_message,
          COUNT(*)::integer AS count
        FROM expanded e
        LEFT JOIN submission_feature target
          ON target.submission_upload_id = ${submissionUploadId}::uuid
         AND target.record_end_date IS NULL
         AND target.source_id = e.reference_source_id
        WHERE target.submission_feature_id IS NULL
           OR target.submission_feature_id = e.source_feature_id
      ),
      grouped_errors AS (
        SELECT
          ${submissionUploadId}::uuid AS submission_upload_id,
          error_rows.error_code,
          error_rows.error_message,
          COUNT(*)::integer AS count
        FROM error_rows
        GROUP BY error_rows.error_code, error_rows.error_message
      )
      INSERT INTO submission_feature_error (
        submission_upload_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        count,
        details
      )
      SELECT
        submission_upload_id,
        NULL::text,
        NULL::integer,
        error_code,
        error_message,
        count,
        NULL::jsonb
      FROM grouped_errors
      ON CONFLICT (
        submission_upload_id,
        error_code,
        feature_type_property_id,
        property_name
      )
      DO UPDATE SET
        count = submission_feature_error.count + EXCLUDED.count,
        error_message = EXCLUDED.error_message,
        details = COALESCE(EXCLUDED.details, submission_feature_error.details);
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
      WITH grouped_errors AS (
        SELECT
          ${submissionUploadId}::uuid AS submission_upload_id,
          'UNRESOLVED_PARENT'::text AS error_code,
          'Failed to resolve parent feature source_id within upload'::text AS error_message,
          COUNT(*)::integer AS count
        FROM submission_feature child
        LEFT JOIN submission_feature parent
          ON parent.submission_upload_id = child.submission_upload_id
         AND parent.record_end_date IS NULL
         AND parent.source_id = NULLIF(child.data ->> 'parent', '')
        WHERE child.submission_upload_id = ${submissionUploadId}::uuid
          AND child.record_end_date IS NULL
          AND NULLIF(child.data ->> 'parent', '') IS NOT NULL
          AND parent.submission_feature_id IS NULL
      )
      INSERT INTO submission_feature_error (
        submission_upload_id,
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        count,
        details
      )
      SELECT
        submission_upload_id,
        NULL::text,
        NULL::integer,
        error_code,
        error_message,
        count,
        NULL::jsonb
      FROM grouped_errors
      ON CONFLICT (
        submission_upload_id,
        error_code,
        feature_type_property_id,
        property_name
      )
      DO UPDATE SET
        count = submission_feature_error.count + EXCLUDED.count,
        error_message = EXCLUDED.error_message,
        details = COALESCE(EXCLUDED.details, submission_feature_error.details);
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
      SELECT COALESCE(SUM(count), 0)::integer AS count
      FROM submission_feature_error
      WHERE submission_upload_id = ${submissionUploadId}::uuid;
    `;

    const response = await this.connection.sql(
      sql,
      z.object({
        count: z.number()
      })
    );
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
        SUM(count)::integer AS error_count
      FROM submission_feature_error
      WHERE submission_upload_id = ${submissionUploadId}::uuid
      GROUP BY error_code
      ORDER BY error_count DESC, error_code ASC;
    `;

    const response = await this.connection.sql(sql, IngestionErrorCountRow);
    return response.rows;
  }

  /**
   * Get upload-scoped aggregated ingestion error summaries for one upload.
   *
   * @param {string} submissionUploadId Upload scope.
   * @param {number} [limit=25] Max rows to return.
   * @returns {Promise<IngestionErrorSummary[]>}
   */
  async getIngestionErrorSummariesBySubmissionUploadId(
    submissionUploadId: string,
    limit = 25
  ): Promise<IngestionErrorSummary[]> {
    const sql = SQL`
      SELECT
        property_name,
        feature_type_property_id,
        error_code,
        error_message,
        count,
        details
      FROM submission_feature_error
      WHERE submission_upload_id = ${submissionUploadId}::uuid
      ORDER BY count DESC, error_code ASC
      LIMIT ${limit};
    `;

    const response = await this.connection.sql(sql, IngestionErrorSummaryRow);
    return response.rows;
  }
}
