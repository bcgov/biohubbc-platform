import { ICreatePolicyStatementRequest, IPolicy, IPolicyStatement } from 'interfaces/usePoliciesApi.interface';
import { PolicyConditionOperator } from './policyJsonSchema';

/**
 * JSON Policy document structure (for Monaco editor).
 */
export interface IPolicyDocument {
  Version: string;
  Statement: IPolicyDocumentStatement[];
}

/**
 * JSON Policy statement structure.
 */
export interface IPolicyDocumentStatement {
  Effect: 'Allow' | 'Deny';
  Resource: string;
  Condition?: IPolicyDocumentCondition[];
}

/**
 * JSON Policy condition structure.
 */
export interface IPolicyDocumentCondition {
  Operator: PolicyConditionOperator;
  Key: string;
  Value: unknown;
}

/**
 * Default empty policy document.
 */
export const defaultPolicyDocument: IPolicyDocument = {
  Version: '2025-12-01',
  Statement: [
    {
      Effect: 'Allow',
      Resource: 'urn:*:*:*'
    }
  ]
};

/**
 * Condition values are stored in a PostgreSQL jsonb column.
 * When we insert, we use JSON.stringify() to convert the JavaScript value to JSON.
 * PostgreSQL automatically parses jsonb when reading, so the value comes back
 * as the correct JavaScript type - no additional parsing needed.
 *
 * For example:
 * - JS string "333" → stored as JSON '"333"' → returned as JS string "333"
 * - JS number 333 → stored as JSON '333' → returned as JS number 333
 * - JS object {a:1} → stored as JSON '{"a":1}' → returned as JS object {a:1}
 */
const parseConditionValue = (value: unknown): unknown => {
  // PostgreSQL jsonb already parses the value, return as-is
  return value;
};

/**
 * Transform JSON policy document to API format for submission.
 */
export const transformPolicyJsonToApi = (policyJson: string): ICreatePolicyStatementRequest[] => {
  const policy: IPolicyDocument = JSON.parse(policyJson);

  return policy.Statement.map((stmt) => ({
    effect: stmt.Effect.toLowerCase() as 'allow' | 'deny',
    submission_feature_urn: stmt.Resource,
    conditions: stmt.Condition?.map((cond) => ({
      operator: cond.Operator,
      key: cond.Key,
      // Stringify the value for JSON storage in the database
      value: JSON.stringify(cond.Value)
    }))
  }));
};

/**
 * Transform API policy data to JSON document format for editing.
 */
export const transformApiToPolicyJson = (statements: IPolicyStatement[]): string => {
  const policy: IPolicyDocument = {
    Version: '2025-12-01',
    Statement: statements.map((stmt) => ({
      Effect: stmt.effect === 'allow' ? 'Allow' : 'Deny',
      Resource: stmt.submission_feature_urn,
      ...(stmt.conditions &&
        stmt.conditions.length > 0 && {
          Condition: stmt.conditions.map((cond) => ({
            Operator: cond.operator as PolicyConditionOperator,
            Key: cond.key,
            // Parse the value - try JSON.parse first, fall back to raw value if it fails
            Value: parseConditionValue(cond.value)
          }))
        })
    }))
  };

  return JSON.stringify(policy, null, 2);
};

/**
 * Transform full policy object to JSON document format for editing.
 */
export const transformPolicyToJson = (policy: IPolicy): string => {
  return transformApiToPolicyJson(policy.statements);
};

const URN_PATTERN = /^urn:(\*|\d+):(\*|[a-z_]+):(\*|\d+)$/;

/**
 * Validate a single condition object.
 */
const validateCondition = (cond: any, stmtIndex: number, condIndex: number): string | null => {
  if (!cond.Operator) {
    return `Statement ${stmtIndex + 1}, Condition ${condIndex + 1}: Operator is required`;
  }
  if (!cond.Key) {
    return `Statement ${stmtIndex + 1}, Condition ${condIndex + 1}: Key is required`;
  }
  if (cond.Value === undefined) {
    return `Statement ${stmtIndex + 1}, Condition ${condIndex + 1}: Value is required`;
  }
  return null;
};

/**
 * Validate conditions array for a statement.
 */
const validateConditions = (conditions: any, stmtIndex: number): string | null => {
  if (!Array.isArray(conditions)) {
    return `Statement ${stmtIndex + 1}: Condition must be an array`;
  }
  for (let j = 0; j < conditions.length; j++) {
    const error = validateCondition(conditions[j], stmtIndex, j);
    if (error) {
      return error;
    }
  }
  return null;
};

/**
 * Validate a single statement object.
 */
const validateStatement = (stmt: any, index: number): string | null => {
  if (!stmt.Effect || !['Allow', 'Deny'].includes(stmt.Effect)) {
    return `Statement ${index + 1}: Effect must be "Allow" or "Deny"`;
  }
  if (!stmt.Resource) {
    return `Statement ${index + 1}: Resource is required`;
  }
  if (!URN_PATTERN.test(stmt.Resource)) {
    return `Statement ${index + 1}: Invalid Resource URN format. Expected: urn:<submissionId>:<featureType>:<featureId>`;
  }
  if (stmt.Condition) {
    return validateConditions(stmt.Condition, index);
  }
  return null;
};

/**
 * Validate policy JSON string.
 * Returns null if valid, error message if invalid.
 *
 * Note: This performs basic structural validation only. Detailed validation
 * (operator/key/value compatibility) is handled by the database trigger
 * tr_validate_policy_condition_key().
 */
export const validatePolicyJson = (policyJson: string): string | null => {
  try {
    const policy = JSON.parse(policyJson);

    if (!policy.Version) {
      return 'Policy must have a Version field';
    }
    if (!policy.Statement || !Array.isArray(policy.Statement)) {
      return 'Policy must have a Statement array';
    }
    if (policy.Statement.length === 0) {
      return 'Policy must have at least one statement';
    }

    for (let i = 0; i < policy.Statement.length; i++) {
      const error = validateStatement(policy.Statement[i], i);
      if (error) {
        return error;
      }
    }

    return null;
  } catch {
    return 'Invalid JSON';
  }
};
