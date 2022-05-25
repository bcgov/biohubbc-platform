import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { ISubmissionModelWithStatus } from '../../../repositories/submission-repository';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../services/submission-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/dataset/create');

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
  listDataset()
];

GET.apiDoc = {
  description: 'List submitted Darwin Core Archive (DwCA) data packages.',
  tags: ['dwc'],
  security: [
    {
      Bearer: []
    }
  ],
  responses: {
    200: {
      description: 'Darwin Core data packages.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              title: 'Darwin Core Data Packages Response Object',
              type: 'object',
              properties: {
                submission_status: {
                  type: 'string',
                  nullable: true
                },
                source: {
                  type: 'string',
                  nullable: true
                },
                uuid: {
                  type: 'string'
                },
                event_timestamp: {
                  oneOf: [
                    {
                      type: 'string',
                      nullable: true
                    },
                    {
                      type: 'object'
                    }
                  ]
                },
                delete_timestamp: {
                  type: 'string',
                  nullable: true
                },
                input_key: {
                  type: 'string',
                  nullable: true
                },
                input_file_name: {
                  type: 'string',
                  nullable: true
                },
                eml_source: {
                  type: 'string',
                  nullable: true
                },
                darwin_core_source: {
                  oneOf: [
                    {
                      type: 'string',
                      nullable: true
                    },
                    {
                      type: 'object'
                    }
                  ]
                },
                created_date: {
                  oneOf: [
                    {
                      type: 'string',
                      nullable: true
                    },
                    {
                      type: 'object'
                    }
                  ]
                },
                created_user: {
                  type: 'number'
                },
                update_date: {
                  oneOf: [
                    {
                      type: 'string',
                      nullable: true
                    },
                    {
                      type: 'object'
                    }
                  ]
                },
                update_user: {
                  type: 'number',
                  nullable: true
                },
                revision_count: {
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

export function listDataset(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);

      const submissions: ISubmissionModelWithStatus[] = await submissionService.listSubmissionRecords();

      await connection.commit();

      res.status(200).json(submissions);
    } catch (error) {
      defaultLog.error({ label: 'listDataset', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
