import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { CreateFeatureProperty } from '../../../models/feature-property';
import {
  CreateFeaturePropertyRequestSchema,
  FeaturePropertiesListResponseSchema,
  FeaturePropertySchema
} from '../../../openapi/schemas/feature-property';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { FeaturePropertyService } from '../../../services/feature-property-service';
import { getLogger } from '../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/feature-properties');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  getFeatureProperties()
];

GET.apiDoc = {
  description: 'Get all active feature properties with optional pagination and search.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    ...paginationRequestQueryParamSchema,
    {
      in: 'query',
      name: 'search',
      required: false,
      schema: { type: 'string' },
      description: 'Search by feature property name'
    }
  ],
  responses: {
    200: {
      description: 'List of active feature properties',
      content: {
        'application/json': {
          schema: FeaturePropertiesListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get all active feature properties with pagination.
 *
 * @returns {RequestHandler}
 */
export function getFeatureProperties(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const search = req.query.search as string | undefined;

    try {
      await connection.open();

      const featurePropertyService = new FeaturePropertyService(connection);
      const filters = { search };
      const pagination = makePaginationOptionsFromRequest(req);

      const [feature_properties, count] = await Promise.all([
        featurePropertyService.getFeatureProperties(filters, pagination),
        featurePropertyService.getFeaturePropertiesCount(filters)
      ]);

      await connection.commit();

      return res.status(200).json({ feature_properties, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'getFeatureProperties', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  createFeatureProperty()
];

POST.apiDoc = {
  description: 'Create a new feature property.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: CreateFeaturePropertyRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Feature property created',
      content: {
        'application/json': {
          schema: FeaturePropertySchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a new feature property.
 *
 * @returns {RequestHandler}
 */
export function createFeatureProperty(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const { feature_property_type_id, name, display_name, description, calculated_value } =
      req.body as CreateFeatureProperty;

    try {
      await connection.open();

      const featurePropertyService = new FeaturePropertyService(connection);
      const result = await featurePropertyService.createFeatureProperty({
        feature_property_type_id,
        name,
        display_name,
        description,
        calculated_value
      });

      await connection.commit();

      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'createFeatureProperty', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
