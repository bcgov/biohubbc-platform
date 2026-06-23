import SQL from 'sql-template-strings';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { CreateGallery, GalleryRecord } from '../../models/gallery';
import { BaseRepository } from '../base-repository';

/**
 * A repository class for accessing gallery data.
 *
 * Scoped to the `gallery` table itself — CRUD plus the slug-uniqueness lookup.
 * The gallery↔download join lives in `GalleryDownloadRepository`.
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
      INSERT INTO gallery (name, slug, visibility, description)
      VALUES (${payload.name}, ${payload.slug}, ${payload.visibility}, ${payload.description})
      RETURNING gallery_id, name, slug, visibility, description, create_date;
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
      SELECT gallery_id, name, slug, visibility, description, create_date
      FROM gallery
      WHERE record_end_date IS NULL
      ORDER BY name ASC;
    `;

    const response = await this.connection.sql(sql, GalleryRecord);

    return response.rows;
  }

  /**
   * Find the active gallery with the given slug, returning null when none exists.
   *
   * The slug-uniqueness pre-check helper: a gallery slug is unique only among
   * active galleries (the `gallery_nuk1` partial index is scoped to
   * `record_end_date IS NULL`), so soft-deleting a gallery frees its slug for
   * reuse. The service calls this to surface a 409 before attempting an insert
   * that would otherwise hit the partial unique index. A null result means the
   * slug is free, so this uses `find*` (returns null) rather than `get*` (throws).
   *
   * Slug — not name — is the stable consumer key: a gallery may be renamed
   * without breaking consumers, so uniqueness is enforced on slug.
   *
   * @param {string} slug - The gallery slug to look up.
   * @return {Promise<GalleryRecord | null>}
   * @memberof GalleryRepository
   */
  async findActiveGalleryBySlug(slug: string): Promise<GalleryRecord | null> {
    const sql = SQL`
      SELECT gallery_id, name, slug, visibility, description, create_date
      FROM gallery
      WHERE slug = ${slug} AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, GalleryRecord);

    return response.rows[0] ?? null;
  }

  /**
   * Find an active gallery by ID, returning null when none matches.
   *
   * @param {number} galleryId - The gallery ID.
   * @return {Promise<GalleryRecord | null>}
   * @memberof GalleryRepository
   */
  async findGalleryById(galleryId: number): Promise<GalleryRecord | null> {
    const sql = SQL`
      SELECT gallery_id, name, slug, visibility, description, create_date
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
   * @throws {ApiNotFoundError} when no matching active gallery is found.
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
   * Update an active gallery's name, slug, visibility, and description.
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
      SET name = ${payload.name},
          slug = ${payload.slug},
          visibility = ${payload.visibility},
          description = ${payload.description}
      WHERE gallery_id = ${galleryId} AND record_end_date IS NULL
      RETURNING gallery_id, name, slug, visibility, description, create_date;
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
}
