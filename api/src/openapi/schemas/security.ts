import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';

/**
 * Schema for the summary of security rules applied to submission features.
 */
export const SubmissionFeatureSecuritySummarySchema: OpenAPIV3.SchemaObject = {
  title: 'SubmissionFeatureSecurityRulesSummary',
  type: 'object',
  required: ['rules'],
  properties: {
    rules: {
      type: 'array',
      description: 'List of security rules applied to the submission features, with counts',
      items: {
        type: 'object',
        required: ['security_rule_id', 'count'],
        properties: {
          security_rule_id: {
            type: 'integer',
            description: 'ID of the security rule'
          },
          count: {
            type: 'integer',
            description: 'Number of features this rule is applied to'
          }
        }
      }
    }
  }
};

/**
 * Schema for a security category with rule count.
 */
export const SecurityCategoryWithRuleCountSchema: OpenAPIV3.SchemaObject = {
  title: 'SecurityCategoryWithRuleCount',
  type: 'object',
  required: ['security_category_id', 'name', 'description', 'rule_count'],
  properties: {
    security_category_id: {
      type: 'integer',
      description: 'Unique identifier for the security category'
    },
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Name of the security category'
    },
    description: {
      type: 'string',
      maxLength: 500,
      description: 'Description of the security category'
    },
    rule_count: {
      type: 'integer',
      description: 'Number of active security rules in this category'
    }
  }
};

/**
 * Schema for paginated security categories list response.
 */
export const SecurityCategoriesListResponseSchema: OpenAPIV3.SchemaObject = {
  title: 'SecurityCategoriesListResponse',
  type: 'object',
  required: ['categories', 'pagination'],
  properties: {
    categories: {
      type: 'array',
      items: SecurityCategoryWithRuleCountSchema,
      description: 'List of security categories with rule counts'
    },
    pagination: paginationResponseSchema
  }
};

/**
 * Schema for a security rule with feature count.
 */
export const SecurityRuleWithFeatureCountSchema: OpenAPIV3.SchemaObject = {
  title: 'SecurityRuleWithFeatureCount',
  type: 'object',
  required: ['security_rule_id', 'name', 'description', 'feature_count'],
  properties: {
    security_rule_id: {
      type: 'integer',
      description: 'Unique identifier for the security rule'
    },
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Name of the security rule'
    },
    description: {
      type: 'string',
      maxLength: 500,
      description: 'Description of the security rule'
    },
    feature_count: {
      type: 'integer',
      description: 'Number of submission features secured by this rule'
    }
  }
};

/**
 * Schema for paginated security reasons list response.
 */
export const SecurityReasonsListResponseSchema: OpenAPIV3.SchemaObject = {
  title: 'SecurityReasonsListResponse',
  type: 'object',
  required: ['reasons', 'pagination'],
  properties: {
    reasons: {
      type: 'array',
      items: SecurityRuleWithFeatureCountSchema,
      description: 'List of security reasons with feature counts'
    },
    pagination: paginationResponseSchema
  }
};
