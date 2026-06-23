/**
 * OpenAPI schemas for Policy endpoints.
 *
 * These schemas define the API contract for policy management operations.
 */

import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';
import { featureSearchExpressionTreeSchema } from './search/search-feature';

/**
 * Schema for policy statement with optional expression.
 */
export const PolicyStatementWithExpressionSchema: OpenAPIV3.SchemaObject = {
  title: 'PolicyStatementWithExpression',
  type: 'object',
  required: ['policy_statement_id', 'policy_id', 'effect', 'submission_feature_urn'],
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
    expression: {
      ...featureSearchExpressionTreeSchema,
      description: 'Optional expression tree that builds the runtime feature graph for this statement'
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
  required: ['policy_id', 'name', 'status', 'statements'],
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
    expression: {
      ...featureSearchExpressionTreeSchema,
      description:
        'Optional expression tree. Predicate operators and value shapes are validated server-side based on selected property metadata.'
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
