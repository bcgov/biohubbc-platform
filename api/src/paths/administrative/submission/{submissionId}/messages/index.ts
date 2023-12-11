import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { SubmissionMessageRecord } from '../../../../../repositories/submission-repository';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../../../services/submission-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/submission/reviewed');

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
  getSubmissionMessages()
];

GET.apiDoc = {
  description: 'Get messages for a submission.',
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
  responses: {
    200: {
      description: 'Array of messages for a submission.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                submission_message_id: {
                  type: 'integer',
                  minimum: 1
                },
                submission_message_type_id: {
                  type: 'integer',
                  minimum: 1
                },
                submission_feature_id: {
                  type: 'integer',
                  minimum: 1
                },
                label: {
                  type: 'string',
                  maxLength: 250
                },
                message: {
                  type: 'string',
                  maxLength: 500
                },
                data: {
                  type: 'object',
                  properties: {}
                },
                create_date: {
                  type: 'string'
                },
                create_user: {
                  type: 'integer',
                  minimum: 1
                },
                update_date: {
                  type: 'string'
                },
                update_user: {
                  type: 'integer',
                  minimum: 1
                },
                revision_count: {
                  type: 'integer',
                  maximum: 0
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
 * Get messages for a submission.
 *
 * @returns {RequestHandler}
 */
export function getSubmissionMessages(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    const submissionId = Number(req.params.submissionId);

    try {
      await connection.open();

      const service = new SubmissionService(connection);
      const response = await service.getMessages(submissionId);

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionMessages', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const POST: Operation = [
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
  getSubmissionMessages()
];

POST.apiDoc = {
  description: 'Creates new messages for a submission.',
  tags: ['admin'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['messages'],
          properties: {
            messages: {
              type: 'array',
              items: {
                type: 'object',
                required: ['submission_message_type_id', 'label', 'message'],
                properties: {
                  submission_message_type_id: {
                    type: 'integer',
                    minimum: 1
                  },
                  label: {
                    type: 'string',
                    maxLength: 250
                  },
                  message: {
                    type: 'string',
                    maxLength: 500
                  },
                  data: {
                    type: 'object',
                    properties: {}
                  }
                }
              },
              minItems: 1
            }
          }
        }
      }
    }
  },
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
  responses: {
    200: {
      description: 'Create submission messages OK'
    },
    ...defaultErrorResponses
  }
};

/**
 * Create submission messages for a submission.
 *
 * @returns {RequestHandler}
 */
export function createSubmissionMessages(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    const submissionId = Number(req.params.submissionId);

    const messages = req.body.messages as Pick<
      SubmissionMessageRecord,
      'submission_message_type_id' | 'label' | 'message' | 'data'
    >[];

    try {
      await connection.open();

      const service = new SubmissionService(connection);
      const response = await service.createMessages(submissionId, messages);

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionMessages', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
