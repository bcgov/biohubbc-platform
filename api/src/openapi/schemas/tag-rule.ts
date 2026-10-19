import { OpenAPIV3 } from 'openapi-types';
import { featureSearchExpressionTreeSchema } from './search/search-feature';
import { TagColorSchema } from './tag';

export const TagRuleSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: [
    'tag_rule_id',
    'tag_id',
    'tag_name',
    'tag_color',
    'name',
    'description',
    'is_enabled',
    'expression_id',
    'create_date'
  ],
  properties: {
    tag_rule_id: { type: 'string', format: 'uuid' },
    tag_id: { type: 'string', format: 'uuid' },
    tag_name: { type: 'string' },
    tag_color: TagColorSchema,
    name: { type: 'string', maxLength: 100 },
    description: { type: 'string', maxLength: 500, nullable: true },
    is_enabled: { type: 'boolean' },
    expression_id: { type: 'string', format: 'uuid' },
    create_date: { type: 'string', format: 'date-time' }
  }
};

export const TagRuleDetailSchema: OpenAPIV3.SchemaObject = {
  ...TagRuleSchema,
  required: [...(TagRuleSchema.required ?? []), 'expression'],
  properties: {
    ...TagRuleSchema.properties,
    expression: featureSearchExpressionTreeSchema
  }
};

export const TagRuleListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['tag_rules'],
  properties: {
    tag_rules: { type: 'array', items: TagRuleSchema }
  }
};

export const TagRuleRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['tagId', 'name', 'description', 'isEnabled', 'expression'],
  properties: {
    tagId: { type: 'string', format: 'uuid' },
    name: { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string', maxLength: 500, nullable: true },
    isEnabled: { type: 'boolean' },
    expression: {
      ...featureSearchExpressionTreeSchema,
      description:
        "Upload tickets match when a feature of the upload matches the expression; data request tickets match when the request's expression refers to the same properties or taxa (including descendants)."
    }
  }
};
