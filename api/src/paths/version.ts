import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { KeycloakService } from '../services/keycloak-service';

export const GET: Operation = [getVersionInformation()];

GET.apiDoc = {
  description: 'Get API information',
  tags: ['misc'],
  responses: {
    200: {
      description: 'API information',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              version: {
                description: 'API Version',
                type: 'string'
              },
              environment: {
                description: 'API Environment',
                type: 'string'
              },
              timezone: {
                description: 'API Timezone',
                type: 'string'
              }
            }
          }
        }
      }
    },
    default: {
      $ref: '#/components/responses/default'
    }
  }
};

/**
 * Get api version information.
 *
 * @returns {RequestHandler}
 */
export function getVersionInformation(): RequestHandler {
  return async (req, res) => {
    const keycloakService = new KeycloakService();

    const response = await keycloakService.getUserByUsername('c13ed91ba1fa4d8faac95ca0e4dc73f3@bceidbusiness');

    console.log('======================================');
    console.log(JSON.stringify(response));

    const versionInfo = {
      version: process.env.VERSION,
      environment: process.env.NODE_ENV,
      timezone: process.env.TZ
    };

    res.status(200).json(versionInfo);
  };
}
