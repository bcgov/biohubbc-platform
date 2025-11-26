import { IDBConnection } from '../../database/db';
import { parseFeatureUrn } from '../../database/urn-utils';
import { CreatePolicy, Policy, UpdatePolicy } from '../../models/policy';
import { PolicyRepository } from '../../repositories/authorization/policy-repository';
import { DBService } from '../db-service';

export class PolicyService extends DBService {
  policyRepository: PolicyRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.policyRepository = new PolicyRepository(connection);
  }

  /**
   * Create a new policy record.
   *
   * @param {CreatePolicy} policyData - Data required to create a new policy.
   * @return {Promise<Policy>} - The created policy record.
   * @memberof PolicyService
   */
  createPolicy(policyData: CreatePolicy): Promise<Policy> {
    return this.policyRepository.insertPolicy(policyData);
  }

  /**
   * Retrieve a policy record
   *
   * @param {string} policyId - The ID of the policy to fetch.
   * @return {Promise<Policy>}
   * @memberof PolicyService
   */
  getPolicy(policyId: string): Promise<Policy> {
    return this.policyRepository.getPolicy(policyId);
  }

  /**
   * Retrieve policies
   *
   * @return {Promise<Policy[]>}
   * @memberof PolicyService
   */
  getPolicies(): Promise<Policy[]> {
    return this.policyRepository.getPolicies();
  }

  /**
   * Retrieve a policy record
   *
   * @param {string} urn
   * @param {number} systemUserId
   * @return {Promise<Policy[]>}
   * @memberof PolicyService
   */
  getPoliciesThatAuthorizeFeatureAccessByUrn(urn: string, systemUserId: number): Promise<Policy[]> {
    const urnParts = parseFeatureUrn(urn);
    return this.policyRepository.getPoliciesThatAuthorizeFeatureAccessByUrn(urnParts, systemUserId);
  }

  /**
   * Update an existing policy record.
   *
   * @param {string} policyId - The ID of the policy to update.
   * @param {UpdatePolicy} policyData - Partial data to update the policy record.
   * @return {Promise<Policy>} - The updated policy record.
   * @memberof PolicyService
   */
  updatePolicy(policyId: string, policyData: UpdatePolicy): Promise<Policy> {
    return this.policyRepository.updatePolicy(policyId, policyData);
  }

  /**
   * Delete a policy record.
   *
   * @param {string} policyId - The id of the policy to delete
   * @return {Promise<void>}
   * @memberof PolicyService
   */
  deletePolicy(policyId: string): Promise<void> {
    return this.policyRepository.deletePolicy(policyId);
  }
}
