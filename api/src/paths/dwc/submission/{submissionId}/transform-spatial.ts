import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SOURCE_SYSTEM } from '../../../../constants/database';
import { getServiceAccountDBConnection } from '../../../../database/db';
import { HTTP400 } from '../../../../errors/http-error';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SpatialService } from '../../../../services/spatial-service';
import { getKeycloakSource } from '../../../../utils/keycloak-utils';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/dwc/submission/{submissionId}/transform-spatial');

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
  transformSpatialSubmission()
];

POST.apiDoc = {
  description: 'Secure submission file',
  tags: ['transform', 'spatial', 'submission'],
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
      description: 'Successfully transformed spatial submission file'
    },
    ...defaultErrorResponses
  }
};

export function transformSpatialSubmission(): RequestHandler {
  return async (req, res) => {
    const submissionId = Number(req.params.submissionId);

    const sourceSystem = getKeycloakSource(req['keycloak_token']);

    if (!sourceSystem) {
      throw new HTTP400('Failed to identify known submission source system', [
        'token did not contain a clientId/azp or clientId/azp value is unknown'
      ]);
    }

    const connection = getServiceAccountDBConnection(sourceSystem);

    try {
      await connection.open();

      const spatialService = new SpatialService(connection);

      await spatialService.runSpatialTransforms(submissionId);

      await connection.commit();

      res.status(200).send();
    } catch (error) {
      defaultLog.error({ label: 'transformSpatialSubmission', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
