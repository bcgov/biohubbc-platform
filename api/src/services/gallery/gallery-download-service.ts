import { IDBConnection } from '../../database/db';
import { DownloadListRecord } from '../../models/download';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { DownloadVersionExportRepository } from '../../repositories/download/download-version-export-repository';
import { GalleryDownloadRepository } from '../../repositories/gallery/gallery-download-repository';
import { GalleryRepository } from '../../repositories/gallery/gallery-repository';
import { DBService } from '../db-service';
import { groupExportsByDownloadId } from '../download/download-service';

/**
 * Service for managing a gallery's download memberships (the `gallery_download`
 * join).
 *
 * Split out from `GalleryService` so that service can focus on gallery CRUD.
 * Orchestrates the gallery-download, gallery, download, and download-version-export
 * repositories: it owns the foreign-key business rules around membership and
 * assembles each gallery member's `exports[]` at read time.
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
  /**
   * Held directly (not via `DownloadVersionExportService`) because the only thing this
   * service needs is the batch `listExportsByDownloadVersionIds`, which lives on
   * the repository — there is no export-service method that exposes it, so the
   * repository is the lowest-coupling reach to assemble `exports[]`.
   */
  downloadExportRepository: DownloadVersionExportRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.galleryDownloadRepository = new GalleryDownloadRepository(connection);
    this.galleryRepository = new GalleryRepository(connection);
    this.downloadRepository = new DownloadRepository(connection);
    this.downloadExportRepository = new DownloadVersionExportRepository(connection);
  }

  /**
   * Add a download to a gallery, validating both ends before the write.
   *
   * The gallery is checked first (a missing gallery is a 404 from the get), then
   * the download: a well-formed but non-existent download id is rejected by
   * `getDownloadById`, which throws internally (404), so a curated list can only
   * reference real downloads rather than letting the foreign-key violation surface
   * as an opaque 500. The repository insert is idempotent, so re-adding an
   * already-present download is a silent no-op.
   *
   * @param {number} galleryId - The gallery ID.
   * @param {string} downloadId - The download ID to add.
   * @param {number | null} [sort] - Optional display order; an absent value sorts last.
   * @return {Promise<void>}
   * @throws {ApiNotFoundError} when no active gallery matches the given ID, or no
   * download matches the given download ID.
   * @memberof GalleryDownloadService
   */
  async addDownloadToGallery(galleryId: number, downloadId: string, sort?: number | null): Promise<void> {
    await this.galleryRepository.getGalleryById(galleryId);

    await this.downloadRepository.getDownloadById(downloadId);

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
   * List a gallery's active download members, each with its exports attached.
   *
   * A missing gallery is a 404 (the get guard); an existing gallery with no
   * active members is the empty list — an empty curated area is a valid state,
   * distinct from a gallery that does not exist, so the two must not collapse to
   * the same response. The empty-member short-circuit also skips the export
   * batch fetch when there is nothing to attach.
   *
   * `publicOnly` scopes the gallery-existence guard to public galleries, so an
   * anonymous read of a private gallery's contents is a 404 — the same way the
   * gallery itself is hidden — rather than leaking its members.
   *
   * Members come back as flat rows from the repository, each already carrying the
   * download's latest active `download_version_id`. Their `exports[]` are
   * batch-fetched in one query keyed by those exact version ids, so `exports[]`
   * reflects the displayed version: a download whose latest version is still
   * export-less (a fresh re-run) shows an empty `exports[]` rather than an older
   * version's files. Grouped by `download_id` in JS (reusing the download
   * service's grouping), so the repository stays single-SQL CRUD.
   *
   * @param {number} galleryId - The gallery ID.
   * @param {boolean} [publicOnly=false] - When true, only matches public galleries.
   * @return {Promise<DownloadListRecord[]>}
   * @throws {ApiNotFoundError} when no matching active gallery is found.
   * @memberof GalleryDownloadService
   */
  async getGalleryDownloads(galleryId: number, publicOnly = false): Promise<DownloadListRecord[]> {
    await this.galleryRepository.getGalleryById(galleryId, publicOnly);

    const members = await this.galleryDownloadRepository.getGalleryDownloads(galleryId);

    if (members.length === 0) {
      return [];
    }

    const exportRows = await this.downloadExportRepository.listExportsByDownloadVersionIds(
      members.map((member) => member.download_version_id)
    );

    const exportsByDownloadId = groupExportsByDownloadId(exportRows);

    return members.map((member) => ({
      ...member,
      exports: exportsByDownloadId.get(member.download_id) ?? []
    }));
  }
}
