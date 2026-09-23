import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { FeaturePropertyService } from '../../../services/feature-property-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/administrative/feature-property-types');
export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getFeaturePropertyTypes()
];
GET.apiDoc = {
  description: 'List non-ended property types for administration.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'Property types',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['feature_property_types'],
            properties: {
              feature_property_types: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['feature_property_type_id', 'name'],
                  properties: {
                    feature_property_type_id: { type: 'integer' },
                    name: { type: 'string' }
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
 * Retrieve the property-type selector through its owning service.
 * @returns Administrative request handler.
 */
export function getFeaturePropertyTypes(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const featurePropertyService = new FeaturePropertyService(connection);
      const result = await featurePropertyService.getFeaturePropertyTypes();
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getFeaturePropertyTypes', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
