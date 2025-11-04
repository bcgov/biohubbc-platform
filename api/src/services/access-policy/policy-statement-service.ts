import { IDBConnection } from '../../database/db';
import { CreatePolicyStatement, PolicyStatement, UpdatePolicyStatement } from '../../models/policy-statement';
import { PolicyStatementRepository } from '../../repositories/authorization/policy-statement-repository';
import { DBService } from '../db-service';

export class PolicyStatementService extends DBService {
  policyStatementRepository: PolicyStatementRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.policyStatementRepository = new PolicyStatementRepository(connection);
  }

  /**
   * Create a new policy statement record.
   *
   * @param {CreatePolicyStatement} policyStatementData - Data required to create a new policy statement.
   * @return {Promise<PolicyStatement>} - The created policy statement record.
   * @memberof PolicyStatementService
   */
  createPolicyStatement(policyStatementData: CreatePolicyStatement): Promise<PolicyStatement> {
    return this.policyStatementRepository.insertPolicyStatement(policyStatementData);
  }

  /**
   * Retrieve a policy statement record
   *
   * @param {string} policyStatementId - The ID of the policy statement to fetch.
   * @return {Promise<PolicyStatement>} - The policy statement record.
   * @memberof PolicyStatementService
   */
  getPolicyStatement(policyStatementId: string): Promise<PolicyStatement> {
    return this.policyStatementRepository.getPolicyStatement(policyStatementId);
  }

  /**
   * Retrieve multiple policy statement records for a policy
   *
   * @param {string} policyId - The ID of the policy to fetch statements for.
   * @return {Promise<PolicyStatement[]>} - The policy statement records.
   * @memberof PolicyStatementService
   */
  getPolicyStatements(policyId: string): Promise<PolicyStatement[]> {
    return this.policyStatementRepository.getPolicyStatements(policyId);
  }

  /**
   * Update an existing policy statement record.
   *
   * @param {string} policyStatementId - The ID of the policy statement to update.
   * @param {UpdatePolicyStatement} policyStatementData - Partial data to update the policy statement record.
   * @return {Promise<PolicyStatement>} - The updated policy statement record.
   * @memberof PolicyStatementService
   */
  updatePolicyStatement(
    policyStatementId: string,
    policyStatementData: UpdatePolicyStatement
  ): Promise<PolicyStatement> {
    return this.policyStatementRepository.updatePolicyStatement(policyStatementId, policyStatementData);
  }

  /**
   * Delete a policy statement record.
   *
   * @param {string} policyStatementId - The id of the policy statement to delete
   * @return {Promise<void>}
   * @memberof PolicyStatementService
   */
  async deletePolicyStatement(policyStatementId: string): Promise<void> {
    await this.policyStatementRepository.deletePolicyStatement(policyStatementId);
  }
}
