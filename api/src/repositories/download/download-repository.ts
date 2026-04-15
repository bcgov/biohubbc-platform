import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import { FRAGMENT_SIZE_THRESHOLD } from '../../constants/download';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import {
  CreateDownload,
  DownloadArtifactInfo,
  DownloadFeatureSummary,
  DownloadId,
  DownloadListRecord,
  DownloadListRow,
  DownloadRecord,
  DownloadSource,
  DownloadTotalSize,
  HasTeams,
  IsAuthorized,
  ParquetFeatureData
} from '../../models/download';
import { DownloadStatusEnum } from '../../models/download-status';
import { CsvPropertyDefinition } from '../../utils/csv-utils';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { BaseRepository } from '../base-repository';

/**
 * Internal row shape for the typed-cursor base query.
 * Returns the feature skeleton without typed property values — those are
 * hydrated separately from the `submission_feature_property_*` tables.
 */
interface BaseFeatureRow {
  submission_feature_id: number;
  uuid: string;
  feature_type_name: string;
  data: Record<string, any>;
  parent_uuid: string | null;
}

/**
 * Internal row shape for typed-table hydration queries.
 * Each typed table returns (submission_feature_id, name, value) tuples
 * that are merged into the base row's data record.
 */
interface TypedPropertyRow {
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
    const { fragmentSizeBytes, filters, cartId, format } = payload;
    const sizeBytes = fragmentSizeBytes ?? FRAGMENT_SIZE_THRESHOLD;

    const sql = SQL`
      INSERT INTO download (download_status, fragment_size_bytes, filters, cart_id, format)
      VALUES ('pending', ${sizeBytes}, ${filters ? JSON.stringify(filters) : null}::jsonb, ${cartId ?? null}, ${format})
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
   * Downloads are tracked as formal artifacts from the moment they're requested.
   * The artifact is created as 'pending' (no file yet) and linked here.
   *
   * @param {string} downloadId - The download ID.
   * @param {string} artifactId - The artifact ID.
   * @return {Promise<void>}
   * @memberof DownloadRepository
   */
  async createDownloadArtifact(downloadId: string, artifactId: string): Promise<void> {
    const sql = SQL`
      INSERT INTO download_artifact (download_id, artifact_id)
      VALUES (${downloadId}, ${artifactId});
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to link artifact to download', [
        'DownloadRepository->createDownloadArtifact',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Get a download record by ID.
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadRecord | null>}
   * @memberof DownloadRepository
   */
  async findDownloadById(downloadId: string): Promise<DownloadRecord | null> {
    const sql = SQL`
      SELECT
        download_id,
        download_status,
        format,
        metadata,
        started_at,
        completed_at,
        downloaded_at,
        total_fragments,
        completed_fragments,
        estimated_total_size_bytes,
        fragment_size_bytes,
        create_date
      FROM download
      WHERE download_id = ${downloadId};
    `;

    const response = await this.connection.sql(sql, DownloadRecord);

    return response.rows[0] ?? null;
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
   * @return {Promise<{ downloads: DownloadListRecord[]; count: number }>}
   * @memberof DownloadRepository
   */
  async getDownloadsByTeamMembership(
    systemUserId: number,
    pagination?: ApiPaginationOptions
  ): Promise<{ downloads: DownloadListRecord[]; count: number }> {
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
        'd.total_fragments',
        'd.completed_fragments',
        'd.estimated_total_size_bytes',
        'd.fragment_size_bytes',
        'd.create_date',
        knex.raw('COUNT(*) OVER()::int AS total_count')
      ])
      .from('download as d')
      .innerJoin('download_team as dt', 'dt.download_id', 'd.download_id')
      .innerJoin('team_member as tm', 'tm.team_id', 'dt.team_id')
      .where('tm.system_user_id', systemUserId)
      .whereNull('dt.record_end_date')
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
    const downloads: DownloadListRecord[] = response.rows.map(({ total_count: _total_count, ...rest }) => rest);

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
   * Returns cart_id and filters — exactly one should be non-null.
   * Used by DownloadService.getDownloadFeatures to branch between
   * cart-based (frozen snapshot) and filter-based (live re-query) paths.
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadSource>}
   * @memberof DownloadRepository
   */
  async getDownloadSource(downloadId: string): Promise<DownloadSource> {
    const sql = SQL`
      SELECT cart_id, filters, create_user
      FROM download
      WHERE download_id = ${downloadId};
    `;

    const response = await this.connection.sql(sql, DownloadSource);

    if (response.rowCount === 0) {
      throw new ApiExecuteSQLError('Download not found', [
        'DownloadRepository->getDownloadSource',
        'rowCount was 0, expected 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Resolve download features from cart_submission_feature.
   *
   * Cart downloads are frozen: checkout marks the cart as CHECKED_OUT,
   * so cart_submission_feature rows don't change after checkout.
   *
   * @param {string} cartId - The cart ID (from download.cart_id).
   * @return {Promise<DownloadFeatureSummary[]>}
   * @memberof DownloadRepository
   */
  async getDownloadFeaturesByCartId(cartId: string): Promise<DownloadFeatureSummary[]> {
    const knex = getKnex();

    const query = knex
      .select([
        'sf.submission_feature_id',
        'sf.submission_id',
        knex.raw('ft.name AS feature_type_name'),
        knex.raw('sf.data_byte_size AS estimated_byte_size')
      ])
      .from('cart_submission_feature as csf')
      .innerJoin('submission_feature as sf', 'csf.submission_feature_id', 'sf.submission_feature_id')
      .innerJoin('feature_type as ft', 'sf.feature_type_id', 'ft.feature_type_id')
      .where('csf.cart_id', cartId);

    const response = await this.connection.knex(query, DownloadFeatureSummary);
    return response.rows;
  }

  /**
   * Resolve download features by joining a search subquery directly to
   * submission_feature + feature_type — entirely in SQL, no round-trip.
   *
   * The search CTE (with security filtering) runs as a subquery inside
   * WHERE IN, so PostgreSQL plans and executes it in a single statement.
   * This avoids pulling potentially 500K+ IDs into a JS array.
   *
   * @param {Knex.QueryBuilder} searchSubquery - Unexecuted Knex subquery
   *   returning submission_feature_id rows (from SearchFeatureRepository).
   * @return {Promise<DownloadFeatureSummary[]>}
   * @memberof DownloadRepository
   */
  async getDownloadFeaturesBySearchQuery(searchSubquery: Knex.QueryBuilder): Promise<DownloadFeatureSummary[]> {
    const knex = getKnex();

    const query = knex
      .select([
        'sf.submission_feature_id',
        'sf.submission_id',
        knex.raw('ft.name AS feature_type_name'),
        knex.raw('sf.data_byte_size AS estimated_byte_size')
      ])
      .from('submission_feature as sf')
      .innerJoin('feature_type as ft', 'sf.feature_type_id', 'ft.feature_type_id')
      .whereIn('sf.submission_feature_id', searchSubquery);

    const response = await this.connection.knex(query, DownloadFeatureSummary);
    return response.rows;
  }

  /**
   * Get total estimated byte size for a cart-based download as a SQL aggregate.
   *
   * Returns SUM(data_byte_size) for all features in the cart. Never materializes
   * feature rows in JS — returns a single row with the aggregate from the database.
   * Callers coerce the string total to a number (BIGINT returns as string from pg).
   *
   * @param {string} cartId - The cart ID (from download.cart_id).
   * @return {Promise<DownloadTotalSize>} Row with total (string or null).
   * @memberof DownloadRepository
   */
  async getDownloadTotalSizeByCartId(cartId: string): Promise<DownloadTotalSize> {
    const knex = getKnex();
    const query = knex
      .sum('sf.data_byte_size as total')
      .from('cart_submission_feature as csf')
      .innerJoin('submission_feature as sf', 'csf.submission_feature_id', 'sf.submission_feature_id')
      .where('csf.cart_id', cartId)
      .first();

    const response = await this.connection.knex(query, DownloadTotalSize);
    return response.rows[0];
  }

  /**
   * Get total estimated byte size for a filter-based download as a SQL aggregate.
   *
   * Returns SUM(data_byte_size) for all features matching the search subquery.
   * Never materializes feature rows in JS — returns a single row with the aggregate.
   * Callers coerce the string total to a number (BIGINT returns as string from pg).
   *
   * @param {Knex.QueryBuilder} searchSubquery - Unexecuted Knex subquery
   *   returning submission_feature_id rows (from SearchFeatureRepository).
   * @return {Promise<DownloadTotalSize>} Row with total (string or null).
   * @memberof DownloadRepository
   */
  async getDownloadTotalSizeBySearchQuery(searchSubquery: Knex.QueryBuilder): Promise<DownloadTotalSize> {
    const knex = getKnex();
    const query = knex
      .sum('sf.data_byte_size as total')
      .from('submission_feature as sf')
      .whereIn('sf.submission_feature_id', searchSubquery)
      .first();

    const response = await this.connection.knex(query, DownloadTotalSize);
    return response.rows[0];
  }

  /**
   * Stream features for a cart-based download using a SQL cursor.
   *
   * Yields batches of DownloadFeatureSummary to avoid loading 500K+ rows
   * into JS memory. Features are sorted by feature_type_name so bin packing
   * keeps same types together, minimizing duplicate CSVs across fragments.
   *
   * Must be called within an open transaction (cursors require tx context).
   * Follows the streamFragmentFeaturesByType pattern.
   *
   * @param {string} cartId - The cart ID (from download.cart_id).
   * @param {number} [batchSize=5000] - Rows per FETCH.
   * @yields {DownloadFeatureSummary[]} Batches of feature summaries.
   * @memberof DownloadRepository
   */
  async *streamDownloadFeaturesByCartId(cartId: string, batchSize = 5000): AsyncGenerator<DownloadFeatureSummary[]> {
    const cursorName = `dl_cart_cursor_${cartId.replace(/[^a-z0-9_]/gi, '_')}`;

    await this.connection.query(
      `DECLARE ${cursorName} CURSOR FOR
        SELECT
          sf.submission_feature_id,
          sf.submission_id,
          ft.name AS feature_type_name,
          sf.data_byte_size AS estimated_byte_size
        FROM cart_submission_feature csf
        INNER JOIN submission_feature sf ON csf.submission_feature_id = sf.submission_feature_id
        INNER JOIN feature_type ft ON sf.feature_type_id = ft.feature_type_id
        WHERE csf.cart_id = $1
        ORDER BY ft.name, sf.submission_feature_id`,
      [cartId]
    );

    try {
      while (true) {
        const result = await this.connection.query<DownloadFeatureSummary>(`FETCH ${batchSize} FROM ${cursorName}`);
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
   * Stream features for a filter-based download using a SQL cursor.
   *
   * The search CTE (with security filtering) is embedded in the cursor
   * declaration — features are resolved and streamed in a single SQL
   * statement, never materializing the full ID set in JS.
   *
   * @param {string} downloadId - The download ID (used for cursor naming).
   * @param {string} searchSql - Raw SQL for the search subquery (from buildSearchFeatureIdsSubquery).
   * @param {any[]} searchBindings - Parameterized bindings for the search SQL.
   * @param {number} [batchSize=5000] - Rows per FETCH.
   * @yields {DownloadFeatureSummary[]} Batches of feature summaries.
   * @memberof DownloadRepository
   */
  async *streamDownloadFeaturesBySearchQuery(
    downloadId: string,
    searchSql: string,
    searchBindings: any[],
    batchSize = 5000
  ): AsyncGenerator<DownloadFeatureSummary[]> {
    const cursorName = `dl_filter_cursor_${downloadId.replace(/[^a-z0-9_]/gi, '_')}`;

    await this.connection.query(
      `DECLARE ${cursorName} CURSOR FOR
        SELECT
          sf.submission_feature_id,
          sf.submission_id,
          ft.name AS feature_type_name,
          sf.data_byte_size AS estimated_byte_size
        FROM submission_feature sf
        INNER JOIN feature_type ft ON sf.feature_type_id = ft.feature_type_id
        WHERE sf.submission_feature_id IN (${searchSql})
        ORDER BY ft.name, sf.submission_feature_id`,
      searchBindings
    );

    try {
      while (true) {
        const result = await this.connection.query<DownloadFeatureSummary>(`FETCH ${batchSize} FROM ${cursorName}`);
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
   * Update fragment counts on a download record.
   *
   * @param {string} downloadId - The download ID.
   * @param {number} totalFragments - Total number of fragments.
   * @param {number} completedFragments - Number of completed fragments.
   * @return {Promise<void>}
   * @memberof DownloadRepository
   */
  async updateDownloadFragmentCounts(
    downloadId: string,
    totalFragments: number,
    completedFragments: number
  ): Promise<void> {
    const sql = SQL`
      UPDATE download
      SET total_fragments = ${totalFragments}, completed_fragments = ${completedFragments}
      WHERE download_id = ${downloadId};
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update download fragment counts', [
        'DownloadRepository->updateDownloadFragmentCounts',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Update estimated total size on a download record.
   *
   * @param {string} downloadId - The download ID.
   * @param {number} bytes - Estimated total size in bytes.
   * @return {Promise<void>}
   * @memberof DownloadRepository
   */
  async updateEstimatedTotalSize(downloadId: string, bytes: number): Promise<void> {
    const sql = SQL`
      UPDATE download
      SET estimated_total_size_bytes = ${bytes}
      WHERE download_id = ${downloadId};
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update estimated total size', [
        'DownloadRepository->updateEstimatedTotalSize',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
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
        JOIN team_member tm ON tm.team_id = dt.team_id
        WHERE dt.download_id = ${downloadId}
          AND tm.system_user_id = ${systemUserId}
          AND dt.record_end_date IS NULL
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
   * Get the artifact info (S3 object key) linked to a download.
   *
   * The Parquet pipeline needs the S3 key to know where to write the output file.
   * JOINs through download_artifact to the artifact table.
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadArtifactInfo>}
   * @memberof DownloadRepository
   */
  async getDownloadArtifact(downloadId: string): Promise<DownloadArtifactInfo> {
    const sql = SQL`
      SELECT a.artifact_id, a.object_key
      FROM download_artifact da
      INNER JOIN artifact a ON da.artifact_id = a.artifact_id
      WHERE da.download_id = ${downloadId};
    `;

    const response = await this.connection.sql(sql, DownloadArtifactInfo);

    if (response.rowCount === 0) {
      throw new ApiExecuteSQLError('Download artifact not found', [
        'DownloadRepository->getDownloadArtifact',
        'rowCount was 0, expected 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * List distinct feature type names for a cart-based download.
   *
   * Used by the Parquet pipeline to iterate over each feature type
   * and generate a separate Parquet file per type.
   *
   * @param {string} cartId - The cart ID (from download.cart_id).
   * @return {Promise<string[]>} Ordered list of feature type names.
   * @memberof DownloadRepository
   */
  async listDownloadFeatureTypesByCartId(cartId: string): Promise<string[]> {
    const FeatureTypeName = z.object({ feature_type_name: z.string() });

    const sql = SQL`
      SELECT DISTINCT ft.name AS feature_type_name
      FROM cart_submission_feature csf
      INNER JOIN submission_feature sf ON csf.submission_feature_id = sf.submission_feature_id
      INNER JOIN feature_type ft ON sf.feature_type_id = ft.feature_type_id
      WHERE csf.cart_id = ${cartId}
      ORDER BY ft.name;
    `;

    const response = await this.connection.sql(sql, FeatureTypeName);

    return response.rows.map((r) => r.feature_type_name);
  }

  /**
   * List distinct feature type names for a filter-based download.
   *
   * Same purpose as listDownloadFeatureTypesByCartId but uses a Knex subquery
   * from the search pipeline instead of a cart join.
   *
   * @param {Knex.QueryBuilder} searchSubquery - Unexecuted Knex subquery
   *   returning submission_feature_id rows (from SearchFeatureRepository).
   * @return {Promise<string[]>} Ordered list of feature type names.
   * @memberof DownloadRepository
   */
  async listDownloadFeatureTypesBySearchQuery(searchSubquery: Knex.QueryBuilder): Promise<string[]> {
    const FeatureTypeName = z.object({ feature_type_name: z.string() });

    const knex = getKnex();
    const query = knex
      .distinct('ft.name as feature_type_name')
      .from('submission_feature as sf')
      .innerJoin('feature_type as ft', 'sf.feature_type_id', 'ft.feature_type_id')
      .whereIn('sf.submission_feature_id', searchSubquery)
      .orderBy('ft.name');

    const response = await this.connection.knex(query, FeatureTypeName);

    return response.rows.map((r) => r.feature_type_name);
  }

  /**
   * Stream base feature rows for a cart-based download, filtered by feature type.
   *
   * Returns the feature skeleton (id, uuid, data JSONB, parent_uuid) without
   * typed property values. Typed values are hydrated separately by
   * hydrateFeatureBatchFromTypedTables to avoid joining 7 typed tables
   * in a single massive query.
   *
   * Must be called within an open transaction (cursors require tx context).
   *
   * @param {string} cartId - The cart ID (from download.cart_id).
   * @param {string} featureTypeName - The feature type to stream.
   * @param {number} [batchSize=5000] - Rows per FETCH.
   * @yields {BaseFeatureRow[]} Batches of base feature rows.
   * @memberof DownloadRepository
   */
  async *streamFeatureBaseByCartIdAndType(
    cartId: string,
    featureTypeName: string,
    batchSize = 5000
  ): AsyncGenerator<BaseFeatureRow[]> {
    const cursorName = `dl_pq_cart_cursor_${cartId.replace(/[^a-z0-9_]/gi, '_')}_${featureTypeName.replace(
      /[^a-z0-9_]/gi,
      '_'
    )}`;

    await this.connection.query(
      `DECLARE ${cursorName} CURSOR FOR
        SELECT
          sf.submission_feature_id,
          sf.uuid,
          sf.data,
          ft.name AS feature_type_name,
          parent_sf.uuid AS parent_uuid
        FROM cart_submission_feature csf
        INNER JOIN submission_feature sf ON csf.submission_feature_id = sf.submission_feature_id
        INNER JOIN feature_type ft ON sf.feature_type_id = ft.feature_type_id
        LEFT JOIN submission_feature parent_sf ON sf.parent_submission_feature_id = parent_sf.submission_feature_id
        WHERE csf.cart_id = $1 AND ft.name = $2
        ORDER BY sf.submission_feature_id`,
      [cartId, featureTypeName]
    );

    try {
      while (true) {
        const result = await this.connection.query<BaseFeatureRow>(`FETCH ${batchSize} FROM ${cursorName}`);

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
   * @param {number} [batchSize=5000] - Rows per FETCH.
   * @yields {BaseFeatureRow[]} Batches of base feature rows.
   * @memberof DownloadRepository
   */
  async *streamFeatureBaseBySearchQueryAndType(
    downloadId: string,
    searchSql: string,
    searchBindings: any[],
    featureTypeName: string,
    batchSize = 5000
  ): AsyncGenerator<BaseFeatureRow[]> {
    const cursorName = `dl_pq_filter_cursor_${downloadId.replace(/[^a-z0-9_]/gi, '_')}_${featureTypeName.replace(
      /[^a-z0-9_]/gi,
      '_'
    )}`;

    // featureTypeName is the last positional parameter after all search bindings
    const allBindings = [...searchBindings, featureTypeName];
    const typeParamIndex = allBindings.length;

    await this.connection.query(
      `DECLARE ${cursorName} CURSOR FOR
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
      allBindings
    );

    try {
      while (true) {
        const result = await this.connection.query<BaseFeatureRow>(`FETCH ${batchSize} FROM ${cursorName}`);

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
   * Hydrate a batch of base feature rows with typed property values.
   *
   * Queries 7 typed `submission_feature_property_*` tables to reconstruct
   * the `data` record with correct types and resolved labels:
   * - Code properties resolve to `contributor_codeset_code.label` — the human-readable
   *   label, not the FK. Parquet files are standalone; GIS consumers have no access
   *   to the database, so the label must be materialized at read time.
   * - Taxon properties resolve to `taxon.itis_scientific_name` — same standalone-file
   *   principle.
   * - Geometry properties use `ST_AsGeoJSON()` for GeoJSON output, later converted
   *   to WKB by parquet-utils.
   *
   * Properties without typed tables (array, object, artifact_key) fall back to
   * `submission_feature.data.properties` — these types have dynamic internal structure
   * that can't be represented as a single typed value.
   *
   * Assembly lives in the repository (rather than the service) because it is a
   * SQL-boundary concern: batching 7 typed-table queries into a single round-trip
   * window, not a business decision.
   *
   * @param {BaseFeatureRow[]} baseBatch - Base feature rows from a cursor stream.
   * @param {CsvPropertyDefinition[]} properties - Schema property definitions.
   * @return {Promise<ParquetFeatureData[]>}
   * @memberof DownloadRepository
   */
  async hydrateFeatureBatchFromTypedTables(
    baseBatch: BaseFeatureRow[],
    properties: CsvPropertyDefinition[]
  ): Promise<ParquetFeatureData[]> {
    const submissionFeatureIds = baseBatch.map((row) => row.submission_feature_id);

    // Group properties by type to determine which typed tables to query
    const typeGroups = new Map<string, string[]>();
    for (const prop of properties) {
      const typeName = prop.feature_property_type_name;
      if (!typeGroups.has(typeName)) {
        typeGroups.set(typeName, []);
      }
      typeGroups.get(typeName)!.push(prop.feature_property_name);
    }

    // Types that have dedicated typed tables
    const JSONB_FALLBACK_TYPES = new Set(['array', 'object', 'artifact_key']);

    // Build parallel typed-table queries for each type that has a dedicated table
    const typedQueries: Promise<TypedPropertyRow[]>[] = [];

    if (typeGroups.has('string')) {
      typedQueries.push(
        this.connection
          .query<TypedPropertyRow>(
            `SELECT p.submission_feature_id, fp.name, p.value
            FROM submission_feature_property_string p
            INNER JOIN feature_type_property ftp ON p.feature_type_property_id = ftp.feature_type_property_id
            INNER JOIN feature_property fp ON ftp.feature_property_id = fp.feature_property_id
            WHERE p.submission_feature_id = ANY($1)`,
            [submissionFeatureIds]
          )
          .then((r) => r.rows)
      );
    }

    if (typeGroups.has('number')) {
      typedQueries.push(
        this.connection
          .query<TypedPropertyRow>(
            `SELECT p.submission_feature_id, fp.name, p.value
            FROM submission_feature_property_number p
            INNER JOIN feature_type_property ftp ON p.feature_type_property_id = ftp.feature_type_property_id
            INNER JOIN feature_property fp ON ftp.feature_property_id = fp.feature_property_id
            WHERE p.submission_feature_id = ANY($1)`,
            [submissionFeatureIds]
          )
          .then((r) => r.rows)
      );
    }

    if (typeGroups.has('boolean')) {
      typedQueries.push(
        this.connection
          .query<TypedPropertyRow>(
            `SELECT p.submission_feature_id, fp.name, p.value
            FROM submission_feature_property_boolean p
            INNER JOIN feature_type_property ftp ON p.feature_type_property_id = ftp.feature_type_property_id
            INNER JOIN feature_property fp ON ftp.feature_property_id = fp.feature_property_id
            WHERE p.submission_feature_id = ANY($1)`,
            [submissionFeatureIds]
          )
          .then((r) => r.rows)
      );
    }

    if (typeGroups.has('datetime')) {
      typedQueries.push(
        this.connection
          .query<TypedPropertyRow>(
            `SELECT p.submission_feature_id, fp.name, p.value
            FROM submission_feature_property_timestamp p
            INNER JOIN feature_type_property ftp ON p.feature_type_property_id = ftp.feature_type_property_id
            INNER JOIN feature_property fp ON ftp.feature_property_id = fp.feature_property_id
            WHERE p.submission_feature_id = ANY($1)`,
            [submissionFeatureIds]
          )
          .then((r) => r.rows)
      );
    }

    if (typeGroups.has('code')) {
      typedQueries.push(
        this.connection
          .query<TypedPropertyRow>(
            `SELECT p.submission_feature_id, fp.name, ccc.label AS value
            FROM submission_feature_property_code p
            INNER JOIN feature_type_property ftp ON p.feature_type_property_id = ftp.feature_type_property_id
            INNER JOIN feature_property fp ON ftp.feature_property_id = fp.feature_property_id
            INNER JOIN contributor_codeset_code ccc ON p.contributor_codeset_code_id = ccc.contributor_codeset_code_id
            WHERE p.submission_feature_id = ANY($1)`,
            [submissionFeatureIds]
          )
          .then((r) => r.rows)
      );
    }

    if (typeGroups.has('taxon')) {
      typedQueries.push(
        this.connection
          .query<TypedPropertyRow>(
            `SELECT p.submission_feature_id, fp.name, t.itis_scientific_name AS value
            FROM submission_feature_property_taxon p
            INNER JOIN feature_type_property ftp ON p.feature_type_property_id = ftp.feature_type_property_id
            INNER JOIN feature_property fp ON ftp.feature_property_id = fp.feature_property_id
            INNER JOIN taxon t ON p.taxon_id = t.taxon_id
            WHERE p.submission_feature_id = ANY($1)`,
            [submissionFeatureIds]
          )
          .then((r) => r.rows)
      );
    }

    if (typeGroups.has('spatial')) {
      typedQueries.push(
        this.connection
          .query<TypedPropertyRow>(
            `SELECT p.submission_feature_id, fp.name, ST_AsGeoJSON(p.value)::jsonb AS value
            FROM submission_feature_property_geometry p
            INNER JOIN feature_type_property ftp ON p.feature_type_property_id = ftp.feature_type_property_id
            INNER JOIN feature_property fp ON ftp.feature_property_id = fp.feature_property_id
            WHERE p.submission_feature_id = ANY($1)`,
            [submissionFeatureIds]
          )
          .then((r) => r.rows)
      );
    }

    // Execute all typed-table queries in parallel
    const typedResults = await Promise.all(typedQueries);

    // Build property map: submission_feature_id -> { propName: value }
    const propertyMap = new Map<number, Record<string, any>>();
    for (const rows of typedResults) {
      for (const row of rows) {
        if (!propertyMap.has(row.submission_feature_id)) {
          propertyMap.set(row.submission_feature_id, {});
        }
        propertyMap.get(row.submission_feature_id)![row.name] = row.value;
      }
    }

    // Assemble ParquetFeatureData for each base row
    return baseBatch.map((baseRow) => {
      const typedProps = propertyMap.get(baseRow.submission_feature_id) ?? {};
      const data: Record<string, any> = {};

      for (const prop of properties) {
        const propName = prop.feature_property_name;

        if (JSONB_FALLBACK_TYPES.has(prop.feature_property_type_name)) {
          // Array/object/artifact_key: fall back to JSONB data.properties
          data[propName] = baseRow.data?.properties?.[propName] ?? null;
        } else if (propName in typedProps) {
          data[propName] = typedProps[propName];
        } else {
          data[propName] = null;
        }
      }

      return {
        submission_feature_id: baseRow.submission_feature_id,
        uuid: baseRow.uuid,
        feature_type_name: baseRow.feature_type_name,
        data,
        parent_uuid: baseRow.parent_uuid
      };
    });
  }
}
