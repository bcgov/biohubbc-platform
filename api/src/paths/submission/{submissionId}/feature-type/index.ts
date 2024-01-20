import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { SubmissionService } from '../../../../services/submission-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/submission/{submissionId}');

export const GET: Operation = [getSubmissionFeatureTypes()];

GET.apiDoc = {
  description: 'Retrieves a sorted and distinct array of feature type records for a submission.',
  tags: ['submission'],
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
      description: 'A sorted and distinct array of feature type records.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              type: 'object',
              required: ['features_types'],
              properties: {
                features_types: {
                  description: 'A sorted and distinct array of feature type records.',
                  type: 'array',
                  items: {
                    type: 'object',
                    required: [
                      'feature_type_id',
                      'name',
                      'display_name',
                      'description',
                      'record_effective_date',
                      'record_end_date',
                      'create_date',
                      'create_user',
                      'update_date',
                      'update_user',
                      'revision_count'
                    ],
                    properties: {
                      feature_type_id: {
                        type: 'integer',
                        minimum: 1
                      },
                      name: {
                        type: 'string',
                        maxLength: 100
                      },
                      display_name: {
                        type: 'string',
                        maxLength: 100
                      },
                      description: {
                        type: 'string',
                        nullable: true,
                        maxLength: 500
                      },
                      sort: {
                        type: 'number',
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
 * Retrieves a sorted and distinct list of all feature type records for a submission.
 *
 * @export
 * @return {*}  {RequestHandler}
 */
export function getSubmissionFeatureTypes(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();

    const submissionId = Number(req.params.submissionId);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);

      const featureTypes = await submissionService.getSubmissionFeatureTypes(submissionId);

      await connection.commit();

      res.status(200).json({ feature_types: featureTypes });
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionFeatures', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
