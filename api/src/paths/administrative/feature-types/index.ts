import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { CreateFeatureType } from '../../../models/feature-type';
import {
  CreateFeatureTypeRequestSchema,
  FeatureTypeSchema,
  FeatureTypesListResponseSchema
} from '../../../openapi/schemas/feature-type';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { FeatureTypeService } from '../../../services/feature-type-service';
import { getLogger } from '../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/feature-types');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  getFeatureTypes()
];

GET.apiDoc = {
  description: 'Get all active feature types with optional pagination and search.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    ...paginationRequestQueryParamSchema,
    {
      in: 'query',
      name: 'search',
      required: false,
      schema: { type: 'string' },
      description: 'Search by feature type name'
    }
  ],
  responses: {
    200: {
      description: 'List of active feature types',
      content: {
        'application/json': {
          schema: FeatureTypesListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get all active feature types with pagination.
 *
 * @returns {RequestHandler}
 */
export function getFeatureTypes(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const search = req.query.search as string | undefined;

    try {
      await connection.open();

      const featureTypeService = new FeatureTypeService(connection);
      const filters = { search };
      const pagination = makePaginationOptionsFromRequest(req);

      const [feature_types, count] = await Promise.all([
        featureTypeService.getFeatureTypes(filters, pagination),
        featureTypeService.getFeatureTypesCount(filters)
      ]);

      await connection.commit();

      return res.status(200).json({ feature_types, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'getFeatureTypes', message: 'error', error });
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
  createFeatureType()
];

POST.apiDoc = {
  description: 'Create a new feature type.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: CreateFeatureTypeRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Feature type created',
      content: {
        'application/json': {
          schema: FeatureTypeSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a new feature type.
 *
 * @returns {RequestHandler}
 */
export function createFeatureType(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const { name, display_name, description } = req.body as CreateFeatureType;

    try {
      await connection.open();

      const featureTypeService = new FeatureTypeService(connection);
      const result = await featureTypeService.createFeatureType({ name, display_name, description });

      await connection.commit();

      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'createFeatureType', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
