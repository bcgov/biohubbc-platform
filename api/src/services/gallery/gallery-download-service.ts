import { IDBConnection } from '../../database/db';
import { HTTP409 } from '../../errors/http-error';
import { DownloadDetailRecord } from '../../models/download';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { GalleryDownloadRepository } from '../../repositories/gallery/gallery-download-repository';
import { GalleryRepository } from '../../repositories/gallery/gallery-repository';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { DBService } from '../db-service';

/**
 * Service for managing a gallery's download memberships (the `gallery_download`
 * join).
 *
 * Split out from `GalleryService` so that service can focus on gallery CRUD.
 * Orchestrates the gallery-download, gallery, and download repositories: it owns
 * the foreign-key business rules around membership.
 *
 * Adding a download to a gallery only surfaces it on the curated board — it does
 * not grant access to open or export the download. Download access stays governed
 * by `download_team`; nothing here touches that.
 *
 * @export
 * @class GalleryDownloadService
 * @extends {DBService}
 */
export class GalleryDownloadService extends DBService {
  galleryDownloadRepository: GalleryDownloadRepository;
  galleryRepository: GalleryRepository;
  downloadRepository: DownloadRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.galleryDownloadRepository = new GalleryDownloadRepository(connection);
    this.galleryRepository = new GalleryRepository(connection);
    this.downloadRepository = new DownloadRepository(connection);
  }

  /**
   * Add a download to a gallery, validating both ends before the write.
   *
   * The gallery is checked first (a missing gallery is a 404 from the get), then
   * the download: a well-formed but non-existent download id is rejected by
   * `getDownloadById`, which throws internally (404), so a curated list can only
   * reference real downloads rather than letting the foreign-key violation surface
   * as an opaque 500. An already-active gallery/download membership is rejected
   * with a conflict before insert.
   *
   * @param {number} galleryId - The gallery ID.
   * @param {string} downloadId - The download ID to add.
   * @param {number | null} [sort] - Optional display order; an absent value sorts last.
   * @return {Promise<void>}
   * @throws {ApiNotFoundError} when no active gallery matches the given ID, or no
   * download matches the given download ID.
   * @throws {HTTP409} when the download already exists in the gallery.
   * @memberof GalleryDownloadService
   */
  async addDownloadToGallery(galleryId: number, downloadId: string, sort?: number | null): Promise<void> {
    await this.galleryRepository.getGalleryById(galleryId);

    await this.downloadRepository.getDownloadById(downloadId);

    if (await this.galleryDownloadRepository.galleryDownloadExists(galleryId, downloadId)) {
      throw new HTTP409('Download already exists in this gallery');
    }

    return this.galleryDownloadRepository.addDownloadToGallery(galleryId, downloadId, sort ?? null);
  }

  /**
   * Remove a download from a gallery.
   *
   * @param {number} galleryId - The gallery ID.
   * @param {string} downloadId - The download ID to remove.
   * @return {Promise<void>}
   * @memberof GalleryDownloadService
   */
  async removeDownloadFromGallery(galleryId: number, downloadId: string): Promise<void> {
    return this.galleryDownloadRepository.removeDownloadFromGallery(galleryId, downloadId);
  }

  /**
   * List active gallery download records.
   *
   * A missing gallery is a 404 (the get guard); an existing gallery with no
   * active records is the empty list — an empty curated area is a valid state,
   * distinct from a gallery that does not exist, so the two must not collapse to
   * the same response.
   *
   * This checks gallery existence only. Download access remains governed by
   * `download_team` in the download service; gallery membership does not grant
   * permission to open or export a download.
   *
   * @param {number} galleryId - The gallery ID.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination/sort options.
   * @return {Promise<{ downloads: DownloadDetailRecord[]; count: number }>}
   * @throws {ApiNotFoundError} when no matching active gallery is found.
   * @memberof GalleryDownloadService
   */
  async getGalleryDownloads(
    galleryId: number,
    pagination?: ApiPaginationOptions
  ): Promise<{ downloads: DownloadDetailRecord[]; count: number }> {
    await this.galleryRepository.getGalleryById(galleryId);

    const [downloads, count] = await Promise.all([
      this.galleryDownloadRepository.getGalleryDownloads(galleryId, pagination),
      this.galleryDownloadRepository.getGalleryDownloadsCount(galleryId)
    ]);

    return { downloads, count };
  }
}
