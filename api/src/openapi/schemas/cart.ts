import { OpenAPIV3 } from 'openapi-types';

export const GetCartSubmissionFeaturesSchema: OpenAPIV3.SchemaObject = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: [
      'submission_feature_id',
      'uuid',
      'urn',
      'submission_id',
      'feature_type_id',
      'feature_type_name',
      'secured'
    ],
    properties: {
      submission_feature_id: {
        type: 'number',
        description: 'Unique ID of the submission feature'
      },
      uuid: {
        type: 'string',
        description: 'UUID of the submission feature'
      },
      urn: {
        type: 'string',
        description: 'URN for the submission feature'
      },
      submission_id: {
        type: 'number',
        description: 'ID of the submission this feature belongs to'
      },
      feature_type_id: {
        type: 'number',
        description: 'ID of the feature type'
      },
      source_id: {
        type: 'string',
        nullable: true,
        description: 'Optional source ID'
      },
      data: {
        type: 'object',
        additionalProperties: true,
        description: 'Arbitrary JSON data for the submission feature'
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

export const GetCartWithFeaturesSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['cart', 'features'],
  additionalProperties: false,
  properties: {
    cart: {
      type: 'object',
      required: ['cart_id', 'system_user_id'],
      properties: {
        cart_id: { type: 'string' },
        system_user_id: { type: 'number' }
      }
    },
    features: GetCartSubmissionFeaturesSchema
  }
};
