import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../../../database/db';
import { ReconciliationFeatureScope, ReconciliationType } from '../../../../../../../../../models/reconciliation';
import { defaultErrorResponses } from '../../../../../../../../../openapi/schemas/http-responses';
import { cursorPaginationRequestBodySchema } from '../../../../../../../../../openapi/schemas/pagination';
import {
  reconciliationFeaturePageSchema,
  reconciliationFeatureParameters
} from '../../../../../../../../../openapi/schemas/reconciliation';
import { authorizeRequestHandler } from '../../../../../../../../../request-handlers/security/authorization';
import { SearchFeatureService } from '../../../../../../../../../services/search-feature-service';
import { makeCursorPaginationOptionsFromBody } from '../../../../../../../../../utils/pagination';
import { registerRequestCancellation } from '../../../../../../../../../utils/request-cancellation';
import { validateSearchFeatureType } from '../../../../../../../../../utils/search-feature-validation';

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getReconciliationFeatures()
];

POST.apiDoc = {
  description: 'Read stored reconciliation features across the complete upload lifecycle.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: reconciliationFeatureParameters,
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['featureType'],
          properties: { featureType: { type: 'string', minLength: 1 }, pagination: cursorPaginationRequestBodySchema }
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Reconciliation features.',
      content: { 'application/json': { schema: reconciliationFeaturePageSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Read a reconciliation cursor page within an administrator-owned transaction.
 * @returns {RequestHandler} Handler with cancellation and transaction cleanup.
 */
export function getReconciliationFeatures(): RequestHandler {
  return async (req, res) => {
    const cancellation = registerRequestCancellation(res);
    const connection = getDBConnection(req.keycloak_token, { signal: cancellation.signal });
    try {
      await connection.open();
      const scope: ReconciliationFeatureScope = {
        submissionId: Number(req.params.submissionId),
        submissionUploadId: req.params.submissionUploadId,
        reconciliation: req.params.reconciliation as ReconciliationType
      };
      const service = new SearchFeatureService(connection);
      const featureType = validateSearchFeatureType(req.body.featureType);
      const pagination = makeCursorPaginationOptionsFromBody(req);
      const result = await service.getReconciliationFeatures(scope, featureType, pagination);
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      cancellation.unregister();
      await connection.rollback();
      throw error;
    } finally {
      cancellation.unregister();
      await connection.release();
    }
  };
}
