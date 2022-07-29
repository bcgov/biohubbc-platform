import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../../services/submission-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/dwc/eml/get');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'SystemUser'
        }
      ]
    };
  }),
  getMetadataByDatasetId()
];

GET.apiDoc = {
  description: 'retrieves dataset metadata within elastic search',
  tags: ['eml'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      description: 'dataset Id.',
      in: 'path',
      name: 'datasetId',
      schema: {
        type: 'string'
      },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'Dataset metadata response object.',
      content: {
        'application/json': {
          schema: {
            type: 'object'
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Retrieves dataset metadata from the submission table.
 *
 * @returns {RequestHandler}
 */
export function getMetadataByDatasetId(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    const datasetId = String(req.params.datasetId);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);

      const result: string = await submissionService.getSubmissionRecordSONByDatasetId(datasetId);

      await connection.commit();

      res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getMetadataByDatasetId', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
