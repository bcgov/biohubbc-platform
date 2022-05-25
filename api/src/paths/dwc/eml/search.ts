import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { getLogger } from '../../../utils/logger';
import { ESService } from '../../../services/es-service';

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
            type: 'array',
            items: {
              type: 'object'
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get taxonomic search results.
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

    const terms = String(req.query.terms) || '';
    const indexName = String(req.query.index) || '';

    try {
      const elasticSearch = await new ESService().getEsClient();

      const response = await elasticSearch.search({
        index: indexName.toLowerCase(),
        query: {
          match: {
            'projects.projectName': terms
          }
        },
        fields: ['*']
      });

      const result =
        (response &&
          response.hits.hits.map((item) => {
            return {
              id: item._id,
              source: item._source,
              fields: item.fields
            };
          })) ||
        [];

      res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getSearchResults', message: 'error', error });
      throw error;
    }
  };
}
