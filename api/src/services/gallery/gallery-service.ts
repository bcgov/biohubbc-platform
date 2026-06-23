import { IDBConnection } from '../../database/db';
import { HTTP409 } from '../../errors/http-error';
import { CreateGallery, CreateGalleryRequestBody, GalleryRecord, UpdateGalleryRequestBody } from '../../models/gallery';
import { GalleryRepository } from '../../repositories/gallery/gallery-repository';
import { DBService } from '../db-service';

/**
 * Service for managing galleries (the `gallery` table).
 *
 * Owns the slug-uniqueness business rule. The gallery↔download membership
 * concern lives in `GalleryDownloadService`, so this service stays focused on
 * gallery CRUD. `visibility` is metadata for advertising/readiness, not access
 * control.
 *
 * @export
 * @class GalleryService
 * @extends {DBService}
 */
export class GalleryService extends DBService {
  galleryRepository: GalleryRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.galleryRepository = new GalleryRepository(connection);
  }

  /**
   * Create a gallery, rejecting a slug already taken by another active gallery.
   *
   * A gallery slug is unique only among active galleries — the partial unique
   * index is scoped to `record_end_date IS NULL`, so soft-deleting a gallery
   * frees its slug for reuse. The active-slug pre-check surfaces a clean 409
   * before the insert; without it a duplicate slug would surface as a generic
   * 500 from the unique-index violation. The index remains the ultimate guard
   * against a concurrent racing insert (acceptable at admin-only concurrency).
   *
   * `visibility` defaults to `public` and `description` to `null` before reaching
   * the write layer, so the repository never has to decide what an absent field
   * means.
   *
   * @param {CreateGalleryRequestBody} payload - The gallery to create.
   * @return {Promise<GalleryRecord>} The created gallery record.
   * @throws {HTTP409} when an active gallery already uses the given slug.
   * @memberof GalleryService
   */
  async createGallery(payload: CreateGalleryRequestBody): Promise<GalleryRecord> {
    const existing = await this.galleryRepository.findActiveGalleryBySlug(payload.slug);

    if (existing) {
      throw new HTTP409('A gallery with this slug already exists');
    }

    return this.galleryRepository.createGallery(this.toCreateGallery(payload));
  }

  /**
   * List all active galleries.
   *
   * @return {Promise<GalleryRecord[]>}
   * @memberof GalleryService
   */
  async getGalleries(): Promise<GalleryRecord[]> {
    return this.galleryRepository.getGalleries();
  }

  /**
   * Get an active gallery by ID.
   *
   * @param {number} galleryId - The gallery ID.
   * @return {Promise<GalleryRecord>}
   * @throws {ApiNotFoundError} when no matching active gallery is found.
   * @memberof GalleryService
   */
  async getGalleryById(galleryId: number): Promise<GalleryRecord> {
    return this.galleryRepository.getGalleryById(galleryId);
  }

  /**
   * Update an active gallery's name, slug, visibility, and description.
   *
   * A slug change onto another active gallery's slug is rejected with a clean 409 via
   * the same active-slug pre-check that create uses, mirroring its semantics —
   * including the documented acceptance that a concurrent racing change is ultimately
   * guarded by the `gallery_nuk1` index. The `gallery_id` comparison lets a gallery
   * keep its own slug (e.g. a name-only edit) without tripping the check on itself.
   *
   * @param {number} galleryId - The gallery ID.
   * @param {UpdateGalleryRequestBody} payload - The new gallery fields.
   * @return {Promise<GalleryRecord>} The updated gallery record.
   * @throws {HTTP409} when another active gallery already uses the given slug.
   * @throws {ApiNotFoundError} when no active gallery matches the given ID.
   * @memberof GalleryService
   */
  async updateGallery(galleryId: number, payload: UpdateGalleryRequestBody): Promise<GalleryRecord> {
    const existing = await this.galleryRepository.findActiveGalleryBySlug(payload.slug);

    if (existing && existing.gallery_id !== galleryId) {
      throw new HTTP409('A gallery with this slug already exists');
    }

    return this.galleryRepository.updateGallery(galleryId, this.toCreateGallery(payload));
  }

  /**
   * Soft-delete a gallery.
   *
   * @param {number} galleryId - The gallery ID.
   * @return {Promise<void>}
   * @memberof GalleryService
   */
  async deleteGallery(galleryId: number): Promise<void> {
    return this.galleryRepository.deleteGallery(galleryId);
  }

  /**
   * Resolve a create/update request body to the repository write payload,
   * defaulting the optional `visibility` to `public` and `description` to `null`
   * so the write layer never has to decide what an absent field means.
   *
   * @param {CreateGalleryRequestBody} payload
   * @return {CreateGallery}
   * @memberof GalleryService
   */
  private toCreateGallery(payload: CreateGalleryRequestBody): CreateGallery {
    return {
      name: payload.name,
      slug: payload.slug,
      visibility: payload.visibility ?? 'public',
      description: payload.description ?? null
    };
  }
}
