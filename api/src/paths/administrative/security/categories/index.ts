import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { CreateSecurityCategory } from '../../../../models/security-category';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../openapi/schemas/pagination';
import {
  CreateSecurityCategoryRequestSchema,
  SecurityCategoriesListResponseSchema,
  SecurityCategorySchema
} from '../../../../openapi/schemas/security';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SecurityService } from '../../../../services/security-service';
import { getLogger } from '../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/security/categories');

const securityAdminAuth = () => ({
  and: [
    {
      validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
      discriminator: 'SystemRole' as const
    }
  ]
});

export const GET: Operation = [authorizeRequestHandler(securityAdminAuth), getSecurityCategories()];

GET.apiDoc = {
  description: 'Get all active security categories with their associated rule counts.',
  tags: ['security'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    ...paginationRequestQueryParamSchema,
    {
      in: 'query',
      name: 'search',
      required: false,
      schema: { type: 'string' },
      description: 'Search term to filter categories by name'
    }
  ],
  responses: {
    200: {
      description: 'List of security categories with rule counts.',
      content: {
        'application/json': {
          schema: SecurityCategoriesListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get all active security categories with pagination.
 *
 * @returns {RequestHandler}
 */
export function getSecurityCategories(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    const search = req.query.search as string | undefined;
    const filters = { search };
    const pagination = makePaginationOptionsFromRequest(req);

    try {
      await connection.open();

      const securityService = new SecurityService(connection);

      const [categories, count] = await Promise.all([
        securityService.getSecurityCategoriesWithRuleCount(filters, pagination),
        securityService.getSecurityCategoriesCount(filters)
      ]);

      await connection.commit();

      return res.status(200).json({ categories, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'getSecurityCategories', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const POST: Operation = [authorizeRequestHandler(securityAdminAuth), createSecurityCategory()];

POST.apiDoc = {
  description: 'Create a new security category.',
  tags: ['security'],
  security: [{ Bearer: [] }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: CreateSecurityCategoryRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Security category created',
      content: {
        'application/json': {
          schema: SecurityCategorySchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a new security category.
 *
 * @returns {RequestHandler}
 */
export function createSecurityCategory(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const { name, description } = req.body as CreateSecurityCategory;

    try {
      await connection.open();

      const securityService = new SecurityService(connection);
      const result = await securityService.createSecurityCategory({ name, description });

      await connection.commit();

      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'createSecurityCategory', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
