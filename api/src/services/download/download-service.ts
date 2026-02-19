import { IDBConnection } from '../../database/db';
import { DownloadFeatureSummary, DownloadId, DownloadRecord } from '../../models/download';
import { DownloadRepository } from '../../repositories/download/download-repository';
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
   * @param {string | null} teamId - The team that owns this download. Null for anonymous downloads.
   * @param {string | null} dataRequestId - The data request that originated this download. Null for non-request downloads.
   * @param {number} [fragmentSizeBytes] - Target fragment size in bytes.
   * @param {number | null} [systemUserId] - The user who created this download. Null for anonymous downloads.
   * @return {Promise<DownloadId>} The created record ID.
   * @memberof DownloadService
   */
  async createDownload(
    teamId: string | null,
    dataRequestId: string | null,
    fragmentSizeBytes?: number,
    systemUserId?: number | null
  ): Promise<DownloadId> {
    return this.downloadRepository.createDownload(teamId, dataRequestId, fragmentSizeBytes, systemUserId);
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
   * Get all download records accessible to a user.
   *
   * @param {number} systemUserId - The user ID.
   * @return {Promise<DownloadRecord[]>}
   * @memberof DownloadService
   */
  async getDownloadsByTeamMembership(systemUserId: number): Promise<DownloadRecord[]> {
    return this.downloadRepository.getDownloadsByTeamMembership(systemUserId);
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
