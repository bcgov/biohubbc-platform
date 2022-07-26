import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { HTTP400 } from '../../../../errors/http-error';
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
    defaultLog.debug({
      label: 'getSearchResults',
      message: 'request params',
      terms: req.query.terms,
      index: req.query.index
    });

    const connection = getDBConnection(req['keycloak_token']);

    console.log('reg is: ', req.params);

    if (!req.params || !req.params.datasetId) {
      throw new HTTP400('Missing required path param: datasetId');
    }

    const datasetId = String(req.params.datasetId);

    console.log('datasetId is: ', datasetId);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);

      const datasetMetadata: string = await submissionService.getSubmissionRecordSONByDatasetId(datasetId);

      console.log('datasetMetadata is: ', datasetMetadata);

      await connection.commit();

      res.status(200).json(datasetMetadata);
    } catch (error) {
      defaultLog.error({ label: 'getMetadataByDatasetId', message: 'error', error });
      throw error;
    }
  };
}
