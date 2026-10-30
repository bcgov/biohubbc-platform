import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { FormSlugSchema, FormVersionLayoutSchema } from '../../../openapi/schemas/form';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { FormService } from '../../../services/form-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/forms/{slug}');

export const GET: Operation = [
  authorizeRequestHandler((req) => ({
    and: [{ discriminator: 'Form', slug: req.params.slug }]
  })),
  findFormBySlug()
];

GET.apiDoc = {
  description:
    'Get the published version of the form addressed by a slug. A public form is open to anyone; any other form requires a member of one of its teams.',
  tags: ['form'],
  security: [{ OptionalBearer: [] }],
  parameters: [{ in: 'path', name: 'slug', required: true, schema: FormSlugSchema }],
  responses: {
    200: { description: 'Published form', content: { 'application/json': { schema: FormVersionLayoutSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * Get the published form addressed by a slug in one transaction. Access has been checked by the `Form` rule.
 *
 * @returns {RequestHandler}
 */
export function findFormBySlug(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();
      const formService = new FormService(connection);
      const result = await formService.getPublishedFormBySlug(req.params.slug);
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'findFormBySlug', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}
