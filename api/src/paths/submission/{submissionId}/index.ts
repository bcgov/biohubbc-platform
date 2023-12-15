import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { SECURITY_APPLIED_STATUS } from '../../../repositories/security-repository';
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
            required: ['submission', 'submissionFeatures'],
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
                  'revision_count',
                  'security'
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
                  security: {
                    type: 'string',
                    enum: [
                      SECURITY_APPLIED_STATUS.PENDING,
                      SECURITY_APPLIED_STATUS.UNSECURED,
                      SECURITY_APPLIED_STATUS.SECURED,
                      SECURITY_APPLIED_STATUS.PARTIALLY_SECURED
                    ]
                  }
                }
              },
              submissionFeatures: {
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
                          'submission_id',
                          'feature_type_id',
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
                          submission_id: {
                            type: 'integer',
                            minimum: 1
                          },
                          feature_type_id: {
                            type: 'integer',
                            minimum: 1
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
