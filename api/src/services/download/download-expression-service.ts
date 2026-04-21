import { IDBConnection } from '../../database/db';
import { DownloadExpressionRepository } from '../../repositories/download-expression-repository';
import { DBService } from '../db-service';

export class DownloadExpressionService extends DBService {
  downloadExpressionRepository: DownloadExpressionRepository;

  /**
   * Build a download-expression service bound to the current request DB connection.
   *
   * @param {IDBConnection} connection - Active database connection.
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.downloadExpressionRepository = new DownloadExpressionRepository(connection);
  }

  /**
   * Repoint a download to the provided expression.
   *
   * Behavior:
   * 1. Load active download->expression links.
   * 2. No-op when the download already points at the requested expression.
   * 3. Soft-delete existing active links when the target expression differs.
   * 4. Insert the new active link.
   *
   * @param {string} downloadId - Download identifier.
   * @param {string} expressionId - Expression identifier.
   * @return {Promise<void>} Resolves once the link points to `expressionId`.
   */
  async replaceDownloadExpression(downloadId: string, expressionId: string): Promise<void> {
    const existingLinks = await this.downloadExpressionRepository.getDownloadExpressionsByDownloadId(downloadId);
    const alreadyLinked = existingLinks.length === 1 && existingLinks[0].expression_id === expressionId;

    if (alreadyLinked) {
      return;
    }

    if (existingLinks.length > 0) {
      await this.downloadExpressionRepository.deleteDownloadExpressionsByDownloadId(downloadId);
    }

    await this.downloadExpressionRepository.insertDownloadExpression({
      download_id: downloadId,
      expression_id: expressionId
    });
  }
}
