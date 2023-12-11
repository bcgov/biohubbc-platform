import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { SubmissionService } from '../../../services/submission-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/submission/{submissionUUID}}');

export const GET: Operation = [getSubmissionInformation()];

GET.apiDoc = {
  description: 'retrieves submission data from the submission table',
  tags: ['eml'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  parameters: [
    {
      description: 'submission uuid',
      in: 'path',
      name: 'submissionUUID',
      schema: {
        type: 'string',
        format: 'uuid'
      },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'Dataset metadata response object.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['submission', 'features'],
            properties: {
              submission: {
                type: 'object',
                required: ['submission_id', 'uuid', 'security_review_timestamp'],
                properties: {
                  submission_id: {
                    type: 'number'
                  },
                  uuid: {
                    type: 'string',
                    format: 'uuid'
                  },
                  security_review_timestamp: {
                    type: 'string',
                    format: 'date-time',
                    nullable: true
                  }
                }
              },
              features: {
                required: ['dataset', 'sampleSites', 'animals', 'observations'],
                properties: {
                  dataset: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/feature'
                    }
                  },
                  sampleSites: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/feature'
                    }
                  },
                  animals: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/feature'
                    }
                  },
                  observations: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/feature'
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

/**
 * Retrieves submission data from the submission table.
 *
 * @returns {RequestHandler}
 */
export function getSubmissionInformation(): RequestHandler {
  return async (req, res) => {
    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    const submissionUUID = String(req.params.submissionUUID);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);

      const result = await submissionService.getSubmissionAndFeaturesBySubmissionUUID(submissionUUID);

      await connection.commit();

      res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionInformation', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
