import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../database/db';
import { ApiKeyViewSchema, CreateApiKeyResponseSchema } from '../../openapi/schemas/api-key';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { ApiKeyService } from '../../services/api-key-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/api-key');

export const GET: Operation = [
  authorizeRequestHandler(() => ({ and: [{ discriminator: 'SystemUser' }] })),
  listApiKeys()
];

GET.apiDoc = {
  description: 'List all active API keys for the currently authenticated user.',
  tags: ['api-key'],
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'List of API keys.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: ApiKeyViewSchema
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
export function listApiKeys(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const apiKeyService = new ApiKeyService(connection);
      const keys = await apiKeyService.listApiKeys(systemUserId);

      await connection.commit();

      return res.status(200).json(keys);
    } catch (error) {
      defaultLog.error({ label: 'listApiKeys', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const POST: Operation = [
  authorizeRequestHandler(() => ({ and: [{ discriminator: 'SystemUser' }] })),
  createApiKey()
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
          schema: CreateApiKeyResponseSchema
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
export function createApiKey(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const { name } = req.body as { name: string };

      const apiKeyService = new ApiKeyService(connection);
      const result = await apiKeyService.createApiKey(systemUserId, name);

      await connection.commit();

      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'createApiKey', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
