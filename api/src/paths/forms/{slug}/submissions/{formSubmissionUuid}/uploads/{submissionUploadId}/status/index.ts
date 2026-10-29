import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../../../../../database/db';
import { formSubmissionParameters } from '../../../../../../../../openapi/schemas/form-submission';
import { defaultErrorResponses } from '../../../../../../../../openapi/schemas/http-responses';
import {
  SubmissionUploadDecisionResponseSchema,
  UpdateSubmissionUploadDecisionRequestSchema
} from '../../../../../../../../openapi/schemas/upload';
import { authorizeRequestHandler } from '../../../../../../../../request-handlers/security/authorization';
import { FormSubmissionService } from '../../../../../../../../services/form-submission-service';
import { getLogger } from '../../../../../../../../utils/logger';

const defaultLog = getLogger('paths/forms/{slug}/submissions/{formSubmissionUuid}/uploads/{submissionUploadId}/status');

export const PATCH: Operation = [
  authorizeRequestHandler((req) => ({
    and: [{ discriminator: 'Team', entity: 'form', formSlug: req.params.slug }]
  })),
  updateFormSubmissionUploadDecision()
];

PATCH.apiDoc = {
  description:
    "Record a form administrator's review decision on one of a form submission's uploads: approved, denied, or pending to clear a prior decision. An approval is applied asynchronously: the upload is approving until its features have been published. Open to the form administration team.",
  tags: ['form'],
  security: [{ Bearer: [] }],
  parameters: [
    ...formSubmissionParameters,
    { in: 'path', name: 'submissionUploadId', required: true, schema: { type: 'string', format: 'uuid' } }
  ],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: UpdateSubmissionUploadDecisionRequestSchema } }
  },
  responses: {
    200: {
      description:
        'Decision recorded: a denial or a reset to pending, or an approval request for an upload whose approval had already been applied.',
      content: { 'application/json': { schema: SubmissionUploadDecisionResponseSchema } }
    },
    202: {
      description:
        'Approval accepted, or a repeat approval request while an earlier approval is still being applied. The upload is approving until the queued job publishes its features.',
      content: { 'application/json': { schema: SubmissionUploadDecisionResponseSchema } }
    },
    ...defaultErrorResponses,
    400: {
      description:
        'Approval preconditions not met: automated validation has not completed, or indexing has not completed.'
    },
    409: { description: 'The decision would reverse published feature state, or an approval is still being applied.' }
  }
};

/**
 * Record a form administrator's review decision in one transaction.
 *
 * @returns {RequestHandler} Authorized operation handler.
 */
export function updateFormSubmissionUploadDecision(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const formSubmissionService = new FormSubmissionService(connection);
      const result = await formSubmissionService.updateFormSubmissionUploadDecision(
        req.params.slug,
        req.params.formSubmissionUuid,
        req.params.submissionUploadId,
        { decision: req.body.decision }
      );
      await connection.commit();

      // An approval is applied by a queued job; 202 tells the client the decision is not yet in effect.
      if (result.decision === 'approving') {
        return res.status(202).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'updateFormSubmissionUploadDecision', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}
