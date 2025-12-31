import { OpenAPIV3 } from 'openapi-types';

/**
 * Schema for paginated data with count.
 */
export const paginatedDataSchema = (itemSchema: OpenAPIV3.SchemaObject): OpenAPIV3.SchemaObject => ({
  type: 'object',
  properties: {
    data: {
      type: 'array',
      items: itemSchema
    },
    total: {
      type: 'integer',
      minimum: 0
    }
  },
  required: ['data', 'total']
});

/**
 * Schema for simple count object.
 */
export const countSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  properties: {
    total: { type: 'integer', minimum: 0 }
  },
  required: ['total']
};

/**
 * Schema for count summary by feature type.
 */
export const countSummaryByTypeSchema: OpenAPIV3.SchemaObject = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      feature_type_name: { type: 'string' },
      total: { type: 'integer', minimum: 0 }
    },
    required: ['feature_type_name', 'total']
  }
};
