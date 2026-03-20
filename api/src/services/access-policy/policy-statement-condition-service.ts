import { IDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { FeaturePropertyTypeName } from '../../models/feature-property';
import {
  CreatePolicyStatementCondition,
  PolicyConditionOperator,
  PolicyStatementCondition
} from '../../models/policy-statement-condition';
import { PolicyStatementConditionRepository } from '../../repositories/authorization/policy-statement-condition-repository';
import { CodeRepository } from '../../repositories/code-repository';
import {
  ALLOWED_OPERATORS_BY_PROPERTY_TYPE,
  DATE_OPERATORS,
  isNumberArray,
  isObject,
  isStringArray,
  SPATIAL_OPERATORS,
  STRING_OPERATORS
} from '../../utils/policy-condition-utils';
import { DBService } from '../db-service';

export class PolicyStatementConditionService extends DBService {
  codeRepository: CodeRepository;
  policyStatementConditionRepository: PolicyStatementConditionRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.codeRepository = new CodeRepository(connection);
    this.policyStatementConditionRepository = new PolicyStatementConditionRepository(connection);
  }

  /**
   * Create a new policy statement condition record.
   *
   * @param {CreatePolicyStatementCondition} policyStatementConditionData - Data required to create a new policy statement condition.
   * @return {Promise<PolicyStatementCondition>} - The created policy statement condition record.
   * @memberof PolicyStatementConditionService
   */
  async createPolicyStatementCondition(
    policyStatementConditionData: CreatePolicyStatementCondition
  ): Promise<PolicyStatementCondition> {
    const featureProperty = await this.codeRepository.getFeaturePropertyByName(policyStatementConditionData.key);
    this.validatePolicyCondition(
      policyStatementConditionData.key,
      policyStatementConditionData.operator,
      policyStatementConditionData.value,
      featureProperty.feature_property_type_name
    );

    return this.policyStatementConditionRepository.insertPolicyStatementCondition(policyStatementConditionData);
  }

  /**
   * Retrieve a policy statement condition record
   *
   * @param {string} policyStatementConditionId - The ID of the policy statement condition to fetch.
   * @return {Promise<PolicyStatementCondition>} - The policy statement condition record.
   * @memberof PolicyStatementConditionService
   */
  getPolicyStatementCondition(policyStatementConditionId: string): Promise<PolicyStatementCondition> {
    return this.policyStatementConditionRepository.getPolicyStatementCondition(policyStatementConditionId);
  }

  /**
   * Retrieve all policy statement condition records for a given policy statement.
   *
   * @param {string} policyStatementId - The ID of the policy statement to fetch conditions for.
   * @return {Promise<PolicyStatementCondition[]>} - The policy statement condition records.
   * @memberof PolicyStatementConditionService
   */
  getPolicyStatementConditions(policyStatementId: string): Promise<PolicyStatementCondition[]> {
    return this.policyStatementConditionRepository.getPolicyStatementConditions(policyStatementId);
  }

  /**
   * Delete a policy statement condition record.
   *
   * @param {string} policyStatementConditionId - The id of the policy statement condition to delete
   * @return {Promise<void>}
   * @memberof PolicyStatementConditionService
   */
  async deletePolicyStatementCondition(policyStatementConditionId: string): Promise<void> {
    await this.policyStatementConditionRepository.deletePolicyStatementCondition(policyStatementConditionId);
  }

  validatePolicyCondition(
    key: string,
    operator: CreatePolicyStatementCondition['operator'],
    value: unknown,
    propertyTypeName: FeaturePropertyTypeName | 'datetime' | 'spatial' | 'array'
  ): void {
    const allowedOperators = ALLOWED_OPERATORS_BY_PROPERTY_TYPE[propertyTypeName];

    this.assertCondition(`Unknown property type: ${propertyTypeName}`, !!allowedOperators);
    this.assertCondition(
      `Operator ${operator} is not valid for property type ${propertyTypeName}`,
      allowedOperators.includes(operator)
    );

    if (operator === PolicyConditionOperator.BOOL || operator === PolicyConditionOperator.EXISTS) {
      this.assertCondition(`${operator} operator requires a boolean value`, typeof value === 'boolean');
      return;
    }

    if (operator === PolicyConditionOperator.NUMERIC_EQUALS) {
      const isValidNumber = typeof value === 'number' && Number.isFinite(value);
      this.assertCondition('NumericEquals requires a number or array of numbers', isValidNumber || isNumberArray(value));
      return;
    }

    if (STRING_OPERATORS.has(operator)) {
      this.assertCondition(
        `${operator} requires a string or array of strings`,
        typeof value === 'string' || isStringArray(value)
      );
      return;
    }

    if (DATE_OPERATORS.has(operator)) {
      this.assertCondition(
        `${operator} requires a date string or array of date strings`,
        typeof value === 'string' || isStringArray(value)
      );
      return;
    }

    if (SPATIAL_OPERATORS.has(operator)) {
      this.assertCondition(`${operator} requires a GeoJSON-like object value`, isObject(value));
      this.assertCondition(
        `${operator} requires a GeoJSON-like object with a "type" field`,
        isObject(value) && typeof value.type === 'string'
      );
      return;
    }

    throw new HTTP400(`Unsupported policy condition operator: ${operator} for key ${key}`);
  }

  private assertCondition(message: string, condition: boolean): void {
    if (!condition) {
      throw new HTTP400(message);
    }
  }
}
