import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { ISearchSubmissionCriteria } from '../../../repositories/submission-repository';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../services/submission-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/submission/search');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
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
      name: 'keyword',
      schema: {
        type: 'string',
        nullable: true
      },
      allowEmptyValue: true
    },
    {
      in: 'query',
      name: 'spatial',
      schema: {
        type: 'string',
        nullable: true
      },
      allowEmptyValue: true
    }
  ],
  responses: {
    200: {
      description: 'Submission search response object.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              type: 'object',
              required: ['submission_id'],
              properties: {
                submission_id: {
                  type: 'integer',
                  minimum: 0
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
    const searchCriteria: ISearchSubmissionCriteria = req.query || {};

    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);

      const response = await submissionService.findSubmissionByCriteria(searchCriteria);

      await connection.commit();

      res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'searchSubmission', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
