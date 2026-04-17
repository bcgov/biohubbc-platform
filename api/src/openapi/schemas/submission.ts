import { OpenAPIV3 } from 'openapi-types';
import { SECURITY_APPLIED_STATUS } from '../../repositories/security-repository';
import { paginationResponseSchema } from './pagination';

export const SubmissionResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'submission_id',
    'uuid',
    'publish_timestamp',
    'submitted_timestamp',
    'system_user_id',
    'contributor_id',
    'name',
    'description',
    'comment',
    'create_user',
    'update_user',
    'security',
    'root_feature_type_id',
    'root_feature_type_name',
    'regions'
  ],
  additionalProperties: false,
  properties: {
    submission_id: {
      type: 'integer',
      minimum: 1,
      description: 'Unique identifier for the submission'
    },
    uuid: {
      type: 'string',
      format: 'uuid',
      description: 'UUID of the submission'
    },
    publish_timestamp: {
      type: 'string',
      nullable: true,
      description: 'Timestamp when the submission was published'
    },
    submitted_timestamp: {
      type: 'string',
      description: 'Timestamp when the submission was submitted'
    },
    system_user_id: {
      type: 'integer',
      minimum: 1,
      description: 'System user ID of the submission owner'
    },
    contributor_id: {
      type: 'integer',
      minimum: 1,
      description: 'System user ID of the contributor'
    },
    name: {
      type: 'string',
      maxLength: 200,
      description: 'Name of the submission'
    },
    description: {
      type: 'string',
      maxLength: 3000,
      description: 'Description of the submission'
    },
    comment: {
      type: 'string',
      maxLength: 3000,
      description: 'Comment on the submission'
    },
    create_user: {
      type: 'integer',
      minimum: 1,
      description: 'System user ID of the creator'
    },
    update_user: {
      type: 'integer',
      minimum: 1,
      nullable: true,
      description: 'System user ID of the last updater'
    },
    security: {
      type: 'string',
      enum: [SECURITY_APPLIED_STATUS.PENDING, SECURITY_APPLIED_STATUS.SECURED, SECURITY_APPLIED_STATUS.UNSECURED],
      description: 'Security status of the submission'
    },
    root_feature_type_id: {
      type: 'integer',
      minimum: 1,
      description: 'ID of the root feature type'
    },
    root_feature_type_name: {
      type: 'string',
      description: 'Name of the root feature type'
    },
    regions: {
      type: 'array',
      items: {
        type: 'string'
      },
      description: 'List of regions associated with the submission'
    }
  }
};

export const SubmissionListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['submissions', 'pagination'],
  additionalProperties: false,
  properties: {
    submissions: {
      type: 'array',
      items: SubmissionResponseSchema
    },
    pagination: paginationResponseSchema
  }
};
