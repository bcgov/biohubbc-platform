import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../../../database/db';
import {
  AdministrativeContributorCodesetCodesSchema,
  ContributorCodesetListParameters
} from '../../../../../../openapi/schemas/contributor-codeset-administration';
import { FormSlugSchema } from '../../../../../../openapi/schemas/form';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { FormService } from '../../../../../../services/form-service';
import { getLogger } from '../../../../../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../../../../../utils/pagination';

const defaultLog = getLogger('paths/forms/{slug}/codesets/{contributorCodesetId}/codes');

export const GET: Operation = [
  authorizeRequestHandler((req) => ({
    and: [{ discriminator: 'Form', slug: req.params.slug }]
  })),
  getFormCodesetCodes()
];

GET.apiDoc = {
  description:
    'List the codes of one codeset of the contributor that owns the form addressed by a slug. Ended codes are included; a codeset of another contributor has no codes.',
  tags: ['form'],
  security: [{ OptionalBearer: [] }],
  parameters: [
    { in: 'path', name: 'slug', required: true, schema: FormSlugSchema },
    { in: 'path', name: 'contributorCodesetId', required: true, schema: { type: 'integer', minimum: 1 } },
    ...ContributorCodesetListParameters
  ],
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: AdministrativeContributorCodesetCodesSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * List the codes of a form's codeset in one transaction. Access has been checked by the `Form` rule.
 *
 * @returns {RequestHandler}
 */
export function getFormCodesetCodes(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();
      const formService = new FormService(connection);
      const result = await formService.getFormCodesetCodes(
        req.params.slug,
        Number(req.params.contributorCodesetId),
        makePaginationOptionsFromRequest(req)
      );
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getFormCodesetCodes', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}
