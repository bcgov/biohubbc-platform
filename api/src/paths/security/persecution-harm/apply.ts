import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { SecurityService } from '../../../services/security-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/security/persecution-harm/apply');

export const POST: Operation = [applySecurityRulesToArtifacts()];

POST.apiDoc = {
  description: 'Apply security rules to artifacts.',
  tags: ['security'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    description: 'Selected artifacts and security reasons.',
    content: {
      'application/json': {
        schema: {
          title: 'Security Reason and Artifacts Arrays',
          type: 'object',
          required: ['artifactIds', 'securityReasonIds'],
          properties: {
            artifactIds: {
              type: 'array',
              items: {
                type: 'integer',
                minimum: 1
              }
            },
            securityReasonIds: {
              type: 'array',
              items: {
                type: 'integer',
                minimum: 1
              }
            }
          }
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Apply security rules to artifacts response object.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              title: 'Artifact Persecution',
              type: 'object',
              nullable: true,
              properties: {
                artifact_persecution_id: {
                  type: 'integer',
                  minimum: 1
                }
              }
            }
          }
        }
      }
    },
    400: {
      $ref: '#/components/responses/400'
    },
    500: {
      $ref: '#/components/responses/500'
    },
    default: {
      $ref: '#/components/responses/default'
    }
  }
};

/**
 * Get taxonomic search results.
 *
 * @returns {RequestHandler}
 */
export function applySecurityRulesToArtifacts(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'applySecurityRulesToArtifacts', message: 'request body', req_body: req.body });
    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    const { artifactIds, securityReasonIds } = req.body;

    try {
      await connection.open();

      const securityService = new SecurityService(connection);

      const response: { artifact_persecution_id: number }[] = await securityService.applySecurityRulesToArtifacts(
        artifactIds,
        securityReasonIds
      );

      res.status(200).json(response.flat());
      await connection.commit();
    } catch (error) {
      defaultLog.error({ label: 'applySecurityRulesToArtifacts', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
