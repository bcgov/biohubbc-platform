import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { ArtifactService } from '../../../../services/artifact-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/dwc/eml/get');

export const GET: Operation = [getArtifactsByDatasetId()];

GET.apiDoc = {
  description: 'Retrieves dataset artifact records by dataset ID',
  tags: ['artifacts'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  parameters: [
    {
      description: 'Dataset identifier',
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
      description: 'Dataset attachments response object.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              artifacts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    artifact_id: {
                      type: 'number',
                      minimum: 1
                    },
                    create_date: {
                      oneOf: [
                        {
                          type: 'object'
                        },
                        {
                          type: 'string',
                          format: 'date'
                        }
                      ]
                    },
                    description: {
                      type: 'string',
                      nullable: true
                    },
                    file_name: {
                      type: 'string'
                    },
                    file_size: {
                      type: 'number'
                    },
                    foi_reason_description: {
                      type: 'string',
                      nullable: true
                    },
                    key: {
                      type: 'string'
                    },
                    security_review_timestamp: {
                      type: 'string',
                      nullable: true
                    },
                    submission_id: {
                      type: 'number',
                      minimum: 1
                    },
                    title: {
                      type: 'string',
                      nullable: true
                    },
                    uuid: {
                      type: 'string',
                      format: 'uuid'
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
 * Retrieves dataset artifacts
 *
 * @returns {RequestHandler}
 */
export function getArtifactsByDatasetId(): RequestHandler {
  return async (req, res) => {
    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    const datasetId = String(req.params.datasetId);

    try {
      await connection.open();

      const artifactService = new ArtifactService(connection);

      const response = await artifactService.getArtifactsByDatasetId(datasetId);

      await connection.commit();

      res.status(200).json({ artifacts: response });
    } catch (error) {
      defaultLog.error({ label: 'getArtifactsByDatasetId', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
