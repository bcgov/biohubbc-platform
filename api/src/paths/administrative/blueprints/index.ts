import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import {
  BlueprintSchema,
  BlueprintsResponseSchema,
  CreateBlueprintRequestSchema
} from '../../../openapi/schemas/blueprint';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { BlueprintService } from '../../../services/blueprint-service';
import { BlueprintVersionService } from '../../../services/blueprint-version-service';
import { getLogger } from '../../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/blueprints');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getBlueprints()
];

GET.apiDoc = {
  description: 'List blueprint metadata across all lifecycle states.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [...paginationRequestQueryParamSchema, { in: 'query', name: 'keyword', schema: { type: 'string' } }],

  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: BlueprintsResponseSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * List blueprint metadata across all lifecycle states in one transaction.
 * @returns Authorized operation handler.
 */
export function getBlueprints(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const blueprintService = new BlueprintService(connection);
      const pagination = makePaginationOptionsFromRequest(req);
      pagination.sort = pagination.sort ?? 'name';
      pagination.order = pagination.order ?? 'asc';
      const result = await blueprintService.getBlueprints(
        { keyword: req.query.keyword as string | undefined },
        pagination
      );
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getBlueprints', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  createBlueprint()
];

POST.apiDoc = {
  description: 'Create blueprint metadata without assigning composition or default status.',
  tags: ['admin'],
  security: [{ Bearer: [] }],

  requestBody: { required: true, content: { 'application/json': { schema: CreateBlueprintRequestSchema } } },
  responses: {
    201: { description: 'Success', content: { 'application/json': { schema: BlueprintSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * Create blueprint metadata without assigning composition or default status in one transaction.
 * @returns Authorized operation handler.
 */
export function createBlueprint(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const blueprintVersionService = new BlueprintVersionService(connection);

      const result = await blueprintVersionService.createBlueprint(req.body);
      await connection.commit();
      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'createBlueprint', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
