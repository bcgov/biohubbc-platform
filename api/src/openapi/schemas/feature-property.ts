/**
 * OpenAPI schemas for Feature Property endpoints.
 *
 * These schemas define the API contract for feature property management operations.
 */

import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';

/**
 * Schema for a feature property.
 */
export const FeaturePropertySchema: OpenAPIV3.SchemaObject = {
  title: 'FeatureProperty',
  type: 'object',
  required: [
    'feature_property_id',
    'feature_property_type_id',
    'name',
    'display_name',
    'description',
    'type_name',
    'calculated_value'
  ],
  properties: {
    feature_property_id: {
      type: 'integer',
      minimum: 1,
      description: 'System generated surrogate primary key identifier'
    },
    feature_property_type_id: {
      type: 'integer',
      minimum: 1,
      description: 'Foreign key to the feature_property_type table'
    },
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Canonical name of the feature property'
    },
    display_name: {
      type: 'string',
      maxLength: 100,
      description: 'Human-readable name of the feature property'
    },
    description: {
      type: 'string',
      maxLength: 500,
      nullable: true,
      description: 'Description of the feature property'
    },
    type_name: {
      type: 'string',
      description: 'The resolved name of the feature property type'
    },
    calculated_value: {
      type: 'boolean',
      description: 'Whether the property value is calculated rather than supplied'
    }
  }
};

/**
 * Schema for paginated feature properties list response.
 */
export const FeaturePropertiesListResponseSchema: OpenAPIV3.SchemaObject = {
  title: 'FeaturePropertiesListResponse',
  type: 'object',
  required: ['feature_properties', 'pagination'],
  properties: {
    feature_properties: {
      type: 'array',
      items: FeaturePropertySchema,
      description: 'List of feature properties'
    },
    pagination: paginationResponseSchema
  }
};

/**
 * Schema for create feature property request body.
 */
export const CreateFeaturePropertyRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'CreateFeaturePropertyRequest',
  type: 'object',
  required: ['feature_property_type_id', 'name', 'display_name'],
  properties: {
    feature_property_type_id: {
      type: 'integer',
      minimum: 1,
      description: 'Foreign key to the feature_property_type table'
    },
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Canonical name of the feature property'
    },
    display_name: {
      type: 'string',
      maxLength: 100,
      description: 'Human-readable name of the feature property'
    },
    description: {
      type: 'string',
      maxLength: 500,
      nullable: true,
      description: 'Description of the feature property'
    },
    calculated_value: {
      type: 'boolean',
      description: 'Whether the property value is calculated rather than supplied'
    }
  }
};

/**
 * Schema for update feature property request body.
 */
export const UpdateFeaturePropertyRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'UpdateFeaturePropertyRequest',
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Canonical name of the feature property'
    },
    display_name: {
      type: 'string',
      maxLength: 100,
      description: 'Human-readable name of the feature property'
    },
    description: {
      type: 'string',
      maxLength: 500,
      nullable: true,
      description: 'Description of the feature property'
    },
    calculated_value: {
      type: 'boolean',
      description: 'Whether the property value is calculated rather than supplied'
    }
  }
};
