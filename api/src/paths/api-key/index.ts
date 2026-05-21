import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../database/db';
import { AccessKeyViewSchema, CreateAccessKeyResponseSchema } from '../../openapi/schemas/access-key';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { AccessKeyService } from '../../services/access-key-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/api-key');

export const GET: Operation = [
  authorizeRequestHandler(() => ({ and: [{ discriminator: 'SystemUser' }] })),
  listAccessKeys()
];

GET.apiDoc = {
  description: 'List all active API keys for the currently authenticated user. The key hash is never returned.',
  tags: ['api-key'],
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'List of access keys.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: AccessKeyViewSchema
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * List all active API keys for the current user.
 *
 * @return {RequestHandler}
 */
export function listAccessKeys(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const accessKeyService = new AccessKeyService(connection);
      const keys = await accessKeyService.listAccessKeys(systemUserId);

      await connection.commit();

      return res.status(200).json(keys);
    } catch (error) {
      defaultLog.error({ label: 'listAccessKeys', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const POST: Operation = [
  authorizeRequestHandler(() => ({ and: [{ discriminator: 'SystemUser' }] })),
  createAccessKey()
];

POST.apiDoc = {
  description:
    'Create a new API key for the currently authenticated user. The plaintext key is returned exactly once in the response and cannot be recovered.',
  tags: ['api-key'],
  security: [{ Bearer: [] }],
  requestBody: {
    description: 'API key creation request.',
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['name'],
          additionalProperties: false,
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 200,
              description: 'Human-readable label for the key (e.g. "My script key").'
            }
          }
        }
      }
    }
  },
  responses: {
    201: {
      description: 'API key created. The plaintext_key must be saved now — it will not be shown again.',
      content: {
        'application/json': {
          schema: CreateAccessKeyResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a new API key for the current user.
 *
 * @return {RequestHandler}
 */
export function createAccessKey(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const { name } = req.body as { name: string };

      const accessKeyService = new AccessKeyService(connection);
      const result = await accessKeyService.createAccessKey(systemUserId, name);

      await connection.commit();

      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'createAccessKey', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
