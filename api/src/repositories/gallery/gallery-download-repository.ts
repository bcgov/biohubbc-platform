import SQL from 'sql-template-strings';
import { z } from 'zod';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { CountResult } from '../../models/count';
import { DownloadDetailRecord } from '../../models/download';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { BaseRepository } from '../base-repository';

const GalleryDownloadExists = z.object({ exists: z.boolean() });

/**
 * A repository class for accessing the gallery↔download join (`gallery_download`).
 *
 * Split out from `GalleryRepository` so that repository can focus on CRUD for the
 * `gallery` table while this one owns the membership join and its read shape.
 *
 * @export
 * @class GalleryDownloadRepository
 * @extends {BaseRepository}
 */
export class GalleryDownloadRepository extends BaseRepository {
  /**
   * Check whether an active gallery/download membership already exists.
   *
   * @param {number} galleryId - The gallery ID.
   * @param {string} downloadId - The download ID.
   * @return {Promise<boolean>} True when an active membership exists.
   * @memberof GalleryDownloadRepository
   */
  async galleryDownloadExists(galleryId: number, downloadId: string): Promise<boolean> {
    const sql = SQL`
      SELECT EXISTS (
        SELECT 1
        FROM gallery_download
        WHERE gallery_id = ${galleryId}
          AND download_id = ${downloadId}
          AND record_end_date IS NULL
      ) AS exists;
    `;

    const response = await this.connection.sql(sql, GalleryDownloadExists);

    return response.rows[0]?.exists ?? false;
  }

  /**
   * Add a download to a gallery.
   *
   * @param {number} galleryId - The gallery ID.
   * @param {string} downloadId - The download ID.
   * @param {number | null} sort - Manual display order; null sorts last.
   * @return {Promise<void>}
   * @memberof GalleryDownloadRepository
   */
  async addDownloadToGallery(galleryId: number, downloadId: string, sort: number | null): Promise<void> {
    const sql = SQL`
      INSERT INTO gallery_download (gallery_id, download_id, sort)
      VALUES (${galleryId}, ${downloadId}, ${sort});
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert gallery download record', [
        'GalleryDownloadRepository->addDownloadToGallery',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Remove a download from a gallery, idempotently.
   *
   * Intentionally skips the rowCount guard: soft-delete is idempotent by design,
   * so removing an already-removed or never-present member is a no-op success,
   * not an error. (This deviates from guarded deletes elsewhere in the codebase;
   * the no-op-is-success contract here is deliberate.)
   *
   * @param {number} galleryId - The gallery ID.
   * @param {string} downloadId - The download ID.
   * @return {Promise<void>}
   * @memberof GalleryDownloadRepository
   */
  async removeDownloadFromGallery(galleryId: number, downloadId: string): Promise<void> {
    const sql = SQL`
      UPDATE gallery_download
      SET record_end_date = now()
      WHERE gallery_id = ${galleryId}
        AND download_id = ${downloadId}
        AND record_end_date IS NULL;
    `;

    await this.connection.sql(sql);
  }

  /**
   * List active gallery download records with their policy display fields.
   *
   * Ordering is explicit `sort ASC NULLS LAST, create_date ASC, gallery_download_id ASC`: positioned
   * items come first in ascending order; unsorted records (null `sort`) trail
   * the positioned ones, oldest-first. `gallery_download_id` is the deterministic
   * final tie-breaker for rows inserted in the same transaction, where `now()` can
   * give multiple rows the same `create_date`.
   *
   * Both the membership row (`gd`) and the download row (`d`) are filtered to
   * `record_end_date IS NULL`, so a soft-deleted download never leaks into a
   * curated list even if its gallery_download link is still active.
   *
   * Materialization status/timing (`download_status`, `started_at`, `completed_at`)
   * and `download_version_id` live on `download_version`, not `download`. There is
   * no stored "current version" pointer, so they are resolved from the most-recent
   * active version via a `LATERAL` subquery (ordered `create_date DESC`, `LIMIT 1`) —
   * effectively inner, since a committed download always has ≥1 active version. This
   * mirrors `DownloadRepository.findDownloadById` so a gallery download record
   * carries the same `DownloadDetailRecord` shape as a directly-fetched download.
   *
   * @param {number} galleryId - The gallery ID.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination/sort options.
   * @return {Promise<DownloadDetailRecord[]>}
   * @memberof GalleryDownloadRepository
   */
  async getGalleryDownloads(galleryId: number, pagination?: ApiPaginationOptions): Promise<DownloadDetailRecord[]> {
    const knex = getKnex();

    const query = knex
      .select([
        'd.download_id',
        'dv.download_version_id',
        'dv.status as download_status',
        'd.format',
        'd.metadata',
        'dv.started_at',
        'dv.completed_at',
        'd.downloaded_at',
        'd.create_date',
        'p.name',
        'p.description'
      ])
      .from('gallery_download as gd')
      .innerJoin('download as d', 'd.download_id', 'gd.download_id')
      .joinRaw(
        `INNER JOIN LATERAL (
          SELECT download_version_id, status, started_at, completed_at
          FROM download_version
          WHERE download_id = d.download_id AND record_end_date IS NULL
          ORDER BY create_date DESC, download_version_id DESC
          LIMIT 1
        ) dv ON true`
      )
      .leftJoin('policy as p', 'p.policy_id', 'd.policy_id')
      .where('gd.gallery_id', galleryId)
      .whereNull('gd.record_end_date')
      .whereNull('d.record_end_date');

    if (pagination) {
      this.applyPagination(query, pagination);
    }

    if (!pagination?.sort) {
      query.orderByRaw('gd.sort ASC NULLS LAST, gd.create_date ASC, gd.gallery_download_id ASC');
    }

    const response = await this.connection.knex(query, DownloadDetailRecord);

    return response.rows;
  }

  /**
   * Count active gallery download records.
   *
   * @param {number} galleryId - The gallery ID.
   * @return {Promise<number>}
   * @memberof GalleryDownloadRepository
   */
  async getGalleryDownloadsCount(galleryId: number): Promise<number> {
    const knex = getKnex();

    const query = knex
      .from('gallery_download as gd')
      .innerJoin('download as d', 'd.download_id', 'gd.download_id')
      .where('gd.gallery_id', galleryId)
      .whereNull('gd.record_end_date')
      .whereNull('d.record_end_date')
      .whereExists(function () {
        this.select(knex.raw('1'))
          .from('download_version as dv')
          .whereRaw('dv.download_id = d.download_id')
          .whereNull('dv.record_end_date');
      })
      .select(knex.raw('coalesce(count(*), 0)::integer as count'))
      .first();

    const response = await this.connection.knex(query, CountResult);

    return response.rows[0].count;
  }
}
