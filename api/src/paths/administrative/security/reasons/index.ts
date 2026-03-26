import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../openapi/schemas/pagination';
import { SecurityReasonsListResponseSchema } from '../../../../openapi/schemas/security';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SecurityService } from '../../../../services/security-service';
import { getLogger } from '../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/security/reasons');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
          discriminator: 'SystemRole'
        }
      ]
    };
  }),
  getSecurityReasons()
];

GET.apiDoc = {
  description: 'Get all active security reasons (rules) with their associated feature counts.',
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
      description: 'Search term to filter reasons by name'
    }
  ],
  responses: {
    200: {
      description: 'List of security reasons with feature counts.',
      content: {
        'application/json': {
          schema: SecurityReasonsListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get all active security reasons with pagination.
 *
 * @returns {RequestHandler}
 */
export function getSecurityReasons(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    const search = req.query.search as string | undefined;
    const filters = { search };

    try {
      await connection.open();

      const securityService = new SecurityService(connection);
      const pagination = makePaginationOptionsFromRequest(req);

      const [reasons, count] = await Promise.all([
        securityService.getSecurityRulesWithFeatureCount(filters, pagination),
        securityService.getSecurityRulesCount(filters)
      ]);

      await connection.commit();

      return res.status(200).json({ reasons, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'getSecurityReasons', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
