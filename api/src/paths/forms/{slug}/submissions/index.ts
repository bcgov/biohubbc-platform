import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { FormSlugSchema } from '../../../../openapi/schemas/form';
import { FormSubmissionDetailSchema, FormSubmissionsResponseSchema } from '../../../../openapi/schemas/form-submission';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { FormSubmissionService } from '../../../../services/form-submission-service';
import { getLogger } from '../../../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../../../utils/pagination';

const defaultLog = getLogger('paths/forms/{slug}/submissions');

const slugParam = { in: 'path', name: 'slug', required: true, schema: FormSlugSchema } as const;

export const GET: Operation = [
  authorizeRequestHandler((req) => ({
    and: [{ discriminator: 'Form', slug: req.params.slug }, { discriminator: 'SystemUser' }]
  })),
  getFormSubmissions()
];

GET.apiDoc = {
  description:
    "List a form's submissions: every submission for a member of the form administration team, and only the caller's own otherwise.",
  tags: ['form'],
  security: [{ Bearer: [] }],
  parameters: [slugParam, ...paginationRequestQueryParamSchema],
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: FormSubmissionsResponseSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * List a form's submissions in one transaction.
 *
 * @returns {RequestHandler} Authorized operation handler.
 */
export function getFormSubmissions(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const formSubmissionService = new FormSubmissionService(connection);
      const pagination = makePaginationOptionsFromRequest(req);
      pagination.sort = pagination.sort ?? 'create_date';
      pagination.order = pagination.order ?? 'desc';
      const result = await formSubmissionService.getFormSubmissions(req.params.slug, pagination);
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getFormSubmissions', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

export const POST: Operation = [
  authorizeRequestHandler((req) => ({
    and: [{ discriminator: 'Form', slug: req.params.slug }, { discriminator: 'SystemUser' }]
  })),
  createFormSubmission()
];

POST.apiDoc = {
  description:
    'Start a submission of the published form addressed by a slug. The caller becomes the only member of its team. Saving and submitting require sign-in, even for a public form.',
  tags: ['form'],
  security: [{ Bearer: [] }],
  parameters: [slugParam],
  responses: {
    201: { description: 'Draft created', content: { 'application/json': { schema: FormSubmissionDetailSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * Start a form submission in one transaction.
 *
 * @returns {RequestHandler} Authorized operation handler.
 */
export function createFormSubmission(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const formSubmissionService = new FormSubmissionService(connection);
      const result = await formSubmissionService.createFormSubmission(req.params.slug);
      await connection.commit();
      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'createFormSubmission', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}
