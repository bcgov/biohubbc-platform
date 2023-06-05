import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { SubmissionService } from '../../../../services/submission-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/dwc/eml/{datasetId}/handlebar');

export const GET: Operation = [getHandleBarsTemplateByDatasetId()];

GET.apiDoc = {
  description: 'retrieves handle bar template for a given dataset id',
  tags: ['eml'],
  security: [
    {
      OptionalBearer: []
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
      description: 'Dataset handlebars response string',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              header: {
                type: 'string'
              },
              details: {
                type: 'string'
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
 * Retrieves dataset metadata from the submission table.
 *
 * @returns {RequestHandler}
 */
export function getHandleBarsTemplateByDatasetId(): RequestHandler {
  return async (req, res) => {
    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    const datasetId = String(req.params.datasetId);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);

      const result = await submissionService.getHandleBarsTemplateByDatasetId(datasetId);

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
