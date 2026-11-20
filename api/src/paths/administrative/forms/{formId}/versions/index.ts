import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { FormVersionLayoutSchema } from '../../../../../openapi/schemas/form';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { FormService } from '../../../../../services/form-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/forms/{formId}/versions');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  createFormVersion()
];

POST.apiDoc = {
  description:
    'Revise a published form: create a draft version joined to a new blueprint copied from the published version. The published version stays active until the revision is published.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [{ in: 'path', name: 'formId', required: true, schema: { type: 'integer', minimum: 1 } }],
  responses: {
    201: { description: 'Draft version created', content: { 'application/json': { schema: FormVersionLayoutSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * Create a draft revision of a published form in one transaction.
 *
 * @returns {RequestHandler} Authorized operation handler.
 */
export function createFormVersion(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const formService = new FormService(connection);
      const result = await formService.createFormVersion(Number(req.params.formId));
      await connection.commit();
      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'createFormVersion', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}
