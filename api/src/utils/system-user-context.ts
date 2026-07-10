import { IDBConnection } from '../database/db';
import { UserService } from '../services/user-service';

/**
 * Return the connection's active system user id, or null when the context belongs to an inactive/unknown user.
 *
 * Optional-auth endpoints use this when an authenticated request should gracefully degrade to anonymous access instead
 * of treating any resolvable database context as an active security principal.
 *
 * @param {IDBConnection} connection
 * @return {*}  {Promise<number | null>}
 */
export const getActiveSystemUserId = async (connection: IDBConnection): Promise<number | null> => {
  const systemUserId = connection.systemUserId();

  if (!systemUserId) {
    return null;
  }

  try {
    await new UserService(connection).getUserById(systemUserId);
    return systemUserId;
  } catch {
    return null;
  }
};
