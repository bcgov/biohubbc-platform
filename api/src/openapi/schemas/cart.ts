import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';

export const CartFeatureIdsRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['features'],
  additionalProperties: false,
  properties: {
    features: {
      type: 'array',
      items: { type: 'integer' },
      description: 'List of submission feature IDs to add to the cart'
    }
  }
};

export const GetCartSubmissionFeaturesSchema: OpenAPIV3.SchemaObject = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: [
      'cart_submission_feature_id',
      'submission_feature_id',
      'submission_id',
      'feature_type_id',
      'feature_type_name',
      'secured'
    ],
    properties: {
      cart_submission_feature_id: {
        type: 'string',
        format: 'uuid',
        description: 'Primary key of the submission feature in the cart'
      },
      submission_feature_id: {
        type: 'integer',
        description: 'Unique ID of the submission feature'
      },
      submission_id: {
        type: 'integer',
        description: 'ID of the submission this feature belongs to'
      },
      feature_type_id: {
        type: 'integer',
        description: 'ID of the feature type'
      },
      feature_type_name: {
        type: 'string',
        description: 'Name of the feature type'
      },
      secured: {
        type: 'boolean',
        description: 'Whether the feature is secured'
      }
    }
  }
};

export const GetCartSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['cart_id', 'system_user_id', 'cart_status', 'record_end_date'],
  additionalProperties: false,
  properties: {
    cart_id: { type: 'string', format: 'uuid' },
    system_user_id: { type: 'integer', nullable: true },
    cart_status: {
      type: 'string',
      enum: ['active', 'checked_out', 'expired', 'abandoned']
    },
    record_end_date: { type: 'string', nullable: true }
  }
};

export const CartFeaturesResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['features', 'pagination'],
  additionalProperties: false,
  properties: {
    features: GetCartSubmissionFeaturesSchema,
    pagination: paginationResponseSchema
  }
};

export const IsFeatureInCartResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['isInCart'],
  additionalProperties: false,
  properties: {
    isInCart: {
      type: 'boolean',
      description: 'Whether the submission feature is in the cart'
    }
  }
};

export const CartWithFeaturesResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['cart', 'features', 'pagination'],
  additionalProperties: false,
  properties: {
    cart: GetCartSchema,
    features: GetCartSubmissionFeaturesSchema,
    pagination: paginationResponseSchema
  }
};
