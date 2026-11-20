import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { CreateFormRequestSchema, FormsResponseSchema, FormVersionLayoutSchema } from '../../../openapi/schemas/form';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { FormService } from '../../../services/form-service';
import { getLogger } from '../../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/forms');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getForms()
];

GET.apiDoc = {
  description: 'List active forms, each with its latest version.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [...paginationRequestQueryParamSchema, { in: 'query', name: 'keyword', schema: { type: 'string' } }],
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: FormsResponseSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * List active forms in one transaction.
 *
 * @returns {RequestHandler} Authorized operation handler.
 */
export function getForms(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const formService = new FormService(connection);
      const pagination = makePaginationOptionsFromRequest(req);
      pagination.sort = pagination.sort ?? 'name';
      pagination.order = pagination.order ?? 'asc';
      const result = await formService.getForms({ keyword: req.query.keyword as string | undefined }, pagination);
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getForms', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  createForm()
];

POST.apiDoc = {
  description: 'Create a form, addressed by its slug, with a draft first version joined to a new draft blueprint.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  requestBody: { required: true, content: { 'application/json': { schema: CreateFormRequestSchema } } },
  responses: {
    201: { description: 'Success', content: { 'application/json': { schema: FormVersionLayoutSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * Create a form, its draft first version and its blueprint in one transaction.
 *
 * @returns {RequestHandler} Authorized operation handler.
 */
export function createForm(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const formService = new FormService(connection);
      const result = await formService.createForm(req.body);
      await connection.commit();
      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'createForm', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}
