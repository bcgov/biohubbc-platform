import { OpenAPIV3 } from 'openapi-types';

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
