import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { ESService } from '../../../services/es-service';
import { SubmissionService } from '../../../services/submission-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/eml/search');

export const GET: Operation = [searchInElasticSearch()];

GET.apiDoc = {
  description: 'searches submission files with elastic search',
  tags: ['eml', 'search'],
  security: [
    {
      OptionalBearer: []
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

    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    try {
      await connection.open();

      const elasticService = new ESService();

      const submissionService = new SubmissionService(connection);

      const responseFromES = await elasticService.keywordSearchEml(queryString);

      const datasetIdsFromES = responseFromES.map((item) => item._id);

      const result = await submissionService.findSubmissionRecordsWithSpatialCount(datasetIdsFromES);

      // Remove null items, which indicates the provided elastic search dataset id had no matching database record.
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
