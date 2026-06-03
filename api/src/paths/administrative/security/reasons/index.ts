import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { CreateSecurityRule } from '../../../../models/security-rule';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../openapi/schemas/pagination';
import {
  CreateSecurityReasonRequestSchema,
  SecurityReasonSchema,
  SecurityReasonsListResponseSchema
} from '../../../../openapi/schemas/security';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SecurityRuleService } from '../../../../services/security-rule-service';
import { getLogger } from '../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/security/reasons');

const securityAdminAuth = () => ({
  and: [
    {
      validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
      discriminator: 'SystemRole' as const
    }
  ]
});

export const GET: Operation = [authorizeRequestHandler(securityAdminAuth), getSecurityReasons()];

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

      const securityRuleService = new SecurityRuleService(connection);
      const pagination = makePaginationOptionsFromRequest(req);

      const [reasons, count] = await Promise.all([
        securityRuleService.getSecurityRulesWithFeatureCount(filters, pagination),
        securityRuleService.getSecurityRulesCount(filters)
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

export const POST: Operation = [authorizeRequestHandler(securityAdminAuth), createSecurityReason()];

POST.apiDoc = {
  description: 'Create a new security reason.',
  tags: ['security'],
  security: [{ Bearer: [] }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: CreateSecurityReasonRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Security reason created',
      content: {
        'application/json': {
          schema: SecurityReasonSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a new security reason.
 *
 * @returns {RequestHandler}
 */
export function createSecurityReason(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const { name, description, security_category_id } = req.body as CreateSecurityRule;

    try {
      await connection.open();

      const securityRuleService = new SecurityRuleService(connection);
      const result = await securityRuleService.createSecurityRule({ name, description, security_category_id });

      await connection.commit();

      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'createSecurityReason', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
