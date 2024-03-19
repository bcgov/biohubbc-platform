import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { SECURITY_APPLIED_STATUS } from '../../../repositories/security-repository';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../services/submission-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/administrative/submission/unreviewed');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
          discriminator: 'SystemRole'
        }
      ]
    };
  }),
  getUnreviewedSubmissionsForAdmins()
];

GET.apiDoc = {
  description: 'Get a list of submissions that need security review (are unreviewed).',
  tags: ['admin'],
  security: [
    {
      Bearer: []
    }
  ],
  responses: {
    200: {
      description: 'List of submissions that need security review.',
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
                'comment',
                'create_date',
                'create_user',
                'update_date',
                'update_user',
                'revision_count',
                'security',
                'root_feature_type_id',
                'root_feature_type_name',
                'regions'
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
                comment: {
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
                  enum: [SECURITY_APPLIED_STATUS.PENDING]
                },
                root_feature_type_id: {
                  type: 'integer',
                  minimum: 1
                },
                root_feature_type_name: {
                  type: 'string'
                },
                regions: {
                  type: 'array',
                  items: {
                    type: 'string'
                  }
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
 * Get all unreviewed submissions.
 *
 * @returns {RequestHandler}
 */
export function getUnreviewedSubmissionsForAdmins(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      const service = new SubmissionService(connection);
      const response = await service.getUnreviewedSubmissionsForAdmins();

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'getUnreviewedSubmissionsForAdmins', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
