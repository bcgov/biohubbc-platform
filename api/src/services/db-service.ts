import { IDBConnection } from '../database/db';

/**
 * Base class for services that require a database connection.
 *
 * @export
 * @class DBService
 */
export class DBService {
  connection: IDBConnection;

  /**
   * Construct a DBService.
   *
   * @param {IDBConnection} connection Active database connection.
   * @memberof DBService
   */
  constructor(connection: IDBConnection) {
    this.connection = connection;
  }

  /**
   * Process items in sequential chunks and flatten the callback results.
   *
   * This keeps external requests and bulk DB writes bounded without running many chunks concurrently.
   *
   * @template T Input item type.
   * @template U Output item type.
   * @param {T[]} items Items to process.
   * @param {number} size Maximum items per chunk.
   * @param {(chunk: T[]) => Promise<U[]>} callback Async processor for each chunk.
   * @param {number} delayMs Delay between chunks, in milliseconds.
   * @return {*}  {Promise<U[]>}
   * @memberof DBService
   */
  static async mapChunksSequential<T, U>(
    items: T[],
    size: number,
    callback: (chunk: T[]) => Promise<U[]>,
    delayMs = 0
  ): Promise<U[]> {
    if (!Number.isInteger(size) || size < 1) {
      throw new Error('Chunk size must be a positive integer.');
    }

    if (!Number.isFinite(delayMs) || delayMs < 0) {
      throw new Error('Chunk delay must be a non-negative finite number.');
    }

    const results: U[] = [];

    for (let index = 0; index < items.length; index += size) {
      const chunkResults = await callback(items.slice(index, index + size));
      results.push(...chunkResults);

      if (delayMs > 0 && index + size < items.length) {
        await DBService.delay(delayMs);
      }
    }

    return results;
  }

  /**
   * Sleep for the provided number of milliseconds.
   *
   * @param {number} milliseconds Duration to wait.
   * @return {*}  {Promise<void>}
   * @memberof DBService
   */
  static delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
