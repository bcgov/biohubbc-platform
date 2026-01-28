import { IDBConnection } from '../database/db';
import { HTTP500 } from '../errors/http-error';
import { getLogger } from '../utils/logger';
import { DBService } from './db-service';

const defaultLog = getLogger('services/cart-download-service');

/**
 * Service for managing cart downloads.
 * Delegates all database operations to repositories/services where needed.
 */
export class CartDownloadService extends DBService {
  /**
   * Initializes the CartDownloadService with a database connection.
   *
   * @param {IDBConnection} connection - Database connection instance
   * @memberof CartDownloadService
   */
  constructor(connection: IDBConnection) {
    super(connection);
  }

  /**
   * Submits a download request for a cart.
   *
   * @param {string} cartId - The session ID of the cart
   * @param {string} systemUser - Email to send the download link to
   * @throws {HTTP500} Not implemented yet
   * @memberof CartDownloadService
   */
  async submitDownload(cartId: string, systemUser: string): Promise<void> {
    defaultLog.debug({ label: 'submitDownload', cartId, systemUser });

    // Placeholder implementation
    throw new HTTP500('Not Implemented');
  }
}
