import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { ArtifactService } from '../../../../services/artifact-service';
import { SecurityService } from '../../../../services/security-service';
import { UserService } from '../../../../services/user-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/dwc/submission/{datasetId}/artifacts');

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
            type: 'array',
            items: {
              type: 'object',
              required: [
                'artifact_id',
                'create_date',
                'description',
                'file_name',
                'file_size',
                'foi_reason',
                'key',
                'security_review_timestamp',
                'submission_id',
                'title',
                'uuid',
                'supplementaryData'
              ],
              properties: {
                artifact_id: {
                  type: 'integer',
                  minimum: 1
                },
                create_date: {
                  oneOf: [{ type: 'object' }, { type: 'string', format: 'date-time' }]
                },
                description: {
                  type: 'string',
                  nullable: true
                },
                file_name: {
                  type: 'string'
                },
                file_size: {
                  type: 'integer'
                },
                foi_reason: {
                  type: 'boolean',
                  nullable: true
                },
                key: {
                  type: 'string'
                },
                security_review_timestamp: {
                  oneOf: [{ type: 'object' }, { type: 'string', format: 'date-time' }],
                  nullable: true
                },
                submission_id: {
                  type: 'integer',
                  minimum: 1
                },
                title: {
                  type: 'string',
                  nullable: true
                },
                uuid: {
                  type: 'string',
                  format: 'uuid'
                },
                supplementaryData: {
                  type: 'object',
                  required: ['persecutionAndHarmRules', 'persecutionAndHarmStatus'],
                  properties: {
                    persecutionAndHarmStatus: {
                      type: 'string',
                      enum: ['SECURED', 'UNSECURED', 'PENDING']
                    },
                    persecutionAndHarmRules: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          artifact_id: {
                            type: 'integer'
                          },
                          artifact_persecution_id: {
                            type: 'integer'
                          },
                          persecution_or_harm_id: {
                            type: 'integer'
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
      const userService = new UserService(connection);
      const artifactService = new ArtifactService(connection);
      const securityService = new SecurityService(connection);

      const isAdmin = await userService.isSystemUserAdmin();
      const artifacts = await artifactService.getArtifactsByDatasetId(datasetId);

      const artifactsWithRules = await Promise.all(
        artifacts.map(async (artifact) => {
          const supplementaryData = await securityService.getArtifactSupplementaryData(artifact.artifact_id, isAdmin);
          return {
            ...artifact,
            supplementaryData: supplementaryData
          };
        })
      );

      await connection.commit();

      res.status(200).json(artifactsWithRules);
    } catch (error) {
      defaultLog.error({ label: 'getArtifactsByDatasetId', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
