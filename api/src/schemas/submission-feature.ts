import { OpenAPIV3 } from 'openapi-types';

export const GetSubmissionFeatureSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['feature'],
  properties: {
    feature: {
      type: 'object',
      additionalProperties: false,
      required: [
        'submission_feature_id',
        'uuid',
        'urn',
        'submission_id',
        'feature_type_id',
        'source_id',
        'data',
        'feature_type_name',
        'secured'
      ],
      properties: {
        submission_feature_id: {
          type: 'integer',
          description: 'Unique identifier for this submission feature.'
        },
        uuid: {
          type: 'string',
          format: 'uuid',
          description: 'Universally unique identifier for the feature.'
        },
        urn: {
          type: 'string',
          description: 'Uniform Resource Name of the feature'
        },
        submission_id: {
          type: 'integer',
          description: 'Identifier of the submission that this feature belongs to.'
        },
        feature_type_id: {
          type: 'integer',
          description: 'Identifier for the feature type.'
        },
        source_id: {
          type: 'string',
          format: 'uuid',
          description: 'UUID identifying the source of this feature.'
        },
        data: {
          type: 'object',
          description: 'Feature-specific payload for the feature, including feature ID, properties, etc.'
        },
        feature_type_name: {
          type: 'string',
          description: 'Human-readable name for the feature type.'
        },
        secured: {
          type: 'boolean',
          description: 'Indicates whether this feature is secured or restricted.'
        }
      }
    }
  }
};
