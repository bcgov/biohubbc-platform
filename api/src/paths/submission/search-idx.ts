import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../database/db';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { SearchIndexService } from '../../services/search-index-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/dataset/search-index');

export const POST: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'ServiceClient'
        }
      ]
    };
  }),
  indexSubmission()
];

POST.apiDoc = {
  description: 'Index dataset in BioHub',
  tags: ['dataset'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      description: 'Submission ID',
      in: 'query',
      name: 'submissionId',
      schema: {
        type: 'integer',
        minimum: 1
      },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'TODO', // TODO
      content: {
        'application/json': {
          schema: {
            // TODO
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function indexSubmission(): RequestHandler {
  return async (req, res) => {
    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    const submissionId = Number(req.query.submissionId);

    try {
      await connection.open();

      const searchIndexService = new SearchIndexService(connection);

      // Index the submission record
      const response = await searchIndexService.indexFeaturesBySubmissionId(submissionId);

      await connection.commit();
      res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'datasetIntake', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
