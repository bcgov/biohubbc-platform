import { QueryResultRow } from 'pg';
import SQL from 'sql-template-strings';
import { DOWNLOAD_FEATURE_BATCH_SIZE } from '../../constants/download';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { DATETIME_DATE_SUFFIX, DATETIME_TIME_SUFFIX } from '../../models/datetime-column';
import {
  CreateDownload,
  DownloadArtifactInfo,
  DownloadDetailRecord,
  DownloadId,
  DownloadListRecordBase,
  DownloadListRow,
  DownloadSource,
  HasTeams,
  IsAuthorized
} from '../../models/download';
import { DownloadStatusEnum } from '../../models/download-status';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { BaseRepository } from '../base-repository';

/**
 * Row shape for the typed-cursor base query.
 * Returns the feature skeleton without typed property values — those are
 * hydrated separately from the `submission_feature_property_*` tables.
 */
export interface BaseFeatureRow {
  submission_feature_id: number;
  uuid: string;
  feature_type_name: string;
  data: Record<string, any>;
  parent_uuid: string | null;
}

/**
 * Row shape for typed-table hydration queries.
 * Each typed table returns (submission_feature_id, name, value) tuples
 * that are merged into the base row's data record.
 */
export interface TypedPropertyRow {
  submission_feature_id: number;
  name: string;
  value: any;
}

/**
 * A repository class for accessing download data.
 *
 * @export
 * @class DownloadRepository
 * @extends {BaseRepository}
 */
export class DownloadRepository extends BaseRepository {
  /**
   * Create a new download record.
   *
   * Team linking is handled separately via download_team — callers insert
   * into the join table after creating the download record.
   *
   * @param {CreateDownload} payload
   * @return {Promise<DownloadId>} The created record ID.
   * @memberof DownloadRepository
   */
  async createDownload(payload: CreateDownload): Promise<DownloadId> {
    const { policyId, format, requestedBy } = payload;

    const sql = SQL`
      INSERT INTO download (download_status, policy_id, format, requested_by)
      VALUES ('pending', ${policyId}, ${format}, ${requestedBy})
      RETURNING download_id;
    `;

    const response = await this.connection.sql(sql, DownloadId);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert download record', [
        'DownloadRepository->createDownload',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Link a download to a team via the download_team join table.
   *
   * This is the single source of truth for download-to-team relationships.
   * Authenticated downloads get a team row at creation; anonymous downloads have none.
   *
   * @param {string} downloadId - The download ID.
   * @param {string} teamId - The team ID.
   * @return {Promise<void>}
   * @memberof DownloadRepository
   */
  async createDownloadTeam(downloadId: string, teamId: string): Promise<void> {
    const sql = SQL`
      INSERT INTO download_team (download_id, team_id)
      VALUES (${downloadId}, ${teamId});
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to link download to team', [
        'DownloadRepository->createDownloadTeam',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Link an artifact to a download via the download_artifact join table.
   *
   * Idempotent — the Parquet pipeline writes one download_artifact per feature-type
   * Parquet file, and a retry of the same feature type must not produce duplicate
   * links. The `ON CONFLICT … WHERE record_end_date IS NULL DO NOTHING` clause
   * matches the table's partial unique index so a re-insert on a still-active link
   * is a silent no-op. A first-time insert returns rowCount=1; a conflict returns
   * rowCount=0 — both are valid outcomes and neither throws.
   *
   * @param {string} downloadId - The download ID.
   * @param {string} artifactId - The artifact ID.
   * @return {Promise<void>}
   * @memberof DownloadRepository
   */
  async createDownloadArtifact(downloadId: string, artifactId: string): Promise<void> {
    const sql = SQL`
      INSERT INTO download_artifact (download_id, artifact_id)
      VALUES (${downloadId}, ${artifactId})
      ON CONFLICT (download_id, artifact_id) WHERE record_end_date IS NULL DO NOTHING;
    `;

    await this.connection.sql(sql);
  }

  /**
   * List all active artifact references for a download, joined to `artifact` for
   * the S3 `object_key`.
   *
   * Used by the export pipeline to discover which Parquet files the parent
   * download produced (key shape `downloads/{downloadId}/{featureTypeName}/data.parquet`)
   * without re-running the original search. Bounded by feature-type count for
   * the download (tens at worst), so no pagination needed.
   */
  async listDownloadArtifactsByDownloadId(downloadId: string): Promise<DownloadArtifactInfo[]> {
    const sql = SQL`
      SELECT
        a.artifact_id,
        a.object_key
      FROM download_artifact da
      INNER JOIN artifact a ON a.artifact_id = da.artifact_id
      WHERE da.download_id = ${downloadId}
        AND da.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, DownloadArtifactInfo);
    return response.rows;
  }

  /**
   * Get a download record by ID, including the owning policy's display fields.
   *
   * LEFT JOINs `biohub.policy` so the detail page can show the policy name and
   * description without a second round-trip. `policy_id` is NOT NULL on
   * `download`, so the join is effectively inner — the LEFT is defensive
   * against any future relaxation of that constraint.
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadDetailRecord | null>}
   * @memberof DownloadRepository
   */
  async findDownloadById(downloadId: string): Promise<DownloadDetailRecord | null> {
    const sql = SQL`
      SELECT
        d.download_id,
        d.download_status,
        d.format,
        d.metadata,
        d.started_at,
        d.completed_at,
        d.downloaded_at,
        d.create_date,
        p.name,
        p.description
      FROM download d
      LEFT JOIN policy p ON p.policy_id = d.policy_id
      WHERE d.download_id = ${downloadId};
    `;

    const response = await this.connection.sql(sql, DownloadDetailRecord);

    return response.rows[0] ?? null;
  }

  /**
   * Get a download record by ID, throwing if not found.
   *
   * `get*` throws on missing row (codebase convention — companion to `findDownloadById`).
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadDetailRecord>}
   * @throws {ApiNotFoundError} when no download matches the given ID.
   * @memberof DownloadRepository
   */
  async getDownloadById(downloadId: string): Promise<DownloadDetailRecord> {
    const download = await this.findDownloadById(downloadId);

    if (!download) {
      throw new ApiNotFoundError('Download not found', [
        'DownloadRepository->getDownloadById',
        `no download with id ${downloadId}`
      ]);
    }

    return download;
  }

  /**
   * Get paginated download records accessible to a user, with total count.
   *
   * Uses COUNT(*) OVER() window function to get the total count in the same query,
   * avoiding a second round-trip.
   *
   * Single authorization path: download_team → team → team_member.
   * Returns downloads where the user is a member of any linked team.
   *
   * @param {number} systemUserId - The user ID.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination/sort options.
   * @return {Promise<{ downloads: DownloadListRecordBase[]; count: number }>}
   * @memberof DownloadRepository
   */
  async getDownloadsByTeamMembership(
    systemUserId: number,
    pagination?: ApiPaginationOptions
  ): Promise<{ downloads: DownloadListRecordBase[]; count: number }> {
    const knex = getKnex();

    const query = knex
      .select([
        'd.download_id',
        'd.download_status',
        'd.format',
        'd.metadata',
        'd.started_at',
        'd.completed_at',
        'd.downloaded_at',
        'd.create_date',
        knex.raw('COUNT(*) OVER()::int AS total_count')
      ])
      .from('download as d')
      .innerJoin('download_team as dt', 'dt.download_id', 'd.download_id')
      .innerJoin('team as t', 't.team_id', 'dt.team_id')
      .innerJoin('team_member as tm', 'tm.team_id', 'dt.team_id')
      .where('tm.system_user_id', systemUserId)
      .whereNull('dt.record_end_date')
      .whereNull('t.record_end_date')
      .whereNull('tm.record_end_date');

    if (pagination) {
      this.applyPagination(query, pagination);
    }

    // Default sort when no pagination sort is specified
    if (!pagination?.sort) {
      query.orderBy('d.create_date', 'desc');
    }

    const response = await this.connection.knex(query, DownloadListRow);

    const count = response.rows[0]?.total_count ?? 0;
    // Strip the total_count column from each row before returning
    const downloads: DownloadListRecordBase[] = response.rows.map(({ total_count: _total_count, ...rest }) => rest);

    return { downloads, count };
  }

  /**
   * Update download status by download ID.
   *
   * @param {string} downloadId - The download ID.
   * @param {DownloadStatusEnum} downloadStatus - The new download status.
   * @param {object} [metadata] - Optional metadata (error details, timestamps).
   * @return {Promise<void>}
   * @memberof DownloadRepository
   */
  async updateDownloadStatus(
    downloadId: string,
    downloadStatus: DownloadStatusEnum,
    metadata?: {
      error?: string;
      started_at?: string;
      completed_at?: string;
    }
  ): Promise<void> {
    const sql = SQL`
      UPDATE download
      SET
        download_status = ${downloadStatus},
        metadata = ${JSON.stringify(metadata ?? null)}::jsonb,
        started_at = COALESCE(${metadata?.started_at ?? null}::timestamptz, started_at),
        completed_at = COALESCE(${metadata?.completed_at ?? null}::timestamptz, completed_at)
      WHERE download_id = ${downloadId};
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update download status', [
        'DownloadRepository->updateDownloadStatus',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Mark a download as downloaded (sets downloaded_at timestamp and status).
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<void>}
   * @memberof DownloadRepository
   */
  async markDownloadAsDownloaded(downloadId: string): Promise<void> {
    const sql = SQL`
      UPDATE download
      SET
        download_status = 'downloaded',
        downloaded_at = now()
      WHERE download_id = ${downloadId};
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to mark download as downloaded', [
        'DownloadRepository->markDownloadAsDownloaded',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Get the feature resolution source for a download.
   *
   * Returns the policy_id (drives statement-by-statement evaluation in the
   * pipeline) and requested_by (the security identity the export is built with).
   * The pipeline applies the security filter against `requested_by`, not the
   * audit `create_user`, so feature visibility is judged against the requesting
   * user's authorization scope rather than the inserting connection's grants.
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadSource>}
   * @throws {ApiNotFoundError} when no download matches the given ID.
   * @memberof DownloadRepository
   */
  async getDownloadSource(downloadId: string): Promise<DownloadSource> {
    const sql = SQL`
      SELECT policy_id, requested_by
      FROM download
      WHERE download_id = ${downloadId};
    `;

    const response = await this.connection.sql(sql, DownloadSource);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Download not found', [
        'DownloadRepository->getDownloadSource',
        `downloadId=${downloadId}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Check if a user is authorized to access a specific download.
   *
   * Single authorization path: download_team → team → team_member.
   * Anonymous downloads (no download_team rows) are not checked here —
   * callers handle that separately via isDownloadClaimedByTeam.
   *
   * @param {string} downloadId - The download ID.
   * @param {number} systemUserId - The user ID.
   * @return {Promise<boolean>}
   * @memberof DownloadRepository
   */
  async isUserAuthorizedForDownload(downloadId: string, systemUserId: number): Promise<boolean> {
    const sql = SQL`
      SELECT EXISTS (
        SELECT 1
        FROM download_team dt
        JOIN team t ON t.team_id = dt.team_id
        JOIN team_member tm ON tm.team_id = dt.team_id
        WHERE dt.download_id = ${downloadId}
          AND tm.system_user_id = ${systemUserId}
          AND dt.record_end_date IS NULL
          AND t.record_end_date IS NULL
          AND tm.record_end_date IS NULL
      ) AS authorized;
    `;

    const response = await this.connection.sql(sql, IsAuthorized);

    return response.rows[0]?.authorized ?? false;
  }

  /**
   * Check if a download has any active team associations.
   * No teams = anonymous download (UUID is the credential).
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<boolean>}
   * @memberof DownloadRepository
   */
  async isDownloadClaimedByTeam(downloadId: string): Promise<boolean> {
    const sql = SQL`
      SELECT EXISTS (
        SELECT 1 FROM download_team dt
        WHERE dt.download_id = ${downloadId}
          AND dt.record_end_date IS NULL
      ) AS has_teams;
    `;

    const response = await this.connection.sql(sql, HasTeams);

    return response.rows[0]?.has_teams ?? false;
  }

  /**
   * Stream base feature rows for a filter-based download, filtered by feature type.
   *
   * Same cursor pattern as streamFeatureBaseByCartIdAndType but uses raw SQL
   * search subquery with bindings instead of a cart join.
   *
   * Must be called within an open transaction (cursors require tx context).
   *
   * @param {string} downloadId - The download ID (used for cursor naming).
   * @param {string} searchSql - Raw SQL for the search subquery.
   * @param {any[]} searchBindings - Parameterized bindings for the search SQL.
   * @param {string} featureTypeName - The feature type to stream.
   * @param {number} [batchSize=DOWNLOAD_FEATURE_BATCH_SIZE] - Rows per FETCH.
   * @yields {BaseFeatureRow[]} Batches of base feature rows.
   * @memberof DownloadRepository
   */
  async *streamFeatureBaseBySearchQueryAndType(
    downloadId: string,
    searchSql: string,
    searchBindings: any[],
    featureTypeName: string,
    batchSize = DOWNLOAD_FEATURE_BATCH_SIZE
  ): AsyncGenerator<BaseFeatureRow[]> {
    // featureTypeName is the last positional parameter after all search bindings
    const allBindings = [...searchBindings, featureTypeName];
    const typeParamIndex = allBindings.length;

    yield* this.streamWithCursor<BaseFeatureRow>({
      cursorName: `dl_pq_filter_cursor_${downloadId.replaceAll(/[^a-z0-9_]/gi, '_')}_${featureTypeName.replaceAll(
        /[^a-z0-9_]/gi,
        '_'
      )}`,
      declareSql: `
        SELECT
          sf.submission_feature_id,
          sf.uuid,
          sf.data,
          ft.name AS feature_type_name,
          parent_sf.uuid AS parent_uuid
        FROM submission_feature sf
        INNER JOIN feature_type ft ON sf.feature_type_id = ft.feature_type_id
        LEFT JOIN submission_feature parent_sf ON sf.parent_submission_feature_id = parent_sf.submission_feature_id
        WHERE sf.submission_feature_id IN (${searchSql}) AND ft.name = $${typeParamIndex}
        ORDER BY sf.submission_feature_id`,
      bindings: allBindings,
      batchSize
    });
  }

  /**
   * Shared cursor streaming loop for large result sets.
   *
   * DECLARE the cursor, FETCH batches until exhausted, CLOSE on exit.
   * Caller supplies the cursor name, the inner SELECT (without the DECLARE ... CURSOR FOR prefix),
   * and the parameter bindings.
   *
   * Must be called within an open transaction — Postgres cursors require tx context.
   *
   * @template T - Row shape yielded by the cursor.
   * @param {object} opts
   * @param {string} opts.cursorName - Postgres cursor name (caller is responsible for uniqueness).
   * @param {string} opts.declareSql - Inner SELECT for the cursor.
   * @param {any[]} opts.bindings - Parameter bindings for the SELECT.
   * @param {number} opts.batchSize - Rows per FETCH.
   * @yields {T[]} Batches of rows.
   * @memberof DownloadRepository
   */
  private async *streamWithCursor<T extends QueryResultRow>(opts: {
    cursorName: string;
    declareSql: string;
    bindings: any[];
    batchSize: number;
  }): AsyncGenerator<T[]> {
    const { cursorName, declareSql, bindings, batchSize } = opts;

    await this.connection.query(`DECLARE ${cursorName} CURSOR FOR ${declareSql}`, bindings);

    try {
      while (true) {
        const result = await this.connection.query<T>(`FETCH ${batchSize} FROM ${cursorName}`);
        if (result.rows.length === 0) {
          break;
        }
        yield result.rows;
      }
    } finally {
      await this.connection.query(`CLOSE ${cursorName}`);
    }
  }

  /**
   * Fetch typed property values for a batch of features from typed tables.
   *
   * Queries the typed `submission_feature_property_*` tables in parallel for
   * only the property types present in the schema. Returns raw (id, name, value)
   * tuples — the service layer handles assembly and JSONB fallback logic.
   *
   * - Code properties resolve to `contributor_codeset_code.label` — Parquet files
   *   are standalone, so the human-readable label must be materialized at read time.
   * - Taxon properties resolve to `taxon.itis_scientific_name`.
   * - Geometry properties use `ST_AsGeoJSON()` for GeoJSON output.
   *
   * @param {number[]} submissionFeatureIds - IDs of features in this batch.
   * @param {string[]} propertyTypeNames - Distinct property type names to query.
   * @return {Promise<TypedPropertyRow[]>} Flat list of (id, name, value) tuples.
   * @memberof DownloadRepository
   */
  async fetchTypedPropertyRows(
    submissionFeatureIds: number[],
    propertyTypeNames: string[]
  ): Promise<TypedPropertyRow[]> {
    // Typed-table query definitions keyed by property type name.
    // Each entry maps a logical type to its SQL query against the corresponding typed table.
    const TYPED_TABLE_QUERIES: Record<string, string> = {
      string: `SELECT p.submission_feature_id, fp.name, p.value
               FROM submission_feature_property_string p
               INNER JOIN feature_type_property ftp ON p.feature_type_property_id = ftp.feature_type_property_id
               INNER JOIN feature_property fp ON ftp.feature_property_id = fp.feature_property_id
               WHERE p.submission_feature_id = ANY($1)`,
      number: `SELECT p.submission_feature_id, fp.name, p.value
               FROM submission_feature_property_number p
               INNER JOIN feature_type_property ftp ON p.feature_type_property_id = ftp.feature_type_property_id
               INNER JOIN feature_property fp ON ftp.feature_property_id = fp.feature_property_id
               WHERE p.submission_feature_id = ANY($1)`,
      boolean: `SELECT p.submission_feature_id, fp.name, p.value
                FROM submission_feature_property_boolean p
                INNER JOIN feature_type_property ftp ON p.feature_type_property_id = ftp.feature_type_property_id
                INNER JOIN feature_property fp ON ftp.feature_property_id = fp.feature_property_id
                WHERE p.submission_feature_id = ANY($1)`,
      // `datetime` emits up to two synthetic rows per source row, with the
      // property name suffixed `_date` / `_time`. A row with both components
      // populated produces two rows; a partial-component row produces one.
      // The Parquet schema/writer and CSV writer expand each `datetime`
      // property into matching `<prop>_date` / `<prop>_time` columns, so
      // `assembleFeatureData` merges these synthetic rows under the same
      // suffixed keys without special-casing.
      //
      // Two columns rather than one combined `TIMESTAMP_MILLIS` because
      // Parquet/CSV are query substrates: partial components must remain
      // first-class for predicate pushdown (DuckDB filters by date-of or
      // time-of without parsing a string). The DB schema split into
      // `date_value` / `time_value` was driven by the same first-class-
      // partials rule on the read side.
      //
      // Suffix constants live in `models/datetime-column.ts` and are shared
      // with `parquet-utils.ts`. The two sites must produce identical column
      // names — drift silently nulls cells.
      datetime: `SELECT p.submission_feature_id, fp.name || '${DATETIME_DATE_SUFFIX}' AS name, to_char(p.date_value, 'YYYY-MM-DD') AS value
                 FROM submission_feature_property_timestamp p
                 INNER JOIN feature_type_property ftp ON p.feature_type_property_id = ftp.feature_type_property_id
                 INNER JOIN feature_property fp ON ftp.feature_property_id = fp.feature_property_id
                 WHERE p.submission_feature_id = ANY($1) AND p.date_value IS NOT NULL
                 UNION ALL
                 SELECT p.submission_feature_id, fp.name || '${DATETIME_TIME_SUFFIX}' AS name, to_char(p.time_value, 'HH24:MI:SS') AS value
                 FROM submission_feature_property_timestamp p
                 INNER JOIN feature_type_property ftp ON p.feature_type_property_id = ftp.feature_type_property_id
                 INNER JOIN feature_property fp ON ftp.feature_property_id = fp.feature_property_id
                 WHERE p.submission_feature_id = ANY($1) AND p.time_value IS NOT NULL`,
      code: `SELECT p.submission_feature_id, fp.name, ccc.label AS value
             FROM submission_feature_property_code p
             INNER JOIN feature_type_property ftp ON p.feature_type_property_id = ftp.feature_type_property_id
             INNER JOIN feature_property fp ON ftp.feature_property_id = fp.feature_property_id
             INNER JOIN contributor_codeset_code ccc ON p.contributor_codeset_code_id = ccc.contributor_codeset_code_id
             WHERE p.submission_feature_id = ANY($1)`,
      taxon: `SELECT p.submission_feature_id, fp.name, t.itis_scientific_name AS value
              FROM submission_feature_property_taxon p
              INNER JOIN feature_type_property ftp ON p.feature_type_property_id = ftp.feature_type_property_id
              INNER JOIN feature_property fp ON ftp.feature_property_id = fp.feature_property_id
              INNER JOIN taxon t ON p.taxon_id = t.taxon_id
              WHERE p.submission_feature_id = ANY($1)`,
      spatial: `SELECT p.submission_feature_id, fp.name, ST_AsGeoJSON(p.value)::jsonb AS value
                FROM submission_feature_property_geometry p
                INNER JOIN feature_type_property ftp ON p.feature_type_property_id = ftp.feature_type_property_id
                INNER JOIN feature_property fp ON ftp.feature_property_id = fp.feature_property_id
                WHERE p.submission_feature_id = ANY($1)`
    };

    // Query only the typed tables for property types present in this batch
    const queries = propertyTypeNames
      .filter((typeName) => typeName in TYPED_TABLE_QUERIES)
      .map((typeName) =>
        this.connection
          .query<TypedPropertyRow>(TYPED_TABLE_QUERIES[typeName], [submissionFeatureIds])
          .then((r) => r.rows)
      );

    const results = await Promise.all(queries);

    return results.flat();
  }
}
