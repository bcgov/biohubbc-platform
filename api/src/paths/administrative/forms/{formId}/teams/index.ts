import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { FormTeamsResponseSchema, UpdateFormTeamsRequestSchema } from '../../../../../openapi/schemas/form';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { FormService } from '../../../../../services/form-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/forms/{formId}/teams');

const formIdParam = { in: 'path', name: 'formId', required: true, schema: { type: 'integer', minimum: 1 } } as const;

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getFormTeams()
];

GET.apiDoc = {
  description: 'List the teams whose members may access a form that is not public.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [formIdParam],
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: FormTeamsResponseSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * List a form's teams in one transaction.
 *
 * @returns {RequestHandler} Authorized operation handler.
 */
export function getFormTeams(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const formService = new FormService(connection);
      const teams = await formService.getFormTeams(Number(req.params.formId));
      await connection.commit();
      return res.status(200).json({ teams });
    } catch (error) {
      defaultLog.error({ label: 'getFormTeams', message: 'error', error });
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
  updateFormTeams()
];

PUT.apiDoc = {
  description: 'Replace the teams whose members may access a form that is not public.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [formIdParam],
  requestBody: { required: true, content: { 'application/json': { schema: UpdateFormTeamsRequestSchema } } },
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: FormTeamsResponseSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * Replace a form's teams in one transaction.
 *
 * @returns {RequestHandler} Authorized operation handler.
 */
export function updateFormTeams(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const formService = new FormService(connection);
      const teams = await formService.updateFormTeams(Number(req.params.formId), req.body.teamIds);
      await connection.commit();
      return res.status(200).json({ teams });
    } catch (error) {
      defaultLog.error({ label: 'updateFormTeams', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}
