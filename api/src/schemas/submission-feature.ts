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
        'create_date',
        'submission_id',
        'feature_type_id',
        'source_id',
        'successor_submission_feature_id',
        'feature_type_name',
        'feature_type_display_name',
        'submission_name',
        'contributor_name',
        'secured',
        'security_reasons'
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
        create_date: {
          type: 'string',
          format: 'date-time',
          description: 'Date and time when the feature was created.'
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
          nullable: true,
          description: 'UUID identifying the source of this feature.'
        },
        successor_submission_feature_id: {
          type: 'integer',
          nullable: true,
          description: 'Identifier of the newer feature that supersedes this feature, when one exists.'
        },
        feature_type_name: {
          type: 'string',
          description: 'Human-readable name for the feature type.'
        },
        feature_type_display_name: {
          type: 'string',
          description: 'Display name for the feature type.'
        },
        submission_name: {
          type: 'string',
          description: 'Name of the parent submission.'
        },
        contributor_name: {
          type: 'string',
          description: 'Name of the contributor associated with the parent submission.'
        },
        secured: {
          type: 'boolean',
          description: 'Indicates whether this feature is secured or restricted.'
        },
        security_reasons: {
          type: 'array',
          items: { type: 'string' },
          description:
            "Distinct active security rule names applied across this feature's closure ancestry; empty when the feature is not effectively secured."
        }
      }
    }
  }
};
