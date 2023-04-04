import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { SubmissionService } from '../../../../services/submission-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/dwc/submission/{datasetId}/related');

export const GET: Operation = [getRelatedDatasetsByDatasetId()];

GET.apiDoc = {
  description: 'retrieves related datasets within elastic search',
  tags: ['eml'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  parameters: [
    {
      description: 'Dataset ID',
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
      description: 'Related datasets response object.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              datasets: {
                type: 'array',
                items: {
                    // @TODO
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
 * Retrieves dataset metadata from the submission table.
 *
 * @returns {RequestHandler}
 */
export function getRelatedDatasetsByDatasetId(): RequestHandler {
  return async (req, res) => {
    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    const datasetId = String(req.params.datasetId);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);

      const datasets = await submissionService.findRelatedDatasetsByDatasetId(datasetId);

      await connection.commit();

      res.status(200).json({ datasets });
    } catch (error) {
      defaultLog.error({ label: 'getRelatedDatasetsByDatasetId', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
