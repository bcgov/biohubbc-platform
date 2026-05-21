import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { AccessKeyService } from '../../../services/access-key-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/api-key/{accessKeyId}');

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({ and: [{ discriminator: 'SystemUser' }] })),
  revokeAccessKey()
];

DELETE.apiDoc = {
  description:
    'Revoke an API key owned by the currently authenticated user. The key will immediately stop authorizing requests.',
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

/**
 * Revoke an API key owned by the current user.
 *
 * Owner-scoping is enforced in the service/repository layer so a user cannot revoke
 * keys belonging to other users.
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
