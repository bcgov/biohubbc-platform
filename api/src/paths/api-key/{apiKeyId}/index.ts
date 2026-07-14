import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { ApiKeyService } from '../../../services/api-key-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/api-key/{apiKeyId}');

export const PATCH: Operation = [
  authorizeRequestHandler(() => ({ and: [{ discriminator: 'SystemUser' }] })),
  revokeApiKey()
];

PATCH.apiDoc = {
  description:
    'Revoke an API key owned by the currently authenticated user. The key will immediately stop authorizing requests and its expiry is set to now.',
  tags: ['api-key'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'apiKeyId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'The UUID of the API key to revoke.'
    }
  ],
  responses: {
    204: {
      description: 'API key revoked successfully.'
    },
    ...defaultErrorResponses
  }
};

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({ and: [{ discriminator: 'SystemUser' }] })),
  deleteApiKey()
];

DELETE.apiDoc = {
  description:
    'Soft-delete an API key owned by the currently authenticated user. The key is immediately invalidated and hidden from the key list.',
  tags: ['api-key'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'apiKeyId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'The UUID of the API key to delete.'
    }
  ],
  responses: {
    204: {
      description: 'API key deleted successfully.'
    },
    ...defaultErrorResponses
  }
};

/**
 * Revoke an API key owned by the current user.
 *
 * Sets `revoked_at` and `expires_at` to now. Owner-scoping is enforced in the
 * service/repository layer so a user cannot revoke keys belonging to other users.
 *
 * @return {RequestHandler}
 */
export function revokeApiKey(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const { apiKeyId } = req.params;

      const apiKeyService = new ApiKeyService(connection);
      await apiKeyService.revokeApiKey(apiKeyId, systemUserId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'revokeApiKey', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Soft-delete an API key owned by the current user.
 *
 * Sets `record_end_date`, `expires_at`, and (if not yet revoked) `revoked_at` to now.
 * Owner-scoping is enforced in the service/repository layer.
 *
 * @return {RequestHandler}
 */
export function deleteApiKey(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const { apiKeyId } = req.params;

      const apiKeyService = new ApiKeyService(connection);
      await apiKeyService.deleteApiKey(apiKeyId, systemUserId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteApiKey', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
