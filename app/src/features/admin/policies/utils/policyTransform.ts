import { ICreatePolicyStatementRequest, IPolicy, IPolicyStatement } from 'interfaces/usePoliciesApi.interface';

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
}

/**
 * Result type for policy JSON validation.
 * Discriminated union that provides the parsed policy on success, or an error message on failure.
 */
export type PolicyValidationResult = { valid: true; policy: IPolicyDocument } | { valid: false; error: string };

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
 * Transform a JSON policy document string to API format for submission.
 *
 * @param {string} policyJson - JSON string representing the policy document (IPolicyDocument structure)
 * @returns {ICreatePolicyStatementRequest[]} Array of policy statement requests ready for API submission
 */
export const transformPolicyJsonToApi = (policyJson: string): ICreatePolicyStatementRequest[] => {
  const policy: IPolicyDocument = JSON.parse(policyJson);

  return policy.Statement.map((stmt) => ({
    effect: stmt.Effect.toLowerCase() as 'allow' | 'deny',
    submission_feature_urn: stmt.Resource
  }));
};

/**
 * Transform API policy statement data to JSON document format for editing in the Monaco editor.
 *
 * @param {IPolicyStatement[]} statements - Array of policy statements from the API
 * @returns {string} Formatted JSON string representing the policy document
 */
export const transformApiToPolicyJson = (statements: IPolicyStatement[]): string => {
  const policy: IPolicyDocument = {
    Version: '2025-12-01',
    Statement: statements.map((stmt) => ({
      Effect: stmt.effect === 'allow' ? 'Allow' : 'Deny',
      Resource: stmt.submission_feature_urn
    }))
  };

  return JSON.stringify(policy, null, 2);
};

/**
 * Transform a full policy object to JSON document format for editing in the Monaco editor.
 *
 * @param {IPolicy} policy - The complete policy object from the API (includes metadata and statements)
 * @returns {string} Formatted JSON string representing the policy document
 */
export const transformPolicyToJson = (policy: IPolicy): string => {
  return transformApiToPolicyJson(policy.statements);
};

const URN_PATTERN = /^urn:(\*|\d+):(\*|[a-z_]+):(\*|\d+)$/;

/**
 * Validate a single policy statement object.
 *
 * @param {Partial<IPolicyDocumentStatement>} stmt - The statement object to validate (expects Effect and Resource properties)
 * @param {number} index - Zero-based index of this statement in the policy's Statement array (used for error messages)
 * @returns {string | null} Error message if validation fails, null if valid
 */
const validateStatement = (stmt: Partial<IPolicyDocumentStatement>, index: number): string | null => {
  if (!stmt.Effect || !['Allow', 'Deny'].includes(stmt.Effect)) {
    return `Statement ${index + 1}: Effect must be "Allow" or "Deny"`;
  }
  if (!stmt.Resource) {
    return `Statement ${index + 1}: Resource is required`;
  }
  if (!URN_PATTERN.test(stmt.Resource)) {
    return `Statement ${index + 1}: Invalid Resource URN format. Expected: urn:<submissionId>:<featureType>:<featureId>`;
  }
  return null;
};

/**
 * Validate a policy JSON string for structural correctness.
 *
 * @param {string} policyJson - JSON string representing the policy document to validate
 * @returns {PolicyValidationResult} Validation result with parsed policy on success, or error message on failure
 */
export const validatePolicyJson = (policyJson: string): PolicyValidationResult => {
  try {
    const policy = JSON.parse(policyJson);

    if (!policy.Version) {
      return { valid: false, error: 'Policy must have a Version field' };
    }
    if (!policy.Statement || !Array.isArray(policy.Statement)) {
      return { valid: false, error: 'Policy must have a Statement array' };
    }
    if (policy.Statement.length === 0) {
      return { valid: false, error: 'Policy must have at least one statement' };
    }

    for (let i = 0; i < policy.Statement.length; i++) {
      const error = validateStatement(policy.Statement[i], i);
      if (error) {
        return { valid: false, error };
      }
    }

    return { valid: true, policy: policy as IPolicyDocument };
  } catch (e) {
    const error = e as SyntaxError;
    return { valid: false, error: `Invalid JSON: ${error.message}` };
  }
};
