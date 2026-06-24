import { IDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { CreatePolicy } from '../../models/policy';
import { PolicyEffect } from '../../models/policy-statement';
import { PolicyRepository } from '../../repositories/authorization/policy-repository';
import { FeatureIngestionRepository } from '../../repositories/ingestion/feature-ingestion-repository';
import { PolicyExpressionService } from '../access-policy/policy-expression-service';
import { PolicyStatementService } from '../access-policy/policy-statement-service';
import { DBService } from '../db-service';

export interface CreateDownloadPolicyPayload {
  name: string;
  description: string | null;
  featureTypes: string[];
  expressionId: string | null;
}

export class DownloadPolicyService extends DBService {
  policyRepository: PolicyRepository;
  policyStatementService: PolicyStatementService;
  policyExpressionService: PolicyExpressionService;
  featureIngestionRepository: FeatureIngestionRepository;

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
    this.featureIngestionRepository = new FeatureIngestionRepository(connection);
  }

  /**
   * Create a download's owning policy: one policy + N statements (one per feature type)
   * + optional expression links (one per statement when an expression is provided).
   *
   * Download policies define the feature set to export, not who can read it. Skipping
   * team_policy / security_scope here keeps create-download from being a backdoor for
   * granting access; export-time enforcement is the security boundary.
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
    // Reject unknown feature type names up front so a typo or stale FE id doesn't silently
    // produce a download with empty Parquet files. The check is per-create rather than at
    // app start because feature_type rows can be added/retired between deploys; one extra
    // SELECT per request is cheap (~10 rows in seed; bounded by domain size).
    const activeFeatureTypes = await this.featureIngestionRepository.getActiveFeatureTypeMap();
    const knownNames = new Set(activeFeatureTypes.map((row) => row.name));
    const unknown = payload.featureTypes.filter((name) => !knownNames.has(name));
    if (unknown.length > 0) {
      throw new HTTP400('Unknown feature type(s)', [{ unknownFeatureTypes: unknown }]);
    }

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

    for (const featureType of payload.featureTypes) {
      await this.policyStatementService.createPolicyStatement({
        policy_id: policy.policy_id,
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: `urn:*:${featureType}:*`,
        policy_expression_id: policyExpression?.policy_expression_id ?? null
      });
    }

    return { policy_id: policy.policy_id };
  }
}
