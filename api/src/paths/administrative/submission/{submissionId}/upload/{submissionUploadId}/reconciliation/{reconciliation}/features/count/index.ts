import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../../../../database/db';
import { ReconciliationFeatureScope, ReconciliationType } from '../../../../../../../../../../models/reconciliation';
import { defaultErrorResponses } from '../../../../../../../../../../openapi/schemas/http-responses';
import {
  reconciliationFeatureCountsSchema,
  reconciliationFeatureParameters
} from '../../../../../../../../../../openapi/schemas/reconciliation';
import { authorizeRequestHandler } from '../../../../../../../../../../request-handlers/security/authorization';
import { SearchFeatureService } from '../../../../../../../../../../services/search-feature-service';
import { registerRequestCancellation } from '../../../../../../../../../../utils/request-cancellation';

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  countReconciliationFeatures()
];

GET.apiDoc = {
  description: 'Read stored reconciliation features across the complete upload lifecycle.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: reconciliationFeatureParameters,
  responses: {
    200: {
      description: 'Reconciliation features.',
      content: { 'application/json': { schema: reconciliationFeatureCountsSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Read reconciliation counts within an administrator-owned transaction.
 * @returns {RequestHandler} Handler with cancellation and transaction cleanup.
 */
export function countReconciliationFeatures(): RequestHandler {
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
      const result = await service.countReconciliationFeatures(scope);
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
