/**
 * OpenAPI schemas for Feature Type endpoints.
 *
 * These schemas define the API contract for feature type management operations.
 */

import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';

/**
 * Schema for a feature type.
 */
export const FeatureTypeSchema: OpenAPIV3.SchemaObject = {
  title: 'FeatureType',
  type: 'object',
  required: ['feature_type_id', 'name', 'display_name', 'description'],
  properties: {
    feature_type_id: {
      type: 'integer',
      minimum: 1,
      description: 'System generated surrogate primary key identifier'
    },
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Canonical name of the feature type'
    },
    display_name: {
      type: 'string',
      maxLength: 100,
      description: 'Human-readable name of the feature type'
    },
    description: {
      type: 'string',
      maxLength: 500,
      nullable: true,
      description: 'Description of the feature type'
    }
  }
};

/**
 * Schema for paginated feature types list response.
 */
export const FeatureTypesListResponseSchema: OpenAPIV3.SchemaObject = {
  title: 'FeatureTypesListResponse',
  type: 'object',
  required: ['feature_types', 'pagination'],
  properties: {
    feature_types: {
      type: 'array',
      items: FeatureTypeSchema,
      description: 'List of feature types'
    },
    pagination: paginationResponseSchema
  }
};

/**
 * Schema for create feature type request body.
 */
export const CreateFeatureTypeRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'CreateFeatureTypeRequest',
  type: 'object',
  required: ['name', 'display_name'],
  properties: {
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Canonical name of the feature type'
    },
    display_name: {
      type: 'string',
      maxLength: 100,
      description: 'Human-readable name of the feature type'
    },
    description: {
      type: 'string',
      maxLength: 500,
      nullable: true,
      description: 'Description of the feature type'
    }
  }
};

/**
 * Schema for update feature type request body.
 */
export const UpdateFeatureTypeRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'UpdateFeatureTypeRequest',
  type: 'object',
  properties: {
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Canonical name of the feature type'
    },
    display_name: {
      type: 'string',
      maxLength: 100,
      description: 'Human-readable name of the feature type'
    },
    description: {
      type: 'string',
      maxLength: 500,
      nullable: true,
      description: 'Description of the feature type'
    }
  }
};
