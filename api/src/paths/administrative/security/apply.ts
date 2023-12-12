import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { SecurityService } from '../../../services/security-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/administrative/security');

export const POST: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
          discriminator: 'SystemRole'
        }
      ]
    };
  }),
  applySecurityRulesToSubmissionFeatures()
];

POST.apiDoc = {
  description: 'Apply Security to submission features',
  tags: ['security'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    description: 'Administrative Activity post request object.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            submissions: {
              type: 'array',
              items: {
                type: 'number'
              },
              minItems: 1
            },
            rules: {
              type: 'array',
              items: {
                type: 'number'
              },
              minItems: 1
            }
          }
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Features.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              submissions: {
                type: 'number'
              }
            }
          }
        }
      }
    },
    400: {
      $ref: '#/components/responses/400'
    },
    401: {
      $ref: '#/components/responses/401'
    },
    403: {
      $ref: '#/components/responses/403'
    },
    500: {
      $ref: '#/components/responses/500'
    },
    default: {
      $ref: '#/components/responses/default'
    }
  }
};

export function applySecurityRulesToSubmissionFeatures(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const service = new SecurityService(connection);

    try {
      await connection.open();

      const data = await service.applySecurityRulesToSubmissionFeatures(req.body.submissions, req.body.rules);

      await connection.commit();

      return res.status(200).json(data);
    } catch (error) {
      defaultLog.error({ label: 'applySecurityRulesToSubmissionFeatures', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
