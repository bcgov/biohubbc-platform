import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { ESService } from '../../../../services/es-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/dwc/eml/get');

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
  getMetadataByDatasetId()
];

GET.apiDoc = {
  description: 'retrieves dataset metadata within elastic search',
  tags: ['eml'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      description: 'dataset Id.',
      in: 'query',
      name: 'dataset_id',
      required: false,
      schema: {
        type: 'string'
      }
    }
  ],
  responses: {
    200: {
      description: 'Dataset metadata response object.',
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
 * Retreives dataset metadata from Elastic Search.
 *
 * @returns {RequestHandler}
 */
export function getMetadataByDatasetId(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({
      label: 'getSearchResults',
      message: 'request params',
      terms: req.query.terms,
      index: req.query.index
    });

    const queryString = String(req.query.terms) || '*';

    try {
      const elasticService = new ESService();

      const response = await elasticService.DatasetSearchEml(queryString);

      console.log('response: ', response);

      const result = response.map((item) => {
        return {
          id: item._id,
          fields: item.fields,
          source: item._source
        };
      });

      res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getMetadataByDatasetId', message: 'error', error });
      throw error;
    }
  };
}
