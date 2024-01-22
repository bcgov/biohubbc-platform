import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { PatchSubmissionRecord } from '../../../../repositories/submission-repository';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../../services/submission-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/submission/{submissionId}');

export const PATCH: Operation = [
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
  patchSubmissionRecord()
];

PATCH.apiDoc = {
  description: 'Patch a submission record.',
  tags: ['admin'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      description: 'Submission ID',
      in: 'path',
      name: 'submissionId',
      schema: {
        type: 'integer',
        minimum: 1
      },
      required: true
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: {
          type: 'object',
          description: 'Patch operations to perform on the submission record. At least one operation must be provided.',
          anyOf: [{ required: ['security_reviewed'] }, { required: ['published'] }],
          properties: {
            security_reviewed: {
              type: 'boolean',
              description:
                'Set or unset the security_review_timestamp of the record, indicating whether or not the submission record has completed security review.'
            },
            published: {
              type: 'boolean',
              description:
                'Set or unset the publish_timestamp of the record, indicating whether or not the submission record has been published for public consumption.'
            }
          }
        }
      }
    }
  },
  responses: {
    200: {
      description: 'The patched submission record.',
      content: {
        'application/json': {
          schema: {
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
              }
            },
            additionalProperties: false
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Patch a submission record.
 *
 * @returns {RequestHandler}
 */
export function patchSubmissionRecord(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    const submissionId = Number(req.params.submissionId);

    const patch = req.body as PatchSubmissionRecord;

    try {
      await connection.open();

      const service = new SubmissionService(connection);
      const response = await service.patchSubmissionRecord(submissionId, patch);

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'patchSubmissionRecord', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
