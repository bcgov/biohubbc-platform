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
      nullable: true,
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
 * Schema for a security category (admin CRUD response).
 */
export const SecurityCategorySchema: OpenAPIV3.SchemaObject = {
  title: 'SecurityCategory',
  type: 'object',
  required: ['security_category_id', 'name', 'description'],
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
      nullable: true,
      description: 'Description of the security category'
    }
  }
};

/**
 * Schema for create security category request body.
 */
export const CreateSecurityCategoryRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'CreateSecurityCategoryRequest',
  type: 'object',
  required: ['name', 'description'],
  properties: {
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Name of the security category'
    },
    description: {
      type: 'string',
      maxLength: 500,
      description: 'Description of the security category'
    }
  }
};

/**
 * Schema for update security category request body.
 */
export const UpdateSecurityCategoryRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'UpdateSecurityCategoryRequest',
  type: 'object',
  required: ['name', 'description'],
  properties: {
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Name of the security category'
    },
    description: {
      type: 'string',
      maxLength: 500,
      description: 'Description of the security category'
    }
  }
};

/**
 * Schema for a security rule with feature count.
 */
export const SecurityRuleWithFeatureCountSchema: OpenAPIV3.SchemaObject = {
  title: 'SecurityRuleWithFeatureCount',
  type: 'object',
  required: ['security_rule_id', 'security_category_id', 'category_name', 'name', 'description', 'feature_count'],
  properties: {
    security_rule_id: {
      type: 'integer',
      description: 'Unique identifier for the security rule'
    },
    security_category_id: {
      type: 'integer',
      description: 'ID of the security category this rule belongs to'
    },
    category_name: {
      type: 'string',
      maxLength: 100,
      description: 'Name of the security category this rule belongs to'
    },
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Name of the security rule'
    },
    description: {
      type: 'string',
      maxLength: 500,
      nullable: true,
      description: 'Description of the security rule'
    },
    feature_count: {
      type: 'integer',
      description: 'Number of submission features secured by this rule'
    }
  }
};

/**
 * Schema for a security reason (admin CRUD response).
 */
export const SecurityReasonSchema: OpenAPIV3.SchemaObject = {
  title: 'SecurityReason',
  type: 'object',
  required: ['security_rule_id', 'security_category_id', 'name', 'description'],
  properties: {
    security_rule_id: {
      type: 'integer',
      description: 'Unique identifier for the security rule'
    },
    security_category_id: {
      type: 'integer',
      description: 'ID of the security category this rule belongs to'
    },
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Name of the security rule'
    },
    description: {
      type: 'string',
      maxLength: 500,
      nullable: true,
      description: 'Description of the security rule'
    }
  }
};

/**
 * Schema for create security reason request body.
 */
export const CreateSecurityReasonRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'CreateSecurityReasonRequest',
  type: 'object',
  required: ['name', 'description', 'security_category_id'],
  properties: {
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Name of the security reason'
    },
    description: {
      type: 'string',
      maxLength: 500,
      description: 'Description of the security reason'
    },
    security_category_id: {
      type: 'integer',
      minimum: 1,
      description: 'ID of the security category this reason belongs to'
    }
  }
};

/**
 * Schema for update security reason request body.
 */
export const UpdateSecurityReasonRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'UpdateSecurityReasonRequest',
  type: 'object',
  required: ['name', 'description', 'security_category_id'],
  properties: {
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Name of the security reason'
    },
    description: {
      type: 'string',
      maxLength: 500,
      description: 'Description of the security reason'
    },
    security_category_id: {
      type: 'integer',
      minimum: 1,
      description: 'ID of the security category this reason belongs to'
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
