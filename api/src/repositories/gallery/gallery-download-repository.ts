import SQL from 'sql-template-strings';
import { DownloadDetailRecord } from '../../models/download';
import { BaseRepository } from '../base-repository';

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
   * Add a download to a gallery, idempotently.
   *
   * The `ON CONFLICT (gallery_id, download_id) WHERE record_end_date IS NULL
   * DO NOTHING` clause matches the `gallery_download_nuk1` partial unique index
   * and produces three outcomes:
   *   1. New membership → an active row is inserted.
   *   2. Already-active membership → silent no-op, so a gallery holds each
   *      download at most once.
   *   3. Previously-removed membership → the partial index ignores the inactive
   *      (soft-deleted) row, so a fresh active row is inserted while the old
   *      soft-deleted row remains as history.
   *
   * No rowCount guard: a conflict (rowCount=0) is a valid no-op, not a failure.
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
      VALUES (${galleryId}, ${downloadId}, ${sort})
      ON CONFLICT (gallery_id, download_id) WHERE record_end_date IS NULL DO NOTHING;
    `;

    await this.connection.sql(sql);
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
   * List a gallery's active download members with their policy display fields.
   *
   * Ordering is explicit `sort ASC NULLS LAST, create_date ASC`: positioned
   * items come first in ascending order; unsorted members (null `sort`) trail
   * the positioned ones, oldest-first. `NULLS LAST` is stated explicitly so the
   * placement of unsorted members can't silently flip if the sort direction ever
   * changes.
   *
   * Both the membership row (`gd`) and the download row (`d`) are filtered to
   * `record_end_date IS NULL`, so a soft-deleted download never leaks into a
   * public curated list even if its gallery_download link is still active.
   *
   * Materialization status/timing (`download_status`, `started_at`, `completed_at`)
   * and `download_version_id` live on `download_version`, not `download`. There is
   * no stored "current version" pointer, so they are resolved from the most-recent
   * active version via a `LATERAL` subquery (ordered `create_date DESC`, `LIMIT 1`) —
   * effectively inner, since a committed download always has ≥1 active version. This
   * mirrors `DownloadRepository.findDownloadById` so a gallery member carries the
   * same `DownloadDetailRecord` shape as a directly-fetched download.
   *
   * Returns flat rows — each download's `exports[]` is attached later at the
   * service layer so this method stays single-SQL CRUD.
   *
   * @param {number} galleryId - The gallery ID.
   * @return {Promise<DownloadDetailRecord[]>}
   * @memberof GalleryDownloadRepository
   */
  async getGalleryDownloads(galleryId: number): Promise<DownloadDetailRecord[]> {
    const sql = SQL`
      SELECT
        d.download_id,
        dv.download_version_id,
        dv.status AS download_status,
        d.format,
        d.metadata,
        dv.started_at,
        dv.completed_at,
        d.downloaded_at,
        d.create_date,
        p.name,
        p.description
      FROM gallery_download gd
      INNER JOIN download d ON d.download_id = gd.download_id
      INNER JOIN LATERAL (
        SELECT download_version_id, status, started_at, completed_at
        FROM download_version
        WHERE download_id = d.download_id AND record_end_date IS NULL
        ORDER BY create_date DESC, download_version_id DESC
        LIMIT 1
      ) dv ON true
      LEFT JOIN policy p ON p.policy_id = d.policy_id
      WHERE gd.gallery_id = ${galleryId}
        AND gd.record_end_date IS NULL
        AND d.record_end_date IS NULL
      ORDER BY gd.sort ASC NULLS LAST, gd.create_date ASC;
    `;

    const response = await this.connection.sql(sql, DownloadDetailRecord);

    return response.rows;
  }
}
