import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../database/db';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { IPropertyFilter } from '../../repositories/search-index-respository';
import { SearchIndexService } from '../../services/search-index-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/search');

export const POST: Operation = [searchFeatures()];

POST.apiDoc = {
  description: 'Search for features by keywords and/or property filters.',
  tags: ['search'],
  requestBody: {
    description: 'Search parameters',
    required: false,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            keywords: {
              type: 'string',
              description: 'Space-separated keywords to search for in feature property values'
            },
            propertyFilters: {
              type: 'array',
              description: 'Filter by specific property name and value combinations',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['featureTypeName', 'propertyName', 'propertyType', 'value'],
                properties: {
                  featureTypeName: {
                    type: 'string',
                    description: 'The name of the feature type to filter on (e.g., dataset, observation)'
                  },
                  propertyName: {
                    type: 'string',
                    description: 'The name of the property to filter on'
                  },
                  propertyType: {
                    type: 'string',
                    enum: ['string', 'number', 'datetime'],
                    description: 'The type of the property (determines which search table to query)'
                  },
                  value: {
                    type: 'string',
                    description: 'The value to search for'
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Search results sorted by relevancy',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'submission_feature_id',
                'submission_id',
                'uuid',
                'feature_type_id',
                'feature_type_name',
                'submission_name',
                'is_secured',
                'relevancy_score'
              ],
              properties: {
                submission_feature_id: {
                  type: 'integer',
                  minimum: 1,
                  description: 'The ID of the submission feature'
                },
                submission_id: {
                  type: 'integer',
                  minimum: 1,
                  description: 'The ID of the submission containing this feature'
                },
                uuid: {
                  type: 'string',
                  format: 'uuid',
                  description: 'The unique identifier of the submission feature'
                },
                feature_type_id: {
                  type: 'integer',
                  minimum: 1,
                  description: 'The ID of the feature type'
                },
                feature_type_name: {
                  type: 'string',
                  description: 'The name of the feature type (e.g., dataset, observation)'
                },
                feature_name: {
                  type: 'string',
                  nullable: true,
                  description: 'The name of the feature from its data'
                },
                feature_description: {
                  type: 'string',
                  nullable: true,
                  description: 'The description of the feature from its data'
                },
                submission_name: {
                  type: 'string',
                  description: 'The name of the parent submission'
                },
                is_secured: {
                  type: 'boolean',
                  description: 'Whether the feature has active security rules applied'
                },
                relevancy_score: {
                  type: 'number',
                  description: 'The relevancy score for ranking results'
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
 * Search for features by keywords and/or property filters.
 *
 * @returns {RequestHandler}
 */
export function searchFeatures(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const keywords = req.body?.keywords as string | undefined;
      const propertyFilters = req.body?.propertyFilters as IPropertyFilter[] | undefined;

      const service = new SearchIndexService(connection);
      const response = await service.searchFeatures({ keywords, propertyFilters });

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'searchFeatures', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
