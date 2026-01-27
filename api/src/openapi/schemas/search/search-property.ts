import { OpenAPIV3 } from 'openapi-types';
import { paginationRequestBodySchema, paginationResponseSchema } from '../pagination';

/**
 * Property search filters
 */
export const propertySearchFiltersSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    keyword: { type: 'string' },
    feature_types: {
      type: 'array',
      items: { type: 'string' }
    }
  }
};

/**
 * Individual property result
 */
const propertyResultSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['feature_property_id', 'property_name', 'relevancy_score'],
  properties: {
    feature_property_id: { type: 'integer' },
    property_name: { type: 'string' },
    relevancy_score: { type: 'number' }
  }
};

/**
 * Grouped property results
 */
const groupedPropertiesSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['string', 'number'],
  properties: {
    string: { type: 'array', items: propertyResultSchema },
    number: { type: 'array', items: propertyResultSchema }
  }
};

/**
 * Property search request body
 */
export const propertySearchRequestBodySchema: OpenAPIV3.RequestBodyObject = {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['filters'],
        properties: {
          filters: propertySearchFiltersSchema,
          pagination: paginationRequestBodySchema
        }
      }
    }
  }
};

/**
 * Property search response
 */
export const propertySearchResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['properties', 'pagination'],
  properties: {
    properties: groupedPropertiesSchema,
    pagination: paginationResponseSchema
  }
};
