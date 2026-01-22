/**
 * OpenAPI schemas for Policy endpoints.
 *
 * These schemas define the API contract for policy management operations.
 */

import { OpenAPIV3 } from 'openapi-types';

/**
 * Schema for policy statement condition.
 */
export const PolicyStatementConditionSchema: OpenAPIV3.SchemaObject = {
  title: 'PolicyStatementCondition',
  type: 'object',
  required: ['policy_statement_condition_id', 'policy_statement_id', 'operator', 'key', 'value'],
  properties: {
    policy_statement_condition_id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the condition'
    },
    policy_statement_id: {
      type: 'string',
      format: 'uuid',
      description: 'The policy statement this condition belongs to'
    },
    operator: {
      type: 'string',
      enum: [
        'StringEquals',
        'StringNotEquals',
        'StringLike',
        'NumericEquals',
        'Bool',
        'Exists',
        'DateBefore',
        'DateAfter',
        'Within',
        'Intersects',
        'Contains',
        'ParentOf',
        'ChildOf'
      ],
      description: 'The comparison operator for the condition'
    },
    key: {
      type: 'string',
      maxLength: 500,
      description: 'The key to evaluate'
    },
    value: {
      description: 'The value to compare against'
    }
  }
};

/**
 * Schema for policy statement with conditions.
 */
export const PolicyStatementWithConditionsSchema: OpenAPIV3.SchemaObject = {
  title: 'PolicyStatementWithConditions',
  type: 'object',
  required: ['policy_statement_id', 'policy_id', 'effect', 'submission_feature_urn', 'conditions'],
  properties: {
    policy_statement_id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the statement'
    },
    policy_id: {
      type: 'string',
      format: 'uuid',
      description: 'The policy this statement belongs to'
    },
    effect: {
      type: 'string',
      enum: ['allow', 'deny'],
      description: 'Whether the statement allows or denies access'
    },
    submission_feature_urn: {
      type: 'string',
      maxLength: 500,
      description: 'The URN pattern this statement applies to'
    },
    conditions: {
      type: 'array',
      items: PolicyStatementConditionSchema,
      description: 'Conditions that must be met for this statement to apply'
    }
  }
};

/**
 * Schema for a policy (without statements).
 */
export const PolicySchema: OpenAPIV3.SchemaObject = {
  title: 'Policy',
  type: 'object',
  required: ['policy_id', 'name'],
  properties: {
    policy_id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the policy'
    },
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Name of the policy'
    },
    description: {
      type: 'string',
      maxLength: 1000,
      nullable: true,
      description: 'Description of the policy'
    }
  }
};

/**
 * Schema for a policy with its statements and conditions.
 */
export const PolicyWithStatementsSchema: OpenAPIV3.SchemaObject = {
  title: 'PolicyWithStatements',
  type: 'object',
  required: ['policy_id', 'name', 'statements'],
  properties: {
    policy_id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the policy'
    },
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Name of the policy'
    },
    description: {
      type: 'string',
      maxLength: 1000,
      nullable: true,
      description: 'Description of the policy'
    },
    statements: {
      type: 'array',
      items: PolicyStatementWithConditionsSchema,
      description: 'Policy statements with their conditions'
    }
  }
};

/**
 * Schema for paginated policies list response.
 */
export const PoliciesListResponseSchema: OpenAPIV3.SchemaObject = {
  title: 'PoliciesListResponse',
  type: 'object',
  required: ['policies', 'pagination'],
  properties: {
    policies: {
      type: 'array',
      items: PolicyWithStatementsSchema,
      description: 'List of policies with statements'
    },
    pagination: {
      type: 'object',
      required: ['total', 'page', 'limit'],
      properties: {
        total: {
          type: 'integer',
          description: 'Total number of policies'
        },
        page: {
          type: 'integer',
          description: 'Current page number (0-indexed)'
        },
        limit: {
          type: 'integer',
          description: 'Number of items per page'
        }
      }
    }
  }
};

/**
 * Schema for creating a policy statement (request input).
 */
export const CreatePolicyStatementInputSchema: OpenAPIV3.SchemaObject = {
  title: 'CreatePolicyStatementInput',
  type: 'object',
  required: ['effect', 'submission_feature_urn'],
  properties: {
    effect: {
      type: 'string',
      enum: ['allow', 'deny'],
      description: 'Whether the statement allows or denies access'
    },
    submission_feature_urn: {
      type: 'string',
      maxLength: 500,
      description: 'The URN pattern this statement applies to'
    },
    conditions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['operator', 'key', 'value'],
        properties: {
          operator: {
            type: 'string',
            enum: [
              'StringEquals',
              'StringNotEquals',
              'StringLike',
              'NumericEquals',
              'Bool',
              'Exists',
              'DateBefore',
              'DateAfter',
              'Within',
              'Intersects',
              'Contains',
              'ParentOf',
              'ChildOf'
            ],
            description: 'The comparison operator'
          },
          key: {
            type: 'string',
            maxLength: 500,
            description: 'The key to evaluate'
          },
          value: {
            description: 'The value to compare against'
          }
        }
      },
      description: 'Optional conditions for this statement'
    }
  }
};

/**
 * Schema for create policy request body.
 */
export const CreatePolicyRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'CreatePolicyRequest',
  type: 'object',
  required: ['name', 'statements'],
  properties: {
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Name of the policy'
    },
    description: {
      type: 'string',
      maxLength: 1000,
      description: 'Description of the policy'
    },
    statements: {
      type: 'array',
      items: CreatePolicyStatementInputSchema,
      description: 'Policy statements to create'
    }
  }
};

/**
 * Schema for update policy request body.
 */
export const UpdatePolicyRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'UpdatePolicyRequest',
  type: 'object',
  required: ['name', 'statements'],
  properties: {
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Name of the policy'
    },
    description: {
      type: 'string',
      maxLength: 1000,
      description: 'Description of the policy'
    },
    statements: {
      type: 'array',
      items: CreatePolicyStatementInputSchema,
      description: 'Policy statements (replaces existing)'
    }
  }
};
