import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../../../database/db';
import {
  FormSubmissionDetailSchema,
  formSubmissionParameters
} from '../../../../../../openapi/schemas/form-submission';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { FormSubmissionService } from '../../../../../../services/form-submission-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/forms/{slug}/submissions/{formSubmissionUuid}/submit');

export const POST: Operation = [
  authorizeRequestHandler((req) => ({
    and: [
      { discriminator: 'Form', slug: req.params.slug },
      { discriminator: 'Team', entity: 'form_submission', formSubmissionUuid: req.params.formSubmissionUuid }
    ]
  })),
  submitFormSubmission()
];

POST.apiDoc = {
  description:
    "Submit a form submission's draft against the form's current published version. The first submit creates the submission; every submit creates a new upload, superseding the previous one, whose features are processed asynchronously. Open to the form submission's team.",
  tags: ['form'],
  security: [{ Bearer: [] }],
  parameters: formSubmissionParameters,
  responses: {
    202: {
      description: 'Submitted; the upload is processed asynchronously.',
      content: { 'application/json': { schema: FormSubmissionDetailSchema } }
    },
    ...defaultErrorResponses,
    409: { description: 'The current draft has already been submitted.' }
  }
};

/**
 * Submit a form submission in one transaction, queueing its processing.
 *
 * @returns {RequestHandler} Authorized operation handler.
 */
export function submitFormSubmission(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const formSubmissionService = new FormSubmissionService(connection);
      const result = await formSubmissionService.submitFormSubmission(req.params.slug, req.params.formSubmissionUuid);
      await connection.commit();
      return res.status(202).json(result);
    } catch (error) {
      defaultLog.error({ label: 'submitFormSubmission', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}
