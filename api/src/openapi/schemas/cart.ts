import { OpenAPIV3 } from 'openapi-types';

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
        type: 'number',
        description: 'ID of the submission this feature belongs to'
      },
      feature_type_id: {
        type: 'number',
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

export const GetCartWithFeaturesSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['cart_id', 'system_user_id', 'features'],
  properties: {
    cart_id: { type: 'string' },
    system_user_id: { type: 'number', nullable: true },
    features: GetCartSubmissionFeaturesSchema
  }
};
