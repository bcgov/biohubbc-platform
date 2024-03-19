import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { SECURITY_APPLIED_STATUS } from '../../../repositories/security-repository';
import { SubmissionService } from '../../../services/submission-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/submission');

export const GET: Operation = [getPublishedSubmissions()];

GET.apiDoc = {
  description: 'Get a list of published submissions',
  tags: ['submission', 'reviewed'],
  responses: {
    200: {
      description: 'List of published submissions',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              type: 'object',
              required: [
                'submission_id',
                'uuid',
                'security_review_timestamp',
                'publish_timestamp',
                'submitted_timestamp',
                'system_user_id',
                'source_system',
                'name',
                'description',
                'create_date',
                'create_user',
                'update_date',
                'update_user',
                'revision_count',
                'security',
                'root_feature_type_id',
                'root_feature_type_name',
                'root_feature_type_display_name'
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
                publish_timestamp: {
                  type: 'string',
                  nullable: true
                },
                submitted_timestamp: {
                  type: 'string'
                },
                system_user_id: {
                  type: 'integer',
                  minimum: 1
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
                    SECURITY_APPLIED_STATUS.SECURED,
                    SECURITY_APPLIED_STATUS.UNSECURED,
                    SECURITY_APPLIED_STATUS.PARTIALLY_SECURED,
                    SECURITY_APPLIED_STATUS.PENDING
                  ]
                },
                root_feature_type_id: {
                  type: 'integer',
                  minimum: 1
                },
                root_feature_type_name: {
                  type: 'string'
                },
                root_feature_type_display_name: {
                  type: 'string'
                }
              },
              additionalProperties: false
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get all published submissions.
 *
 * @returns {RequestHandler}
 */
export function getPublishedSubmissions(): RequestHandler {
  return async (_req, res) => {
    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const service = new SubmissionService(connection);
      const response = await service.getPublishedSubmissions();

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      await connection.rollback();
      defaultLog.error({ label: 'getPublishedSubmissions', message: 'error', error });
      throw error;
    } finally {
      connection.release();
    }
  };
}
