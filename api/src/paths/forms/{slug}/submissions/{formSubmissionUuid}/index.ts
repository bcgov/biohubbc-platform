import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../../database/db';
import {
  FormSubmissionDetailSchema,
  formSubmissionParameters,
  UpdateFormSubmissionRequestSchema
} from '../../../../../openapi/schemas/form-submission';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { FormSubmissionService } from '../../../../../services/form-submission-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/forms/{slug}/submissions/{formSubmissionUuid}');

export const GET: Operation = [
  authorizeRequestHandler((req) => ({
    or: [
      { discriminator: 'Team', entity: 'form_submission', formSubmissionUuid: req.params.formSubmissionUuid },
      { discriminator: 'Team', entity: 'form', formSlug: req.params.slug }
    ]
  })),
  getFormSubmission()
];

GET.apiDoc = {
  description:
    "Get a form submission, the caller's relationship to it, and its latest submit. Open to the form submission's team and the form administration team.",
  tags: ['form'],
  security: [{ Bearer: [] }],
  parameters: formSubmissionParameters,
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: FormSubmissionDetailSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * Get a form submission in one transaction.
 *
 * @returns {RequestHandler} Authorized operation handler.
 */
export function getFormSubmission(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const formSubmissionService = new FormSubmissionService(connection);
      const result = await formSubmissionService.getFormSubmission(req.params.slug, req.params.formSubmissionUuid);
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getFormSubmission', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

export const PUT: Operation = [
  authorizeRequestHandler((req) => ({
    and: [
      { discriminator: 'Form', slug: req.params.slug },
      { discriminator: 'Team', entity: 'form_submission', formSubmissionUuid: req.params.formSubmissionUuid }
    ]
  })),
  updateFormSubmission()
];

PUT.apiDoc = {
  description:
    "Replace a form submission's draft. Editing a submitted form submission returns it to draft, which is how it is revised. Open to the form submission's team.",
  tags: ['form'],
  security: [{ Bearer: [] }],
  parameters: formSubmissionParameters,
  requestBody: { required: true, content: { 'application/json': { schema: UpdateFormSubmissionRequestSchema } } },
  responses: {
    200: { description: 'Draft saved', content: { 'application/json': { schema: FormSubmissionDetailSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * Replace a form submission's draft in one transaction.
 *
 * @returns {RequestHandler} Authorized operation handler.
 */
export function updateFormSubmission(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const formSubmissionService = new FormSubmissionService(connection);
      const result = await formSubmissionService.updateFormSubmission(
        req.params.slug,
        req.params.formSubmissionUuid,
        req.body.data
      );
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'updateFormSubmission', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}
