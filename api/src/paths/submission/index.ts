import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../database/db';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { SubmissionService } from '../../services/submission-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/submission');

export const GET: Operation = [getReviewedSubmissionsWithSecurity()];

GET.apiDoc = {
  description: 'Get a list of reviewed submissions',
  tags: ['submisssion', 'reviewed'],
  security: [],
  responses: {
    200: {
      description: 'List of reviewed submissions',
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
                  type: 'string'
                },
                submitted_timestamp: {
                  type: 'string'
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
 * Get all reviewed submissions (with security status).
 *
 * @returns {RequestHandler}
 */
export function getReviewedSubmissionsWithSecurity(): RequestHandler {
  return async (_req, res) => {
    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const service = new SubmissionService(connection);
      const response = await service.getReviewedSubmissionsWithSecurity();

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      await connection.rollback();
      defaultLog.error({ label: 'getReviewedSubmissionsWithSecurity', message: 'error', error });
      throw error;
    } finally {
      connection.release();
    }
  };
}
