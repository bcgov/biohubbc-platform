import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SOURCE_SYSTEM } from '../../constants/database';
import { SYSTEM_ROLE } from '../../constants/roles';
import { getDBConnection, getServiceAccountDBConnection } from '../../database/db';
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
  description:
    'Deletes artifacts. This will always return an object { success: boolean } to indicate if the deletion was successful or not.',
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
            type: 'boolean',
            description: 'A boolean indicating if the delete action was successful or not.'
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
 * Deletes artifacts for a given array of UUIDs.
 * This will always respond with a JSON object {success: boolean} indicating
 * if the artifacts have been successfully removed or not
 *
 * @returns {RequestHandler}
 */
export function deleteArtifact(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'deleteArtifact', message: 'request body', req_body: req.query });

    const sourceSystem = getKeycloakSource(req['keycloak_token']);
    const connection = sourceSystem
      ? getServiceAccountDBConnection(sourceSystem)
      : getDBConnection(req['keycloak_token']);

    try {
      await connection.open();
      const service = new ArtifactService(connection);

      await service.deleteArtifacts(req.body.artifactUUIDs);
      res.status(200).json(true);
    } catch (error: any) {
      defaultLog.error({ label: 'deleteArtifact', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
