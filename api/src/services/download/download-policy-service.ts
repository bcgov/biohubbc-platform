import { IDBConnection } from '../../database/db';
import { CreatePolicy } from '../../models/policy';
import { PolicyEffect } from '../../models/policy-statement';
import { PolicyRepository } from '../../repositories/authorization/policy-repository';
import { PolicyExpressionService } from '../access-policy/policy-expression-service';
import { PolicyStatementService } from '../access-policy/policy-statement-service';
import { DBService } from '../db-service';

export interface CreateDownloadPolicyPayload {
  name: string;
  description: string | null;
  expressionId: string | null;
}

export class DownloadPolicyService extends DBService {
  policyRepository: PolicyRepository;
  policyStatementService: PolicyStatementService;
  policyExpressionService: PolicyExpressionService;

  /**
   * Build a download-policy service.
   *
   * @param {IDBConnection} connection - Active database connection.
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.policyRepository = new PolicyRepository(connection);
    this.policyStatementService = new PolicyStatementService(connection);
    this.policyExpressionService = new PolicyExpressionService(connection);
  }

  /**
   * Create a download's owning policy: one policy + one wildcard statement.
   * Request-created downloads pass an expression id; a few lower-level tests
   * and setup helpers still create broad policies directly.
   *
   * Download policies define the feature set to export, not who can read it. Skipping
   * team_policy / team_security_scope grants keeps create-download from being a
   * backdoor for granting access; export-time enforcement is the security boundary.
   *
   * The policy is created with status 'approved' on insert, bypassing the pending ->
   * reviewed -> approved review flow that PolicyService.updatePolicy enforces. Download
   * policies have no review step - exporting one's own search result does not warrant
   * gating, and the access check at export time is what prevents data exposure.
   *
   * @param {CreateDownloadPolicyPayload} payload - Download-policy payload.
   * @return {Promise<{ policy_id: string }>} The new policy identifier.
   * @memberof DownloadPolicyService
   */
  async createDownloadPolicy(payload: CreateDownloadPolicyPayload): Promise<{ policy_id: string }> {
    const policyData: CreatePolicy = {
      name: payload.name,
      description: payload.description ?? undefined,
      status: 'approved'
    };

    const policy = await this.policyRepository.insertPolicy(policyData);
    const policyExpression =
      payload.expressionId === null
        ? null
        : await this.policyExpressionService.ensurePolicyExpression({
            policyId: policy.policy_id,
            expressionId: payload.expressionId
          });

    await this.policyStatementService.createPolicyStatement({
      policy_id: policy.policy_id,
      effect: PolicyEffect.ALLOW,
      submission_feature_urn: 'urn:*:*:*',
      policy_expression_id: policyExpression?.policy_expression_id ?? null
    });

    return { policy_id: policy.policy_id };
  }
}
