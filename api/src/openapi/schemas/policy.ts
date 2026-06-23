/**
 * OpenAPI schemas for Policy endpoints.
 *
 * These schemas define the API contract for policy management operations.
 */

import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';
import { featureSearchExpressionTreeSchema } from './search/search-feature';

/**
 * Schema for policy statement with optional policy-expression link.
 */
export const PolicyStatementWithExpressionSchema: OpenAPIV3.SchemaObject = {
  title: 'PolicyStatementWithExpression',
  type: 'object',
  required: [
    'policy_statement_id',
    'policy_id',
    'effect',
    'security_scope_id',
    'submission_feature_urn',
    'policy_expression_id'
  ],
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
    security_scope_id: {
      type: 'string',
      format: 'uuid',
      description: 'Reusable security scope this policy-specific statement references'
    },
    submission_feature_urn: {
      type: 'string',
      description: 'The URN pattern this statement applies to'
    },
    policy_expression_id: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'Optional policy-owned expression linked to this statement'
    }
  }
};

/**
 * Schema for a policy-owned expression with its hydrated expression tree.
 */
export const PolicyExpressionWithExpressionSchema: OpenAPIV3.SchemaObject = {
  title: 'PolicyExpressionWithExpression',
  type: 'object',
  required: ['policy_expression_id', 'policy_id', 'expression_id', 'name', 'description', 'expression'],
  properties: {
    policy_expression_id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the policy expression'
    },
    policy_id: {
      type: 'string',
      format: 'uuid',
      description: 'The policy this expression belongs to'
    },
    expression_id: {
      type: 'string',
      format: 'uuid',
      description: 'The stored root expression identifier'
    },
    name: {
      type: 'string',
      maxLength: 100,
      nullable: true,
      description: 'Name of the policy expression'
    },
    description: {
      type: 'string',
      maxLength: 1000,
      nullable: true,
      description: 'Description of the policy expression'
    },
    expression: {
      ...featureSearchExpressionTreeSchema,
      description: 'Expression tree for this policy expression'
    }
  }
};

/**
 * Schema for a policy (without statements).
 */
export const PolicySchema: OpenAPIV3.SchemaObject = {
  title: 'Policy',
  type: 'object',
  required: ['policy_id', 'name', 'status'],
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
    status: {
      type: 'string',
      enum: ['requested', 'reviewed', 'approved', 'denied'],
      description: 'Lifecycle state of the policy'
    }
  }
};

/**
 * Schema for a policy with its statements.
 */
export const PolicyWithStatementsSchema: OpenAPIV3.SchemaObject = {
  title: 'PolicyWithStatements',
  type: 'object',
  required: ['policy_id', 'name', 'status', 'statements', 'expressions'],
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
    status: {
      type: 'string',
      enum: ['requested', 'reviewed', 'approved', 'denied'],
      description: 'Lifecycle state of the policy'
    },
    statements: {
      type: 'array',
      items: PolicyStatementWithExpressionSchema,
      description: 'Policy statements'
    },
    expressions: {
      type: 'array',
      items: PolicyExpressionWithExpressionSchema,
      description: 'Policy expressions'
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
    pagination: paginationResponseSchema
  }
};

/**
 * Schema for paginated policy expressions list response.
 */
export const PolicyExpressionsListResponseSchema: OpenAPIV3.SchemaObject = {
  title: 'PolicyExpressionsListResponse',
  type: 'object',
  required: ['expressions', 'pagination'],
  properties: {
    expressions: {
      type: 'array',
      items: PolicyExpressionWithExpressionSchema,
      description: 'List of policy expressions'
    },
    pagination: paginationResponseSchema
  }
};

/**
 * Schema for creating a policy statement payload.
 */
export const CreatePolicyStatementPayloadSchema: OpenAPIV3.SchemaObject = {
  title: 'CreatePolicyStatementPayload',
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
    policy_expression_id: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'Optional existing policy expression to link to this statement'
    }
  }
};

/**
 * Schema for create policy expression request body.
 */
export const CreatePolicyExpressionRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'CreatePolicyExpressionRequest',
  type: 'object',
  additionalProperties: false,
  required: ['name', 'expression'],
  properties: {
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Name of the policy expression'
    },
    description: {
      type: 'string',
      maxLength: 1000,
      nullable: true,
      description: 'Description of the policy expression'
    },
    expression: {
      ...featureSearchExpressionTreeSchema,
      description:
        'Expression tree. Predicate operators and value shapes are validated server-side based on selected property metadata.'
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
      items: CreatePolicyStatementPayloadSchema,
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
    status: {
      type: 'string',
      enum: ['requested', 'reviewed', 'approved', 'denied'],
      description: 'Optional lifecycle state for the policy'
    },
    statements: {
      type: 'array',
      items: CreatePolicyStatementPayloadSchema,
      description: 'Policy statements (replaces existing)'
    }
  }
};

/**
 * Schema for status-only policy update request body.
 */
export const UpdatePolicyStatusRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'UpdatePolicyStatusRequest',
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: {
      type: 'string',
      enum: ['requested', 'reviewed', 'approved', 'denied'],
      description: 'Lifecycle state for the policy'
    }
  }
};
