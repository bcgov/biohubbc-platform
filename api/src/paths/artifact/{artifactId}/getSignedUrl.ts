import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { ArtifactService } from '../../../services/artifact-service';
import { getS3SignedURL } from '../../../utils/file-utils';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/eml/get');

export const GET: Operation = [getArtifactSignedUrl()];

GET.apiDoc = {
  description: 'Retrieves the signed URL for an artifact by its artifact ID',
  tags: ['artifacts', 's3'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  parameters: [
    {
      description: 'Artifact ID',
      in: 'path',
      name: 'artifactId',
      schema: {
        type: 'string'
      },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'Signed url response.',
      content: {
        'application/json': {
          schema: {
            type: 'string'
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
export function getArtifactSignedUrl(): RequestHandler {
  return async (req, res) => {
    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    const artifactId = Number(req.params.artifactId);

    try {
      await connection.open();

      const artifactService = new ArtifactService(connection);

      const response = await artifactService.getArtifactById(artifactId);

      const signedUrl = await getS3SignedURL(response.key)

      await connection.commit();

      res.status(200).send(signedUrl);
    } catch (error) {
      defaultLog.error({ label: 'getArtifactSignedUrl', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
