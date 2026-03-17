import { IDBConnection } from '../../database/db';
import { DownloadFragmentRecord } from '../../models/download-fragment';
import { DownloadFragmentRepository } from '../../repositories/download/download-fragment-repository';
import { DBService } from '../db-service';

/**
 * CRUD service for download fragment records.
 *
 * Thin pass-through to DownloadFragmentRepository. Orchestration and
 * fragment processing live in DownloadPipelineService.
 *
 * @export
 * @class DownloadFragmentService
 * @extends {DBService}
 */
export class DownloadFragmentService extends DBService {
  fragmentRepository: DownloadFragmentRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.fragmentRepository = new DownloadFragmentRepository(connection);
  }

  /**
   * Get all fragments for a download.
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadFragmentRecord[]>}
   * @memberof DownloadFragmentService
   */
  async getFragmentsByDownloadId(downloadId: string): Promise<DownloadFragmentRecord[]> {
    return this.fragmentRepository.getFragmentsByDownloadId(downloadId);
  }
}
