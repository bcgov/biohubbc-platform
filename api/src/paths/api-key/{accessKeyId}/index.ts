import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { AccessKeyService } from '../../../services/access-key-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/api-key/{accessKeyId}');

export const PATCH: Operation = [
  authorizeRequestHandler(() => ({ and: [{ discriminator: 'SystemUser' }] })),
  revokeAccessKey()
];

PATCH.apiDoc = {
  description:
    'Revoke an API key owned by the currently authenticated user. The key will immediately stop authorizing requests and its expiry is set to now.',
  tags: ['api-key'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'accessKeyId',
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
  deleteAccessKey()
];

DELETE.apiDoc = {
  description:
    'Soft-delete an API key owned by the currently authenticated user. The key is immediately invalidated and hidden from the key list.',
  tags: ['api-key'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'accessKeyId',
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
export function revokeAccessKey(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const { accessKeyId } = req.params;

      const accessKeyService = new AccessKeyService(connection);
      await accessKeyService.revokeAccessKey(accessKeyId, systemUserId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'revokeAccessKey', message: 'error', error });
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
export function deleteAccessKey(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const { accessKeyId } = req.params;

      const accessKeyService = new AccessKeyService(connection);
      await accessKeyService.deleteAccessKey(accessKeyId, systemUserId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteAccessKey', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
