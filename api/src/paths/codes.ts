import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../database/db';
import { HTTP500 } from '../errors/http-error';
import { CodeService } from '../services/code-service';
import { getLogger } from '../utils/logger';

const defaultLog = getLogger('paths/code');

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
                      required: ['id', 'name'],
                      properties: {
                        id: {
                          type: 'number',
                          description: 'The code id.'
                        },
                        name: {
                          type: 'string',
                          description: 'The code name.'
                        }
                      }
                    },
                    feature_type_properties: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['id', 'name', 'display_name', 'type'],
                        properties: {
                          id: {
                            type: 'number',
                            description: 'The code id.'
                          },
                          name: {
                            type: 'string',
                            description: 'The code name.'
                          },
                          display_name: {
                            type: 'string',
                            description: 'The code display name.'
                          },
                          type: {
                            type: 'string',
                            description: 'The code type.'
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
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
      $ref: '#/components/responses/401'
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
  return async (req, res) => {
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
