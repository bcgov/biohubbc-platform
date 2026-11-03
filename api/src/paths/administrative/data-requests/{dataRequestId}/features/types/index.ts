import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { DataRequestFeatureTypesResponseSchema } from '../../../../../../openapi/schemas/data-request';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { DataRequestService } from '../../../../../../services/data-request-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/data-requests/{dataRequestId}/features/types');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
        discriminator: 'SystemRole'
      }
    ]
  })),
  getDataRequestFeatureTypes()
];

GET.apiDoc = {
  description: 'Get the unique feature types a data request asks for, each with the expression that limits it.',
  tags: ['data-request'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'path',
      name: 'dataRequestId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'Data request ID'
    }
  ],
  responses: {
    200: {
      description: 'Requested feature types',
      content: {
        'application/json': {
          schema: DataRequestFeatureTypesResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get the unique feature types a data request asks for, each with the expression that limits it.
 *
 * @returns {RequestHandler}
 */
export function getDataRequestFeatureTypes(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const dataRequestId = req.params.dataRequestId;

    try {
      await connection.open();

      const dataRequestService = new DataRequestService(connection);
      const featureTypes = await dataRequestService.getDataRequestFeatureTypes(dataRequestId);

      await connection.commit();

      return res.status(200).json({ feature_types: featureTypes });
    } catch (error) {
      defaultLog.error({ label: 'getDataRequestFeatureTypes', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}
