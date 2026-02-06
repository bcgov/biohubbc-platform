import { OpenAPIV3 } from 'openapi-types';
import { paginationRequestBodySchema, paginationResponseSchema } from '../pagination';

/**
 * Filters for feature search
 */
export const featureSearchFiltersSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    keyword: { type: 'string' },
    feature_types: {
      type: 'array',
      items: { type: 'string' }
    },
    species: {
      type: 'array',
      items: { type: 'integer' }
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
    'relevancy_score'
  ],
  properties: {
    submission_feature_id: { type: 'integer' },
    submission_id: { type: 'integer' },
    uuid: { type: 'string', format: 'uuid' },
    feature_type_id: { type: 'integer' },
    feature_type_name: { type: 'string' },
    feature_name: { type: 'string', nullable: true },
    feature_description: { type: 'string', nullable: true },
    submission_name: { type: 'string' },
    is_secured: { type: 'boolean' },
    relevancy_score: { type: 'number' }
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
        required: ['filters', 'pagination'],
        properties: {
          filters: featureSearchFiltersSchema,
          pagination: paginationRequestBodySchema
        }
      }
    }
  }
};

/**
 * Feature search response
 */
export const featureSearchResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['features', 'pagination'],
  properties: {
    features: {
      type: 'array',
      items: featureSearchResultSchema
    },
    pagination: paginationResponseSchema
  }
};
