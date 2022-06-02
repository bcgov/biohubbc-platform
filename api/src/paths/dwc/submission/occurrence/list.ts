import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { OccurrenceService } from '../../../../services/occurrence-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/dwc/submission/occurrence/list');

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
  listOccurrences()
];

GET.apiDoc = {
  description: 'List all occurrences within map bounds',
  tags: ['occurrence'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'query',
      name: 'spatial',
      schema: {
        type: 'string',
        nullable: true
      },
      allowEmptyValue: true
    }
  ],
  responses: {
    200: {
      description: 'List of Map points with occurrence data',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              title: 'occurences by taxonid and gemetry',
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  minimum: 0
                },
                taxonid: {
                  type: 'string',
                  nullable: true
                },
                geometry: {
                  type: 'string',
                  nullable: true
                },
                observations: {
                  type: 'array',
                  items: {
                    title: 'occurences by eventdate',
                    type: 'object',
                    properties: {
                      eventdate: {
                        type: 'string',
                        nullable: true
                      },
                      data: {
                        type: 'array',
                        items: {
                          title: 'occurences by lifestage, sex, count',
                          type: 'object',
                          properties: {
                            lifestage: {
                              type: 'string',
                              nullable: true
                            },
                            vernacularname: {
                              type: 'string',
                              nullable: true
                            },
                            sex: {
                              type: 'string',
                              nullable: true
                            },
                            individualcount: {
                              type: 'string',
                              nullable: true
                            },
                            organismquantity: {
                              type: 'string',
                              nullable: true
                            },
                            organismquantitytype: {
                              type: 'string',
                              nullable: true
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
      }
    },
    ...defaultErrorResponses
  }
};

export function listOccurrences(): RequestHandler {
  return async (req, res) => {
    const searchCriteria: { spatial?: string } = req.query || {};

    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      const occurrenceService = new OccurrenceService(connection);

      const submissions = await occurrenceService.getMapOccurrences(searchCriteria.spatial);

      await connection.commit();

      res.status(200).json(submissions);
    } catch (error) {
      defaultLog.error({ label: 'listOccurrences', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
