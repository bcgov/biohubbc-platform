import { IDBConnection } from '../../database/db';
import {
  CreateDownload,
  DownloadFeatureSummary,
  DownloadId,
  DownloadListRecord,
  DownloadRecord
} from '../../models/download';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { DBService } from '../db-service';

/**
 * CRUD service for download records.
 *
 * Thin pass-through to DownloadRepository. Business logic and orchestration
 * live in DownloadPipelineService.
 *
 * @export
 * @class DownloadService
 * @extends {DBService}
 */
export class DownloadService extends DBService {
  downloadRepository: DownloadRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.downloadRepository = new DownloadRepository(connection);
  }

  /**
   * Create a new download record.
   *
   * @param {CreateDownload} payload - The download record to create.
   * @return {Promise<DownloadId>} The created record ID.
   * @memberof DownloadService
   */
  async createDownload(payload: CreateDownload): Promise<DownloadId> {
    return this.downloadRepository.createDownload(payload);
  }

  /**
   * Link submission features to a download record.
   *
   * @param {string} downloadId - The download ID.
   * @param {number[]} submissionFeatureIds - The submission feature IDs to include.
   * @return {Promise<void>}
   * @memberof DownloadService
   */
  async createDownloadFeatures(downloadId: string, submissionFeatureIds: number[]): Promise<void> {
    return this.downloadRepository.createDownloadFeatures(downloadId, submissionFeatureIds);
  }

  /**
   * Get a download record by ID.
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadRecord | null>}
   * @memberof DownloadService
   */
  async findDownloadById(downloadId: string): Promise<DownloadRecord | null> {
    return this.downloadRepository.findDownloadById(downloadId);
  }

  /**
   * Get paginated download records accessible to a user.
   *
   * @param {number} systemUserId - The user ID.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination/sort options.
   * @return {Promise<DownloadListRecord[]>}
   * @memberof DownloadService
   */
  async getDownloadsByTeamMembership(
    systemUserId: number,
    pagination?: ApiPaginationOptions
  ): Promise<DownloadListRecord[]> {
    return this.downloadRepository.getDownloadsByTeamMembership(systemUserId, pagination);
  }

  /**
   * Count download records accessible to a user.
   *
   * @param {number} systemUserId - The user ID.
   * @return {Promise<number>}
   * @memberof DownloadService
   */
  async getDownloadsByTeamMembershipCount(systemUserId: number): Promise<number> {
    return this.downloadRepository.getDownloadsByTeamMembershipCount(systemUserId);
  }

  /**
   * Get lightweight summaries for all authorized features in a download.
   *
   * @param {string} downloadId - The download ID.
   * @param {string | null} teamId - The team that owns the download. Null for anonymous downloads.
   * @return {Promise<DownloadFeatureSummary[]>}
   * @memberof DownloadService
   */
  async getDownloadFeatureSummaries(downloadId: string, teamId: string | null): Promise<DownloadFeatureSummary[]> {
    return this.downloadRepository.getDownloadFeatureSummaries(downloadId, teamId);
  }

  /**
   * Mark a download as downloaded after the client has retrieved all fragments.
   *
   * Sets `downloaded_at` timestamp and status to `downloaded` (AC #3).
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<void>}
   * @memberof DownloadService
   */
  async markDownloadAsDownloaded(downloadId: string): Promise<void> {
    await this.downloadRepository.markDownloadAsDownloaded(downloadId);
  }
}
