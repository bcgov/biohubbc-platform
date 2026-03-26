import { getAPIUserDBConnection, IDBConnection } from '../database/db';

/**
 * Run a callback within a dedicated database transaction.
 *
 * Acquires a connection from the pool, opens a transaction, executes the callback,
 * commits on success, rolls back on error, and always releases the connection.
 *
 * Job handlers use this to give each phase its own short-lived transaction —
 * completed phases survive retries, and connection hold time is bounded per phase.
 *
 * @param fn Async callback receiving the open connection
 * @returns The callback's return value
 */
export async function withConnection<T>(fn: (connection: IDBConnection) => Promise<T>): Promise<T> {
  const connection = getAPIUserDBConnection();

  try {
    await connection.open();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
