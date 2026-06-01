/**
 * OpenAPI schemas for Feature Type Property endpoints.
 *
 * These schemas define the API contract for feature type property management operations.
 */

import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';

/**
 * Schema for a raw feature type property record (admin view).
 */
export const AdminFeatureTypePropertySchema: OpenAPIV3.SchemaObject = {
  title: 'AdminFeatureTypeProperty',
  type: 'object',
  required: ['feature_type_property_id', 'feature_type_id', 'feature_property_id', 'required_value', 'sort'],
  properties: {
    feature_type_property_id: {
      type: 'integer',
      minimum: 1,
      description: 'System generated surrogate primary key identifier'
    },
    feature_type_id: {
      type: 'integer',
      minimum: 1,
      description: 'Foreign key to the feature_type table'
    },
    feature_property_id: {
      type: 'integer',
      minimum: 1,
      description: 'Foreign key to the feature_property table'
    },
    required_value: {
      type: 'boolean',
      description: 'Whether the property is required for this feature type'
    },
    sort: {
      type: 'integer',
      nullable: true,
      description: 'Custom sort order for display purposes'
    }
  }
};

/**
 * Schema for paginated feature type properties list response.
 */
export const FeatureTypePropertiesListResponseSchema: OpenAPIV3.SchemaObject = {
  title: 'FeatureTypePropertiesListResponse',
  type: 'object',
  required: ['feature_type_properties', 'pagination'],
  properties: {
    feature_type_properties: {
      type: 'array',
      items: AdminFeatureTypePropertySchema,
      description: 'List of feature type properties'
    },
    pagination: paginationResponseSchema
  }
};

/**
 * Schema for create feature type property request body.
 * feature_type_id is taken from the path param, not the body.
 */
export const CreateFeatureTypePropertyRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'CreateFeatureTypePropertyRequest',
  type: 'object',
  required: ['feature_property_id'],
  properties: {
    feature_property_id: {
      type: 'integer',
      minimum: 1,
      description: 'Foreign key to the feature_property table'
    },
    required_value: {
      type: 'boolean',
      description: 'Whether the property is required for this feature type'
    },
    sort: {
      type: 'integer',
      nullable: true,
      description: 'Custom sort order for display purposes'
    }
  }
};

/**
 * Schema for update feature type property request body.
 * Only metadata fields are updatable; feature_type_id and feature_property_id cannot change.
 */
export const UpdateFeatureTypePropertyRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'UpdateFeatureTypePropertyRequest',
  type: 'object',
  properties: {
    required_value: {
      type: 'boolean',
      description: 'Whether the property is required for this feature type'
    },
    sort: {
      type: 'integer',
      nullable: true,
      description: 'Custom sort order for display purposes'
    }
  }
};
