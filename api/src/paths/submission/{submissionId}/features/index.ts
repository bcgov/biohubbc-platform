import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { SubmissionService } from '../../../../services/submission-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/submission/{submissionId}');

export const GET: Operation = [getSubmissionFeatures()];

GET.apiDoc = {
  description: 'Retrieves a submission record from the submission table',
  tags: ['submission'],
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
            type: 'array',
            items: {
              type: 'object',
              required: ['feature_type_name', 'feature_type_display_name', 'features'],
              properties: {
                feature_type_name: {
                  type: 'string'
                },
                feature_type_display_name: {
                  type: 'string'
                },
                features: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: [
                      'submission_feature_id',
                      'uuid',
                      'submission_id',
                      'feature_type_id',
                      'source_id',
                      'data',
                      'parent_submission_feature_id',
                      'record_effective_date',
                      'record_end_date',
                      'create_date',
                      'create_user',
                      'update_date',
                      'update_user',
                      'revision_count',
                      'feature_type_name',
                      'feature_type_display_name',
                      'submission_feature_security_ids'
                    ],
                    properties: {
                      submission_feature_id: {
                        type: 'integer',
                        minimum: 1
                      },
                      uuid: {
                        type: 'string',
                        format: 'uuid'
                      },
                      submission_id: {
                        type: 'integer',
                        minimum: 1
                      },
                      feature_type_id: {
                        type: 'integer',
                        minimum: 1
                      },
                      source_id: {
                        type: 'string',
                        maxLength: 200
                      },
                      data: {
                        type: 'object',
                        properties: {}
                      },
                      parent_submission_feature_id: {
                        type: 'integer',
                        minimum: 1,
                        nullable: true
                      },
                      record_effective_date: {
                        type: 'string'
                      },
                      record_end_date: {
                        type: 'string',
                        nullable: true
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
                      feature_type_name: {
                        type: 'string'
                      },
                      feature_type_display_name: {
                        type: 'string'
                      },
                      submission_feature_security_ids: {
                        type: 'array',
                        items: {
                          type: 'integer',
                          minimum: 1
                        }
                      }
                    },
                    additionalProperties: false
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
 * Retrieves all child submission feature records.
 *
 * @returns {RequestHandler}
 */
export function getSubmissionFeatures(): RequestHandler {
  return async (req, res) => {
    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    const submissionId = Number(req.params.submissionId);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);

      const result = await submissionService.getSubmissionFeaturesWithSearchKeyValuesBySubmissionId(submissionId);

      await connection.commit();

      res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionFeatures', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
