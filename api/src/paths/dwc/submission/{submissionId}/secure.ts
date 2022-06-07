import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SOURCE_SYSTEM } from '../../../../constants/database';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { DarwinCoreService } from '../../../../services/dwc-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/dwc/submission/{submissionId}/secure');

export const POST: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validServiceClientIDs: [SOURCE_SYSTEM['SIMS-SVC']],
          discriminator: 'ServiceClient'
        }
      ]
    };
  }),
  secureSubmission()
];

POST.apiDoc = {
  description: 'Secure submission file',
  tags: ['secure', 'submission'],
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
      description: 'Successfully secured submission file',
      content: {
        'application/json': {
          schema: {
            //
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function secureSubmission(): RequestHandler {
  return async (req, res) => {
    const submissionId = Number(req.params.submissionId);

    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      const darwinCoreService = new DarwinCoreService(connection);

      const response = await darwinCoreService.tempSecureSubmission(submissionId);

      await connection.commit();

      res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'secureSubmission', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
