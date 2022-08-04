import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { ESService } from '../../../services/es-service';
import { SubmissionService } from '../../../services/submission-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/eml/search');

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
  searchInElasticSearch()
];

GET.apiDoc = {
  description: 'searches submission files with elastic search',
  tags: ['search'],
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
      required: false,
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
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'source', 'observation_count'],
              properties: {
                id: {
                  type: 'string'
                },
                source: {
                  type: 'object'
                },
                observation_count: {
                  type: 'number'
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
 * Search for meta data in Elastic Search.
 *
 * @returns {RequestHandler}
 */
export function searchInElasticSearch(): RequestHandler {
  return async (req, res) => {
    const queryString = String(req.query.terms) || '*';

    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      const elasticService = new ESService();

      const submissionService = new SubmissionService(connection);

      const responseFromES = await elasticService.keywordSearchEml(queryString);

      const datasetIdsFromES = responseFromES.map((item) => item._id);

      const submissionRecordWithSpatialCount = await submissionService.getSubmissionRecordsWithSpatialCount(
        datasetIdsFromES
      );

      const result = await Promise.all(submissionRecordWithSpatialCount);

      // Remove items returned from the DB that are undefined
      const filteredResult = result.filter((item: any) => !!item);

      await connection.commit();

      res.status(200).json(filteredResult);
    } catch (error) {
      defaultLog.error({ label: 'keywordSearchEml', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
