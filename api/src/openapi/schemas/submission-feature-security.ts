import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';
import { submissionUploadParameters } from './submission-upload';

export const submissionUploadReviewSecurityParameters: OpenAPIV3.ParameterObject[] = [
  ...submissionUploadParameters,
  { in: 'path', name: 'submissionUploadReviewId', required: true, schema: { type: 'string', format: 'uuid' } }
];

export const submissionFeatureSecurityRuleSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['security_rule_id', 'security_category_id', 'name', 'category_name'],
  properties: {
    security_rule_id: { type: 'integer' },
    security_category_id: { type: 'integer' },
    name: { type: 'string' },
    category_name: { type: 'string' },
    description: { type: 'string', nullable: true },
    provenance: { type: 'string', enum: ['direct', 'inherited', null], nullable: true }
  }
};

export const submissionFeatureSecurityRulesResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['rules', 'pagination'],
  properties: {
    rules: { type: 'array', items: submissionFeatureSecurityRuleSchema },
    pagination: paginationResponseSchema
  }
};

/** Aggregate direct-assignment state, without feature-specific provenance. */
export const submissionFeatureSecuritySelectedRulesResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['rules', 'pagination'],
  properties: {
    rules: {
      type: 'array',
      items: {
        type: 'object',
        required: ['security_rule_id', 'security_category_id', 'name', 'category_name', 'description', 'applied'],
        properties: {
          security_rule_id: { type: 'integer' },
          security_category_id: { type: 'integer' },
          name: { type: 'string' },
          category_name: { type: 'string' },
          description: { type: 'string', nullable: true },
          applied: { type: 'boolean' }
        }
      }
    },
    pagination: paginationResponseSchema
  }
};
