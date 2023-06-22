import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SOURCE_SYSTEM } from '../../constants/database';
import { SYSTEM_ROLE } from '../../constants/roles';
import { getServiceAccountDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { ArtifactService } from '../../services/artifact-service';
import { getKeycloakSource } from '../../utils/keycloak-utils';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/artifact/delete');

export const POST: Operation = [
  authorizeRequestHandler(() => {
    return {
      or: [
        {
          validServiceClientIDs: [SOURCE_SYSTEM['SIMS-SVC-4464']],
          discriminator: 'ServiceClient'
        },
        {
          validSystemRoles: [SYSTEM_ROLE.DATA_ADMINISTRATOR, SYSTEM_ROLE.SYSTEM_ADMIN],
          discriminator: 'SystemRole'
        }
      ]
    };
  }),
  deleteArtifact()
];

POST.apiDoc = {
  description: 'Deletes an artifact.',
  tags: ['artifact'],
  requestBody: {
    content: {
      'application/json': {
        schema: {
          title: 'Artifacts to delete',
          type: 'object',
          required: ['artifactUUIDs'],
          properties: {
            uuids: {
              type: 'array',
              items: {
                type: 'string'
              },
              minLength: 1
            }
          }
        }
      }
    }
  },
  responses: {
    200: {
      description: '',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              searchResponse: {
                type: 'array',
                items: {
                  title: 'Species',
                  type: 'object',
                  required: ['id', 'label'],
                  properties: {
                    id: {
                      type: 'string'
                    },
                    label: {
                      type: 'string'
                    }
                  }
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
    500: {
      $ref: '#/components/responses/500'
    },
    default: {
      $ref: '#/components/responses/default'
    }
  }
};

/**
 * Get taxonomic search results.
 *
 * @returns {RequestHandler}
 */
export function deleteArtifact(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'deleteArtifact', message: 'request body', req_body: req.query });

    const sourceSystem = getKeycloakSource(req['keycloak_token']);
    if (!sourceSystem) {
      throw new HTTP400('Failed to identify known submission source system', [
        'token did not contain a clientId/azp or clientId/azp value is unknown'
      ]);
    }
    const connection = getServiceAccountDBConnection(sourceSystem);

    try {
      const service = new ArtifactService(connection);
      await service.deleteArtifacts(req.body.uuids);

      res.status(200);
    } catch (error) {
      defaultLog.error({ label: 'deleteArtifact', message: 'error', error });

      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
