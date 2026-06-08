import { OpenAPIV3 } from 'openapi-types';
import { PredicateOperator } from '../../../models/expression-predicate';
import { GeoJSON } from '../geoJson';
import { paginationRequestBodySchema, paginationResponseSchema } from '../pagination';

/**
 * Recursive expression tree for feature search.
 */
export const featureSearchExpressionTreeSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['type', 'operator', 'clauses'],
  properties: {
    type: { type: 'string', enum: ['expression'] },
    operator: { type: 'string', enum: ['AND', 'OR'] },
    clauses: {
      type: 'array',
      minItems: 1,
      items: {
        oneOf: [
          {
            type: 'object',
            required: ['type', 'feature_property_id', 'feature_type_property_id', 'operator'],
            properties: {
              type: { type: 'string', enum: ['predicate'] },
              feature_property_id: { type: 'integer', minimum: 1 },
              feature_type_property_id: { type: 'integer', nullable: true },
              operator: { type: 'string', enum: PredicateOperator.options },
              value: {
                description:
                  'Predicate value. Allowed shape is validated server-side from property metadata. Datetime values are scalar strings such as "2020-01-01", "14:30:00-07:00", or "2020-01-01T14:30:00-07:00".',
                oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }, GeoJSON]
              }
            },
            additionalProperties: false
          },
          {
            type: 'object',
            required: ['type', 'operator', 'clauses'],
            properties: {
              type: { type: 'string', enum: ['expression'] },
              operator: { type: 'string', enum: ['AND', 'OR'] },
              clauses: { type: 'array', minItems: 1, items: { type: 'object' } }
            }
          }
        ]
      }
    }
  }
};

/**
 * Feature search result schema
 */
export const featureSearchResultSchema: OpenAPIV3.SchemaObject = {
  title: 'featureSearchResult',
  type: 'object',
  required: [
    'submission_feature_id',
    'submission_id',
    'uuid',
    'feature_type_id',
    'feature_type_name',
    'submission_name',
    'is_secured',
    'relevancy_score',
    'create_date'
  ],
  properties: {
    submission_feature_id: { type: 'integer' },
    submission_id: { type: 'integer' },
    uuid: { type: 'string', format: 'uuid' },
    feature_type_id: { type: 'integer' },
    feature_type_name: { type: 'string' },
    feature_name: { type: 'string', nullable: true },
    properties: { type: 'object', additionalProperties: true },
    submission_name: { type: 'string' },
    is_secured: { type: 'boolean' },
    relevancy_score: { type: 'number' },
    create_date: { type: 'string', format: 'date-time' }
  }
};

export const featureSearchPropertySchema: OpenAPIV3.SchemaObject = {
  title: 'featureSearchProperty',
  type: 'object',
  required: [
    'feature_type_property_id',
    'name',
    'display_name',
    'description',
    'type_name',
    'required_value',
    'calculated_value',
    'allow_multiple'
  ],
  properties: {
    feature_type_property_id: { type: 'integer' },
    feature_property_id: { type: 'integer' },
    feature_property_type_id: { type: 'integer' },
    name: { type: 'string' },
    display_name: { type: 'string' },
    description: { type: 'string', nullable: true },
    type_name: { type: 'string' },
    required_value: { type: 'boolean' },
    calculated_value: { type: 'boolean' },
    allow_multiple: { type: 'boolean' }
  }
};

/**
 * Feature search request body
 */
export const featureSearchRequestBodySchema: OpenAPIV3.RequestBodyObject = {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          expression: featureSearchExpressionTreeSchema,
          pagination: paginationRequestBodySchema
        },
        description: 'Optional expression tree and pagination. Omit expression to list target features.'
      }
    }
  }
};

/**
 * Feature search response
 */
export const featureSearchResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['features', 'properties', 'pagination'],
  properties: {
    features: {
      type: 'array',
      items: featureSearchResultSchema
    },
    properties: {
      type: 'array',
      items: featureSearchPropertySchema
    },
    pagination: paginationResponseSchema
  }
};
