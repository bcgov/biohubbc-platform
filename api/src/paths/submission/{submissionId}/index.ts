import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { SECURITY_APPLIED_STATUS } from '../../../repositories/security-repository';
import { SubmissionService } from '../../../services/submission-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/submission/{submissionId}');

export const GET: Operation = [getSubmissionRecordWithSecurity()];

GET.apiDoc = {
  description: 'Retrieves a submission record metadata',
  tags: ['meta'],
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
      description: 'A submission record with all security and publish data.',
      content: {
        'application/json': {
          schema: {
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
              'security',
              'publish_timestamp'
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
              publish_timestamp: {
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
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Retrieves a submission record with all security data
 *
 * @returns {RequestHandler}
 */
export function getSubmissionRecordWithSecurity(): RequestHandler {
  return async (req, res) => {
    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    const submissionId = Number(req.params.submissionId);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);

      const result = await submissionService.getSubmissionRecordBySubmissionIdWithSecurity(submissionId);

      await connection.commit();

      res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionRecordWithSecurity', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
