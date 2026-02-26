import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../database/db';
import { HTTP500 } from '../errors/http-error';
import { CodeService } from '../services/code-service';
import { getLogger } from '../utils/logger';

const defaultLog = getLogger('paths/codes');

export const GET: Operation = [getAllCodes()];

GET.apiDoc = {
  description: 'Get all Codes.',
  tags: ['code'],
  responses: {
    200: {
      description: 'Code response object.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['feature_type_with_properties'],
            properties: {
              feature_type_with_properties: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['feature_type', 'feature_type_properties'],
                  properties: {
                    feature_type: {
                      type: 'object',
                      required: ['feature_type_id', 'feature_type_name', 'feature_type_display_name'],
                      properties: {
                        feature_type_id: {
                          type: 'integer',
                          description: 'The feature type id.',
                          minimum: 1
                        },
                        feature_type_name: {
                          type: 'string',
                          description: 'The feature type name.',
                          example: 'dataset'
                        },
                        feature_type_display_name: {
                          type: 'string',
                          description: 'The feature type display name.',
                          example: 'Dataset'
                        }
                      },
                      additionalProperties: false
                    },
                    feature_type_properties: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: [
                          'feature_property_id',
                          'feature_property_name',
                          'feature_property_display_name',
                          'feature_property_type_id',
                          'feature_property_type_name'
                        ],
                        properties: {
                          feature_property_id: {
                            type: 'integer',
                            description: 'The feature property id.',
                            minimum: 1
                          },
                          feature_property_name: {
                            type: 'string',
                            description: 'The feature property name.',
                            example: 'description'
                          },
                          feature_property_display_name: {
                            type: 'string',
                            description: 'The feature property display name.',
                            example: 'Description'
                          },
                          feature_property_type_id: {
                            type: 'integer',
                            description: 'The feature property type id.',
                            minimum: 1
                          },
                          feature_property_type_name: {
                            type: 'string',
                            description: 'The feature property type name.',
                            example: 'string'
                          }
                        },
                        additionalProperties: false
                      }
                    }
                  },
                  additionalProperties: false
                }
              }
            },
            additionalProperties: false
          }
        }
      }
    },
    400: {
      $ref: '#/components/responses/400'
    },
    401: {
      $ref: '#/components/responses/401'
    },
    403: {
      $ref: '#/components/responses/403'
    },
    500: {
      $ref: '#/components/responses/500'
    },
    default: {
      $ref: '#/components/responses/default'
    }
  }
};

/**
 * Get all codes.
 *
 * @returns {RequestHandler}
 */
export function getAllCodes(): RequestHandler {
  return async (_, res) => {
    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const codeService = new CodeService(connection);

      const allCodeSets = await codeService.getAllCodeSets();

      await connection.commit();

      if (!allCodeSets) {
        throw new HTTP500('Failed to fetch codes');
      }

      return res.status(200).json(allCodeSets);
    } catch (error) {
      defaultLog.error({ label: 'getAllCodes', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
