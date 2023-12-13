import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { SecurityService } from '../../../services/security-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/administrative/security/apply');

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
  description:
    'Applies security rules to a list of submission features. A flag can also be passed to make application of security rules override existing ones or add new ones to the existing list of security rules per submission feature.',
  tags: ['security'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    description: 'Payload of submission features and rules to apply.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            override: {
              type: 'boolean',
              nullable: true
            },
            features: {
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
            type: 'array',
            items: {
              type: 'object',
              properties: {
                submission_feature_security_id: {
                  type: 'number'
                },
                submission_feature_id: {
                  type: 'number'
                },
                security_rule_id: {
                  type: 'number'
                }
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

      const data = await service.applySecurityRulesToSubmissionFeatures(req.body.features, req.body.rules);

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
