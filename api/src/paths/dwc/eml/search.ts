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
              required: ['id'],
              nullable: true,
              properties: {
                id: {
                  type: 'string'
                },
                source: {
                  type: 'object'
                },
                fields: {
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
    defaultLog.debug({
      label: 'getSearchResults',
      message: 'request params',
      terms: req.query.terms,
      index: req.query.index
    });

    const queryString = String(req.query.terms) || '*';
    const connection = getDBConnection(req['keycloak_token']);

    try {
      const elasticService = new ESService();
      await connection.open();

      const submissionService = new SubmissionService(connection);

      const response = await elasticService.keywordSearchEml(queryString);

      const promises = response.map(async (item) => {
        const observationCount = await submissionService.getObservationCountByDatasetId(item._id);

        console.log(typeof observationCount);
        console.log(isNaN(observationCount));

        return {
          id: item._id,
          fields: item.fields,
          source: item._source,
          observation_count: observationCount
        };
      });

      const result = await Promise.all(promises);

      console.log('search result is: ', result);

      res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'keywordSearchEml', message: 'error', error });
      throw error;
    }
  };
}
