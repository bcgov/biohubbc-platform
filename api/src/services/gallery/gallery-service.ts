import { IDBConnection } from '../../database/db';
import { HTTP400, HTTP409 } from '../../errors/http-error';
import {
  CreateGallery,
  CreateGalleryRequestBody,
  GalleryDownloadListRecord,
  GalleryRecord,
  UpdateGalleryRequestBody
} from '../../models/gallery';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { DownloadVersionExportRepository } from '../../repositories/download/download-version-export-repository';
import { GalleryRepository } from '../../repositories/gallery/gallery-repository';
import { DBService } from '../db-service';
import { groupExportsByDownloadId } from '../download/download-service';

/**
 * Service for managing galleries and their download memberships.
 *
 * Orchestrates the gallery, download, and download-version-export repositories: it owns
 * the name-uniqueness and foreign-key business rules around gallery membership,
 * and assembles each gallery member's `exports[]` at read time.
 *
 * @export
 * @class GalleryService
 * @extends {DBService}
 */
export class GalleryService extends DBService {
  galleryRepository: GalleryRepository;
  downloadRepository: DownloadRepository;
  /**
   * Held directly (not via `DownloadVersionExportService`) because the only thing this
   * service needs is the batch `listDownloadVersionExportsByDownloadIds`, which lives on
   * the repository — there is no export-service method that exposes it, so the
   * repository is the lowest-coupling reach to assemble `exports[]`.
   */
  downloadExportRepository: DownloadVersionExportRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.galleryRepository = new GalleryRepository(connection);
    this.downloadRepository = new DownloadRepository(connection);
    this.downloadExportRepository = new DownloadVersionExportRepository(connection);
  }

  /**
   * Create a gallery, rejecting a name already taken by another active gallery.
   *
   * A gallery name is unique only among active galleries — the partial unique
   * index is scoped to `record_end_date IS NULL`, so soft-deleting a gallery
   * frees its name for reuse. The active-name pre-check surfaces a clean 409
   * before the insert; without it a duplicate name would surface as a generic
   * 500 from the unique-index violation. The index remains the ultimate guard
   * against a concurrent racing insert (acceptable at admin-only concurrency).
   *
   * @param {CreateGalleryRequestBody} payload - The gallery to create; an absent
   * `description` is resolved to an explicit `null` before reaching the write layer.
   * @return {Promise<GalleryRecord>} The created gallery record.
   * @throws {HTTP409} when an active gallery already uses the given name.
   * @memberof GalleryService
   */
  async createGallery(payload: CreateGalleryRequestBody): Promise<GalleryRecord> {
    const existing = await this.galleryRepository.findActiveGalleryByName(payload.name);

    if (existing) {
      throw new HTTP409('A gallery with this name already exists');
    }

    const gallery: CreateGallery = { name: payload.name, description: payload.description ?? null };

    return this.galleryRepository.createGallery(gallery);
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
   * @throws {ApiNotFoundError} when no active gallery matches the given ID.
   * @memberof GalleryService
   */
  async getGalleryById(galleryId: number): Promise<GalleryRecord> {
    return this.galleryRepository.getGalleryById(galleryId);
  }

  /**
   * Update an active gallery's name and description.
   *
   * @param {number} galleryId - The gallery ID.
   * @param {UpdateGalleryRequestBody} payload - The new name and description; an
   * absent `description` is resolved to an explicit `null` before the write.
   * @return {Promise<GalleryRecord>} The updated gallery record.
   * @throws {ApiNotFoundError} when no active gallery matches the given ID.
   * @memberof GalleryService
   */
  async updateGallery(galleryId: number, payload: UpdateGalleryRequestBody): Promise<GalleryRecord> {
    const gallery: CreateGallery = { name: payload.name, description: payload.description ?? null };

    return this.galleryRepository.updateGallery(galleryId, gallery);
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
   * Add a download to a gallery, validating both ends before the write.
   *
   * The gallery is checked first (a missing gallery is a 404 from the get), then
   * the download: a well-formed but non-existent download id is rejected here as
   * a 400 so a curated list can only reference real downloads, rather than letting
   * the foreign-key violation surface as an opaque 500. The repository insert is
   * idempotent, so re-adding an already-present download is a silent no-op.
   *
   * @param {number} galleryId - The gallery ID.
   * @param {string} downloadId - The download ID to add.
   * @param {number | null} [sort] - Optional display order; an absent value sorts last.
   * @return {Promise<void>}
   * @throws {ApiNotFoundError} when no active gallery matches the given ID.
   * @throws {HTTP400} when no download matches the given download ID.
   * @memberof GalleryService
   */
  async addDownloadToGallery(galleryId: number, downloadId: string, sort?: number | null): Promise<void> {
    await this.galleryRepository.getGalleryById(galleryId);

    const download = await this.downloadRepository.findDownloadById(downloadId);

    if (!download) {
      throw new HTTP400('Download not found');
    }

    return this.galleryRepository.addDownloadToGallery(galleryId, downloadId, sort ?? null);
  }

  /**
   * Remove a download from a gallery.
   *
   * @param {number} galleryId - The gallery ID.
   * @param {string} downloadId - The download ID to remove.
   * @return {Promise<void>}
   * @memberof GalleryService
   */
  async removeDownloadFromGallery(galleryId: number, downloadId: string): Promise<void> {
    return this.galleryRepository.removeDownloadFromGallery(galleryId, downloadId);
  }

  /**
   * List a gallery's active download members, each with its exports attached.
   *
   * A missing gallery is a 404 (the get guard); an existing gallery with no
   * active members is the empty list — an empty curated area is a valid state,
   * distinct from a gallery that does not exist, so the two must not collapse to
   * the same response. The empty-member short-circuit also skips the export
   * batch fetch when there is nothing to attach.
   *
   * Members come back as flat rows from the repository; their `exports[]` are
   * batch-fetched in one query and grouped by `download_id` in JS (reusing the
   * download service's grouping), so the repository stays single-SQL CRUD.
   *
   * @param {number} galleryId - The gallery ID.
   * @return {Promise<GalleryDownloadListRecord[]>}
   * @throws {ApiNotFoundError} when no active gallery matches the given ID.
   * @memberof GalleryService
   */
  async getGalleryDownloads(galleryId: number): Promise<GalleryDownloadListRecord[]> {
    await this.galleryRepository.getGalleryById(galleryId);

    const members = await this.galleryRepository.getGalleryDownloads(galleryId);

    if (members.length === 0) {
      return [];
    }

    const exportRows = await this.downloadExportRepository.listDownloadVersionExportsByDownloadIds(
      members.map((member) => member.download_id)
    );

    const exportsByDownloadId = groupExportsByDownloadId(exportRows);

    return members.map((member) => ({
      ...member,
      exports: exportsByDownloadId.get(member.download_id) ?? []
    }));
  }
}
