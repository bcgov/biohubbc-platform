import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SOURCE_SYSTEM } from '../../constants/database';
import { SYSTEM_ROLE } from '../../constants/roles';
import { getDBConnection, getServiceAccountDBConnection, IDBConnection } from '../../database/db';
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
          validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
          discriminator: 'SystemRole'
        },
        {
          validServiceClientIDs: [SOURCE_SYSTEM['SIMS-SVC-4464']],
          discriminator: 'ServiceClient'
        }
      ]
    };
  }),
  deleteArtifact()
];

POST.apiDoc = {
  description: 'Deletes artifacts.',
  tags: ['artifact'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: {
          title: 'Artifacts to delete',
          type: 'object',
          required: ['artifactUUIDs'],
          properties: {
            artifactUUIDs: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uuid'
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
      description: '',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['success'],
            properties: {
              success: {
                type: 'boolean',
                description: 'A boolean indicating if the delete action successfully completed.'
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
    let connection: IDBConnection;
    let success = true;
    const sourceSystem = getKeycloakSource(req['keycloak_token']);
    if (sourceSystem) {
      connection = getServiceAccountDBConnection(sourceSystem);
    } else {
      connection = getDBConnection(req['keycloak_token']);
    }

    try {
      await connection.open();
      const service = new ArtifactService(connection);

      await service.deleteArtifacts(req.body.artifactUUIDs);
    } catch (error) {
      defaultLog.error({ label: 'deleteArtifact', message: 'error', error });
      success = false;
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
      res.status(200).json({ success });
    }
  };
}
