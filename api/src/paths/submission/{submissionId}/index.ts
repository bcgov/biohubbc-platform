import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { SubmissionService } from '../../../services/submission-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/submission/{submissionId}');

export const GET: Operation = [getSubmissionInformation()];

GET.apiDoc = {
  description: 'Retrieves a submission record from the submission table',
  tags: ['eml'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  parameters: [
    {
      description: 'Submission ID.',
      in: 'path',
      name: 'submissionId',
      schema: {
        type: 'integer',
        minimum: 1
      },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'A submission record and all child submission feature records.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['submission', 'features'],
            properties: {
              submission: {
                type: 'object',
                required: [
                  'submission_id',
                  'uuid',
                  'security_review_timestamp',
                  'submitted_timestamp',
                  'source_system',
                  'name',
                  'description',
                  'create_date',
                  'create_user',
                  'update_date',
                  'update_user',
                  'revision_count'
                ],
                properties: {
                  submission_id: {
                    type: 'integer',
                    minimum: 1
                  },
                  uuid: {
                    type: 'string',
                    format: 'uuid'
                  },
                  security_review_timestamp: {
                    type: 'string',
                    nullable: true
                  },
                  source_system: {
                    type: 'string'
                  },
                  name: {
                    type: 'string',
                    maxLength: 200
                  },
                  description: {
                    type: 'string',
                    maxLength: 3000
                  },
                  create_date: {
                    type: 'string'
                  },
                  create_user: {
                    type: 'integer',
                    minimum: 1
                  },
                  update_date: {
                    type: 'string',
                    nullable: true
                  },
                  update_user: {
                    type: 'integer',
                    minimum: 1,
                    nullable: true
                  },
                  revision_count: {
                    type: 'integer',
                    minimum: 0
                  },
                  feature_type_id: {
                    type: 'integer',
                    minimum: 1
                  },
                  feature_type: {
                    type: 'string'
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
 * Retrieves a submission record and all child submission feature records.
 *
 * @returns {RequestHandler}
 */
export function getSubmissionInformation(): RequestHandler {
  return async (req, res) => {
    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    const submissionId = Number(req.params.submissionId);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);

      const result = await submissionService.getSubmissionAndFeaturesBySubmissionId(submissionId);

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
