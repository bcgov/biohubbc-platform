import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../services/submission-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/administrative/review/list');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
          discriminator: 'SystemRole'
        }
      ]
    };
  }),
  getDatasetsForReview()
];

GET.apiDoc = {
  description: 'Get a list of datasets that need review.',
  tags: ['admin'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [],
  responses: {
    200: {
      description: 'List of datasets that need review.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                dataset_id: {
                  type: 'string',
                  description: 'UUID for a specific dataset'
                },
                artifacts_to_review: {
                  type: 'integer',
                  description: 'A count of the total files to review'
                },
                dataset_name: {
                  type: 'string',
                  description: 'Name of the project to review'
                },
                last_updated: {
                  type: 'string',
                  description: 'Last date a file was updated'
                },
                keywords: {
                  type: 'array',
                  items: {
                    type: 'string',
                    description: 'Keyword used for filtering datasets'
                  }
                }
              }
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get all administrative activities for the specified type, or all if no type is provided.
 *
 * @returns {RequestHandler}
 */
export function getDatasetsForReview(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      await connection.commit();

      const service = new SubmissionService(connection);
      const response = await service.getDatasetsForReview(['PROJECT']);

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'getDatasetsForReview', message: 'error', error });
      throw error;
    } finally {
      connection.release();
    }
  };
}
