import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../constants/roles';
import { getDBConnection, getServiceAccountDBConnection } from '../../database/db';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { ArtifactService } from '../../services/artifact-service';
import { getServiceClientSystemUser } from '../../utils/keycloak-utils';
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
          discriminator: 'ServiceClient'
        }
      ]
    };
  }),
  deleteArtifact()
];

POST.apiDoc = {
  description: 'Deletes artifacts for a given list of UUIDs.',
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

    const serviceClientUser = getServiceClientSystemUser(req['keycloak_token']);

    const connection = serviceClientUser
      ? getServiceAccountDBConnection(serviceClientUser)
      : getDBConnection(req['keycloak_token']);

    try {
      await connection.open();
      const service = new ArtifactService(connection);

      await service.deleteArtifacts(req.body.artifactUUIDs);
      res.status(200).json(true);
      await connection.commit();
    } catch (error: any) {
      defaultLog.error({ label: 'deleteArtifact', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
