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
                  required: ['feature_type', 'properties'],
                  properties: {
                    feature_type: {
                      type: 'object',
                      required: ['feature_type_id', 'name', 'display_name'],
                      properties: {
                        feature_type_id: {
                          type: 'integer',
                          description: 'The feature type id.',
                          minimum: 1
                        },
                        name: {
                          type: 'string',
                          description: 'The feature type name.',
                          example: 'dataset'
                        },
                        display_name: {
                          type: 'string',
                          description: 'The feature type display name.',
                          example: 'Dataset'
                        }
                      },
                      additionalProperties: false
                    },
                    properties: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: [
                          'feature_type_property_id',
                          'name',
                          'display_name',
                          'description',
                          'type_name',
                          'required_value',
                          'calculated_value',
                          'allow_multiple'
                        ],
                        properties: {
                          feature_type_property_id: {
                            type: 'integer',
                            description: 'The feature type property id.',
                            minimum: 1
                          },
                          name: {
                            type: 'string',
                            description: 'The feature property name.',
                            example: 'description'
                          },
                          display_name: {
                            type: 'string',
                            description: 'The feature property display name.',
                            example: 'Description'
                          },
                          description: {
                            type: 'string',
                            description: 'The feature property description.',
                            example: 'Description text'
                          },
                          type_name: {
                            type: 'string',
                            description: 'The feature property type name.',
                            example: 'string'
                          },
                          required_value: {
                            type: 'boolean',
                            description: 'Whether the property value is required.'
                          },
                          calculated_value: {
                            type: 'boolean',
                            description: 'Whether the property value is calculated.'
                          },
                          allow_multiple: {
                            type: 'boolean',
                            description: 'Whether the property value can be an array of its given type'
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
