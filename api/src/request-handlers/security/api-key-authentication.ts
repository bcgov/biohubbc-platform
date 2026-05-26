import { Request } from 'express';
import { getAPIUserDBConnection } from '../../database/db';
import { HTTP401 } from '../../errors/http-error';
import { ApiKeyService } from '../../services/api-key-service';
import { UserService } from '../../services/user-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('request-handlers/security/api-key-authentication');

/**
 * Mutable dependency bag used by tests to avoid stubbing module namespace exports under ESM.
 */
export const apiKeyAuthenticationDependencies = {
  getAPIUserDBConnection
};

/**
 * Authenticate the request using a `X-API-Key` header value.
 *
 * On success:
 * - Populates `req.keycloak_token` with a synthetic token containing the owner's user_guid
 *   and identity_source so that downstream `getDBConnection()` can set the correct user context.
 * - Populates `req.system_user` with the owner's full system user record.
 * - Updates the key's `last_used_at` timestamp.
 *
 * On failure (missing header, unrecognised prefix, hash mismatch, expired, revoked, inactive user):
 * - Throws `HTTP401` with a generic 'Access Denied' message to avoid information leakage.
 *
 * @param {Request} req
 * @return {Promise<true>} Resolves with `true` when authentication succeeds.
 * @throws {HTTP401} if the key is missing, invalid, expired, revoked, or the owner is inactive.
 */
export const authenticateRequestApiKey = async (req: Request): Promise<true> => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || typeof apiKey !== 'string') {
    defaultLog.warn({ label: 'authenticateRequestApiKey', message: 'X-API-Key header missing or not a string' });
    throw new HTTP401('Access Denied');
  }

  const connection = apiKeyAuthenticationDependencies.getAPIUserDBConnection();

  try {
    await connection.open();

    const apiKeyService = new ApiKeyService(connection);
    const { api_key_id, system_user_id } = await apiKeyService.verifyApiKey(apiKey);

    const userService = new UserService(connection);
    const user = await userService.getUserById(system_user_id);

    if (!user || user.record_end_date) {
      defaultLog.warn({ label: 'authenticateRequestApiKey', message: 'User is inactive or not found', system_user_id });
      throw new HTTP401('Access Denied');
    }

    // Synthesise a minimal keycloak-shaped token so that getDBConnection() can resolve the user
    // context when processing the downstream request handler.
    req.keycloak_token = {
      preferred_username: `${user.user_guid}@${user.identity_source.toLowerCase()}`,
      identity_provider: user.identity_source.toLowerCase()
    };

    req.system_user = user;

    await apiKeyService.touchLastUsedAt(api_key_id);

    await connection.commit();

    return true;
  } catch (error) {
    defaultLog.warn({
      label: 'authenticateRequestApiKey',
      message: `authentication failed - ${(error as Error).message}`
    });
    await connection.rollback();
    throw new HTTP401('Access Denied');
  } finally {
    connection.release();
  }
};
