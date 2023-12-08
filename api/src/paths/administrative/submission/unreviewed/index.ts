import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../../services/submission-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/submission/unreviewed');

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
  getUnreviewedSubmissions()
];

GET.apiDoc = {
  description: 'Get a list of submissions that need security review (are unreviewed).',
  tags: ['admin'],
  security: [
    {
      Bearer: []
    }
  ],
  responses: {
    200: {
      description: 'List of submissions that need security review.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                submission_id: {
                  type: 'integer',
                  minimum: 1
                },
                uuid: {
                  type: 'string',
                  format: 'uuid'
                },
                submission_feature_id: {
                  type: 'integer',
                  minimum: 1
                },
                create_date: {
                  type: 'string'
                },
                data: {
                  type: 'object',
                  properties: {}
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
 * Get all unreviewed submissions.
 *
 * @returns {RequestHandler}
 */
export function getUnreviewedSubmissions(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      await connection.commit();

      const service = new SubmissionService(connection);
      const response = await service.getUnreviewedSubmissions();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'getUnreviewedSubmissions', message: 'error', error });
      throw error;
    } finally {
      connection.release();
    }
  };
}
