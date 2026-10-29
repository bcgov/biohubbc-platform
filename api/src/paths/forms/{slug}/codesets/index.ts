import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import {
  AdministrativeContributorCodesetsSchema,
  ContributorCodesetListParameters
} from '../../../../openapi/schemas/contributor-codeset-administration';
import { FormSlugSchema } from '../../../../openapi/schemas/form';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { FormService } from '../../../../services/form-service';
import { getLogger } from '../../../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../../../utils/pagination';

const defaultLog = getLogger('paths/forms/{slug}/codesets');

export const GET: Operation = [
  authorizeRequestHandler((req) => ({
    and: [{ discriminator: 'Form', slug: req.params.slug }]
  })),
  getFormCodesets()
];

GET.apiDoc = {
  description:
    'List the codesets of the contributor that owns the form addressed by a slug: the codes its code fields accept. Ended codesets are included.',
  tags: ['form'],
  security: [{ OptionalBearer: [] }],
  parameters: [
    { in: 'path', name: 'slug', required: true, schema: FormSlugSchema },
    ...ContributorCodesetListParameters
  ],
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: AdministrativeContributorCodesetsSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * List a form's codesets in one transaction. Access has been checked by the `Form` rule.
 *
 * @returns {RequestHandler}
 */
export function getFormCodesets(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();
      const formService = new FormService(connection);
      const result = await formService.getFormCodesets(req.params.slug, makePaginationOptionsFromRequest(req));
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getFormCodesets', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}
