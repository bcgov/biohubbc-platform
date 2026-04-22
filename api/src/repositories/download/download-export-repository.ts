import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { CreateDownloadExportPayload, DownloadExportListRow, DownloadExportRecord } from '../../models/download-export';
import { DownloadExportArtifactWithFile } from '../../models/download-export-artifact';
import { DownloadStatusEnum } from '../../models/download-status';
import { BaseRepository } from '../base-repository';

/**
 * A repository class for accessing download export data.
 *
 * Export jobs track per-download format conversions (e.g. parquet -> CSV).
 * Pairs with `download_export_artifact` — one join row per part-zip, with
 * `chunk_id` reused as the 1-based part index.
 *
 * @export
 * @class DownloadExportRepository
 * @extends {BaseRepository}
 */
export class DownloadExportRepository extends BaseRepository {
  /**
   * Create a new download export row.
   *
   * Returns the full `DownloadExportRecord` rather than just the ID (unlike the
   * sibling `DownloadRepository.createDownload` which returns `DownloadId` only).
   * Callers need `status`, `chunk_size_bytes`, and `mode` back immediately to
   * build the HTTP response and publish the background job — returning the full
   * record here skips a redundant SELECT round-trip.
   */
  async createDownloadExport(payload: CreateDownloadExportPayload): Promise<DownloadExportRecord> {
    const sql = SQL`
      INSERT INTO download_export (download_id, format, mode, chunk_size_bytes)
      VALUES (${payload.download_id}, ${payload.format}, ${payload.mode}, ${payload.chunk_size_bytes})
      RETURNING
        download_export_id,
        download_id,
        format,
        status,
        mode,
        chunk_size_bytes,
        started_at,
        completed_at,
        error_message;
    `;

    const response = await this.connection.sql(sql, DownloadExportRecord);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert download export record', [
        'DownloadExportRepository->createDownloadExport',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a download export record by ID.
   *
   * `find*` returns null on missing (codebase convention — companion to
   * `getDownloadExportById`).
   */
  async findDownloadExportById(exportId: string): Promise<DownloadExportRecord | null> {
    const sql = SQL`
      SELECT
        download_export_id,
        download_id,
        format,
        status,
        mode,
        chunk_size_bytes,
        started_at,
        completed_at,
        error_message
      FROM download_export
      WHERE download_export_id = ${exportId};
    `;

    const response = await this.connection.sql(sql, DownloadExportRecord);

    return response.rows[0] ?? null;
  }

  /**
   * Get a download export record by ID, throwing if not found.
   *
   * @throws {ApiExecuteSQLError} when no export matches the given ID.
   */
  async getDownloadExportById(exportId: string): Promise<DownloadExportRecord> {
    const record = await this.findDownloadExportById(exportId);

    if (!record) {
      throw new ApiExecuteSQLError('Download export not found', [
        'DownloadExportRepository->getDownloadExportById',
        `no download_export with id ${exportId}`
      ]);
    }

    return record;
  }

  /**
   * List all exports for a download, newest first, with `part_count` so the card
   * can decide single-vs-multi-part UI without a detail-endpoint round-trip.
   *
   * LEFT JOIN preserves pending/processing exports that have no artifacts yet
   * (their `part_count` resolves to 0). Bounded by `download_id` FK — tens of
   * exports per download at worst.
   */
  async getDownloadExportsByDownloadId(downloadId: string): Promise<DownloadExportListRow[]> {
    const sql = SQL`
      SELECT
        de.download_export_id,
        de.download_id,
        de.format,
        de.status,
        de.mode,
        de.chunk_size_bytes,
        de.started_at,
        de.completed_at,
        de.error_message,
        COALESCE(COUNT(dea.download_export_artifact_id), 0)::int AS part_count
      FROM download_export de
      LEFT JOIN download_export_artifact dea
        ON dea.download_export_id = de.download_export_id
       AND dea.record_end_date IS NULL
      WHERE de.download_id = ${downloadId}
      GROUP BY de.download_export_id
      ORDER BY de.create_date DESC;
    `;

    const response = await this.connection.sql(sql, DownloadExportListRow);
    return response.rows;
  }

  /**
   * Update export status with optional timestamp + error-message bookkeeping.
   *
   * Mirrors `DownloadRepository.updateDownloadStatus` — COALESCE keeps previous
   * values when the caller omits a field. Service decides which timestamps to
   * send; repo just applies them.
   */
  async updateDownloadExportStatus(
    exportId: string,
    status: DownloadStatusEnum,
    metadata?: {
      started_at?: string;
      completed_at?: string;
      error_message?: string;
    }
  ): Promise<void> {
    const sql = SQL`
      UPDATE download_export
      SET
        status = ${status},
        started_at = COALESCE(${metadata?.started_at ?? null}::timestamptz, started_at),
        completed_at = COALESCE(${metadata?.completed_at ?? null}::timestamptz, completed_at),
        error_message = COALESCE(${metadata?.error_message ?? null}, error_message)
      WHERE download_export_id = ${exportId};
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update download export status', [
        'DownloadExportRepository->updateDownloadExportStatus',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Link a part-zip artifact to an export with `chunk_id = partIndex` (1..N).
   *
   * Idempotent — the export pipeline may retry a whole part after a transient
   * failure; a retried insert for the same `(download_export_id, artifact_id)`
   * is a silent no-op. `rowCount` 0 on conflict is a valid outcome and does NOT
   * throw, matching the `createDownloadArtifact` sibling pattern.
   */
  async createDownloadExportArtifact(exportId: string, artifactId: string, chunkId: number): Promise<void> {
    const sql = SQL`
      INSERT INTO download_export_artifact (download_export_id, artifact_id, chunk_id)
      VALUES (${exportId}, ${artifactId}, ${chunkId})
      ON CONFLICT (download_export_id, artifact_id) WHERE record_end_date IS NULL DO NOTHING;
    `;

    await this.connection.sql(sql);
  }

  /**
   * List an export's part-zip artifacts with their file metadata.
   *
   * JOIN to `artifact` surfaces `byte_size` + `object_key` so the service can
   * build the detail endpoint's `parts[]` shape in a single round-trip.
   * Ordered by `chunk_id` ASC — consumers render Part 1, Part 2, … in sequence.
   */
  async getDownloadExportArtifactsByExportId(exportId: string): Promise<DownloadExportArtifactWithFile[]> {
    const sql = SQL`
      SELECT
        dea.download_export_artifact_id,
        dea.download_export_id,
        dea.artifact_id,
        dea.chunk_id,
        a.byte_size,
        a.object_key
      FROM download_export_artifact dea
      INNER JOIN artifact a ON a.artifact_id = dea.artifact_id
      WHERE dea.download_export_id = ${exportId}
        AND dea.record_end_date IS NULL
      ORDER BY dea.chunk_id ASC;
    `;

    const response = await this.connection.sql(sql, DownloadExportArtifactWithFile);
    return response.rows;
  }
}
