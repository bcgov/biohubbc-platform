import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { PROJECT_ROLE } from '../../constants/roles';
import { getDBConnection } from '../../database/db';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { getLogger } from '../../utils/logger';
import { SubmissionService } from '../../services/submission-service';

const defaultLog = getLogger('paths/dwc/search');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validSystemRoles: [PROJECT_ROLE.PROJECT_LEAD, PROJECT_ROLE.PROJECT_EDITOR],
          discriminator: 'SystemUser'
        }
      ]
    };
  }),
  searchSubmission()
];

GET.apiDoc = {
  description: 'searches submission files with elastic search',
  tags: ['elastic', 'search'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      description: 'submission search parameters.',
      in: 'query',
      name: 'terms',
      required: true,
      schema: {
        type: 'string'
      }
    }
  ],
  responses: {
    200: {
      description: 'Submission search response object.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              searchResponse: {
                type: 'array',
                items: {
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
    ...defaultErrorResponses
  }
};

export function searchSubmission(): RequestHandler {
  return async (req, res) => {
    const term = String(req.query.terms) || '';

    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);

      const response = await submissionService.searchSubmission(term.toLowerCase());

      await connection.commit();

      res.status(200).json({ searchResponse: response });
    } catch (error) {
      defaultLog.error({ label: 'searchSubmission', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
