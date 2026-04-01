import { IDBConnection } from '../../database/db';
import { DownloadExpressionRepository } from '../../repositories/download-expression-repository';
import { DBService } from '../db-service';

export class DownloadExpressionService extends DBService {
  downloadExpressionRepository: DownloadExpressionRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.downloadExpressionRepository = new DownloadExpressionRepository(connection);
  }

  /**
   * Repoint a download to the provided expression.
   *
   * @param {string} downloadId - Download identifier.
   * @param {string} expressionId - Expression identifier.
   * @return {Promise<void>}
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
