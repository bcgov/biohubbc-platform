import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { PROJECT_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { DarwinCoreService } from '../../../../services/dwc-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/dwc/dataset/{submissionId}/validate');

export const POST: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validSystemRoles: [PROJECT_ROLE.PROJECT_LEAD, PROJECT_ROLE.PROJECT_EDITOR],
          discriminator: 'SystemUser'
        }
      ]
    };
  }),
  validateSubmission()
];

POST.apiDoc = {
  description: 'Validate submission file',
  tags: ['validate', 'submission'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'path',
      name: 'submissionId',
      schema: {
        type: 'integer',
        minimum: 0
      },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'Successfully validated submission file',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['validation', 'mediaState'],
            properties: {
              validation: {
                type: 'boolean'
              },
              mediaState: {
                type: 'object',
                required: ['fileName', 'isValid'],
                properties: {
                  fileName: {
                    type: 'string'
                  },
                  fileErrors: {
                    type: 'array',
                    items: {
                      type: 'string'
                    }
                  },
                  isValid: {
                    type: 'boolean'
                  }
                }
              },
              csvState: {
                type: 'array',
                items: {
                  type: 'string'
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

export function validateSubmission(): RequestHandler {
  return async (req, res) => {
    const submissionId = Number(req.params.submissionId);

    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      const darwinCoreService = new DarwinCoreService(connection);

      const response = await darwinCoreService.tempValidateSubmission(submissionId);

      await connection.commit();

      res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'validateSubmission', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
