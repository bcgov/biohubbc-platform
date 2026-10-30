import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { FormVersionLayoutSchema, SaveFormVersionRequestSchema } from '../../../../../../openapi/schemas/form';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { FormService } from '../../../../../../services/form-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/forms/{formId}/versions/{formVersionId}');

const pathParams = [
  { in: 'path', name: 'formId', required: true, schema: { type: 'integer', minimum: 1 } },
  { in: 'path', name: 'formVersionId', required: true, schema: { type: 'integer', minimum: 1 } }
] as const;

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getFormVersion()
];

GET.apiDoc = {
  description: 'Retrieve a form version and its complete layout.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [...pathParams],
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: FormVersionLayoutSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * Retrieve a form version layout in one transaction.
 *
 * @returns {RequestHandler} Authorized operation handler.
 */
export function getFormVersion(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const formService = new FormService(connection);
      const result = await formService.getFormVersionLayout(
        Number(req.params.formId),
        Number(req.params.formVersionId)
      );
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getFormVersion', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  updateFormVersion()
];

PUT.apiDoc = {
  description: 'Replace the form metadata and complete layout of a draft form version and its blueprint.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [...pathParams],
  requestBody: { required: true, content: { 'application/json': { schema: SaveFormVersionRequestSchema } } },
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: FormVersionLayoutSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * Replace a draft form version layout in one transaction.
 *
 * @returns {RequestHandler} Authorized operation handler.
 */
export function updateFormVersion(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const formService = new FormService(connection);
      const result = await formService.updateFormVersion(
        Number(req.params.formId),
        Number(req.params.formVersionId),
        req.body
      );
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'updateFormVersion', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}
