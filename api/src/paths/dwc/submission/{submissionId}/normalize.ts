import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SOURCE_SYSTEM } from '../../../../constants/database';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { DarwinCoreService } from '../../../../services/dwc-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/dwc/submission/{submissionId}/normalize');

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
  normalizeSubmission()
];

POST.apiDoc = {
  description: 'normalize and save data of submission file',
  tags: ['normalize', 'submission'],
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
        minimum: 1
      },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'Successfully normalized and saved data of submission file',
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

export function normalizeSubmission(): RequestHandler {
  return async (req, res) => {
    const submissionId = Number(req.params.submissionId);

    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      const darwinCoreService = new DarwinCoreService(connection);

      const dwcArchiveFile = await darwinCoreService.getSubmissionRecordAndConvertToDWCArchive(submissionId);

      const response = await darwinCoreService.normalizeSubmission(dwcArchiveFile);

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
