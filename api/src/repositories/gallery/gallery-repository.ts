import SQL from 'sql-template-strings';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { DownloadDetailRecord } from '../../models/download';
import { CreateGallery, GalleryRecord } from '../../models/gallery';
import { BaseRepository } from '../base-repository';

/**
 * A repository class for accessing gallery data.
 *
 * @export
 * @class GalleryRepository
 * @extends {BaseRepository}
 */
export class GalleryRepository extends BaseRepository {
  /**
   * Create a new gallery record.
   *
   * `create_user` is not inserted — the audit trigger sets it from the connection's
   * user context.
   *
   * @param {CreateGallery} payload
   * @return {Promise<GalleryRecord>} The created gallery record.
   * @memberof GalleryRepository
   */
  async createGallery(payload: CreateGallery): Promise<GalleryRecord> {
    const sql = SQL`
      INSERT INTO gallery (name, description)
      VALUES (${payload.name}, ${payload.description})
      RETURNING gallery_id, name, description, create_date;
    `;

    const response = await this.connection.sql(sql, GalleryRecord);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert gallery record', [
        'GalleryRepository->createGallery',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * List all active galleries, ordered by name.
   *
   * @return {Promise<GalleryRecord[]>}
   * @memberof GalleryRepository
   */
  async getGalleries(): Promise<GalleryRecord[]> {
    const sql = SQL`
      SELECT gallery_id, name, description, create_date
      FROM gallery
      WHERE record_end_date IS NULL
      ORDER BY name ASC;
    `;

    const response = await this.connection.sql(sql, GalleryRecord);

    return response.rows;
  }

  /**
   * Find the active gallery with the given name, returning null when none exists.
   *
   * The name-uniqueness pre-check helper: a gallery name is unique only among
   * active galleries (the `gallery_nuk1` partial index is scoped to
   * `record_end_date IS NULL`), so soft-deleting a gallery frees its name for
   * reuse. The service calls this to surface a 409 before attempting an insert
   * that would otherwise hit the partial unique index. A null result means the
   * name is free, so this uses `find*` (returns null) rather than `get*` (throws).
   *
   * @param {string} name - The gallery name to look up.
   * @return {Promise<GalleryRecord | null>}
   * @memberof GalleryRepository
   */
  async findActiveGalleryByName(name: string): Promise<GalleryRecord | null> {
    const sql = SQL`
      SELECT gallery_id, name, description, create_date
      FROM gallery
      WHERE name = ${name} AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, GalleryRecord);

    return response.rows[0] ?? null;
  }

  /**
   * Get an active gallery by ID, returning null when none matches.
   *
   * @param {number} galleryId - The gallery ID.
   * @return {Promise<GalleryRecord | null>}
   * @memberof GalleryRepository
   */
  async findGalleryById(galleryId: number): Promise<GalleryRecord | null> {
    const sql = SQL`
      SELECT gallery_id, name, description, create_date
      FROM gallery
      WHERE gallery_id = ${galleryId} AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, GalleryRecord);

    return response.rows[0] ?? null;
  }

  /**
   * Get an active gallery by ID, throwing if not found.
   *
   * `get*` throws on missing row (codebase convention — companion to `findGalleryById`).
   *
   * @param {number} galleryId - The gallery ID.
   * @return {Promise<GalleryRecord>}
   * @throws {ApiNotFoundError} when no active gallery matches the given ID.
   * @memberof GalleryRepository
   */
  async getGalleryById(galleryId: number): Promise<GalleryRecord> {
    const gallery = await this.findGalleryById(galleryId);

    if (!gallery) {
      throw new ApiNotFoundError('Gallery not found', [
        'GalleryRepository->getGalleryById',
        `no gallery with id ${galleryId}`
      ]);
    }

    return gallery;
  }

  /**
   * Update an active gallery's name and description.
   *
   * Throws `ApiNotFoundError` (not `ApiExecuteSQLError`) when no row is updated.
   * The `AND record_end_date IS NULL` scope means a zero-row result is not an
   * unexpected SQL fault but the legitimate "no active row matched" condition —
   * the gallery is missing or has been soft-deleted — which is a 404, not a 500.
   *
   * @param {number} galleryId - The gallery ID.
   * @param {CreateGallery} payload
   * @return {Promise<GalleryRecord>} The updated gallery record.
   * @throws {ApiNotFoundError} when no active gallery matches the given ID.
   * @memberof GalleryRepository
   */
  async updateGallery(galleryId: number, payload: CreateGallery): Promise<GalleryRecord> {
    const sql = SQL`
      UPDATE gallery
      SET name = ${payload.name}, description = ${payload.description}
      WHERE gallery_id = ${galleryId} AND record_end_date IS NULL
      RETURNING gallery_id, name, description, create_date;
    `;

    const response = await this.connection.sql(sql, GalleryRecord);

    if (response.rowCount !== 1) {
      throw new ApiNotFoundError('Gallery not found', [
        'GalleryRepository->updateGallery',
        `no active gallery with id ${galleryId}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Soft-delete a gallery by stamping its `record_end_date`.
   *
   * Intentionally skips the rowCount guard: soft-delete is idempotent by design,
   * so deleting an already-deleted or never-existed gallery is a no-op success,
   * not an error. (This deviates from guarded deletes elsewhere in the codebase;
   * the no-op-is-success contract here is deliberate.)
   *
   * @param {number} galleryId - The gallery ID.
   * @return {Promise<void>}
   * @memberof GalleryRepository
   */
  async deleteGallery(galleryId: number): Promise<void> {
    const sql = SQL`
      UPDATE gallery
      SET record_end_date = now()
      WHERE gallery_id = ${galleryId} AND record_end_date IS NULL;
    `;

    await this.connection.sql(sql);
  }

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
   * @memberof GalleryRepository
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
   * @memberof GalleryRepository
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
   * Returns flat rows — each download's `exports[]` is attached later at the
   * service layer so this method stays single-SQL CRUD.
   *
   * @param {number} galleryId - The gallery ID.
   * @return {Promise<DownloadDetailRecord[]>}
   * @memberof GalleryRepository
   */
  async getGalleryDownloads(galleryId: number): Promise<DownloadDetailRecord[]> {
    const sql = SQL`
      SELECT d.download_id, d.download_status, d.format, d.metadata, d.started_at,
             d.completed_at, d.downloaded_at, d.create_date, p.name, p.description
      FROM gallery_download gd
      INNER JOIN download d ON d.download_id = gd.download_id
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
