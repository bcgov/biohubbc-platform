import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../database/db';
import { FormVersionLayoutSchema } from '../../../../../../../openapi/schemas/form';
import { defaultErrorResponses } from '../../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../../request-handlers/security/authorization';
import { FormService } from '../../../../../../../services/form-service';
import { getLogger } from '../../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/forms/{formId}/versions/{formVersionId}/publish');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  publishFormVersion()
];

POST.apiDoc = {
  description:
    'Publish a draft form version and its blueprint, retiring the previously published version and its blueprint. Once published, neither can be changed.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    { in: 'path', name: 'formId', required: true, schema: { type: 'integer', minimum: 1 } },
    { in: 'path', name: 'formVersionId', required: true, schema: { type: 'integer', minimum: 1 } }
  ],
  responses: {
    200: {
      description: 'Form version published',
      content: { 'application/json': { schema: FormVersionLayoutSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Publish a draft form version and its blueprint in one transaction.
 *
 * @returns {RequestHandler} Authorized operation handler.
 */
export function publishFormVersion(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const formService = new FormService(connection);
      const result = await formService.publishFormVersion(Number(req.params.formId), Number(req.params.formVersionId));
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'publishFormVersion', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}
