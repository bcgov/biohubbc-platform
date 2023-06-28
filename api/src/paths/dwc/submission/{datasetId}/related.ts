import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { SecurityService } from '../../../../services/security-service';
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
        type: 'string',
        format: 'uuid'
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
                  type: 'object',
                  required: ['datasetId', 'title', 'url', 'supplementaryData'],
                  properties: {
                    datasetId: {
                      type: 'string',
                      format: 'uuid'
                    },
                    title: {
                      type: 'string'
                    },
                    url: {
                      type: 'string'
                    },
                    supplementaryData: {
                      type: 'object',
                      required: ['isPendingReview'],
                      properties: {
                        isPendingReview: {
                          type: 'boolean'
                        }
                      }
                    }
                  }
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
 * Retrieves related datasets within elastic search
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
      const securityService = new SecurityService(connection);

      const datasets = await submissionService.findRelatedDatasetsByDatasetId(datasetId);

      const datasetsWithSupplementaryData = await Promise.all(
        datasets.map(async (dataset) => {
          const isDatasetPendingReview = await securityService.isDatasetPendingReview(dataset.datasetId);

          return {
            ...dataset,
            supplementaryData: { isPendingReview: isDatasetPendingReview }
          };
        })
      );

      console.log('datasetsWithSupplementaryData', datasetsWithSupplementaryData);

      await connection.commit();

      res.status(200).json({ datasetsWithSupplementaryData });
    } catch (error) {
      console.log('error is: ', error);
      defaultLog.error({ label: 'getRelatedDatasetsByDatasetId', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
