import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { PROJECT_ROLE } from '../../constants/roles';
import { getDBConnection } from '../../database/db';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { SubmissionService } from '../../services/submission-service';
import { getLogger } from '../../utils/logger';
import { ESService } from '../../services/es-service';

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

/**
 * Get taxonomic search results.
 *
 * @returns {RequestHandler}
 */
export function searchInElasticSearch(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'getSearchResults', message: 'request params', req_params: req.query.terms });

    const terms = String(req.query.terms) || '';
    const indexName = String(req.query.index) || '';
    try {
      const elasticSearch = await new ESService().getEsClient();
      const response = await elasticSearch.search({
        index: indexName.toLowerCase(),
        query: {
          simple_query_string: {
            query: terms,
            fields: ['title', '*_name']
          }
        }
      });

      res.status(200).json({ searchResponse: response });
    } catch (error) {
      defaultLog.error({ label: 'getSearchResults', message: 'error', error });
      throw error;
    }
  };
}
