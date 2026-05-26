import { OpenAPIV3 } from 'openapi-types';
import { DataRequestResponseSchema } from './data-request';
import { paginationResponseSchema } from './pagination';
import { TicketSystemUserWithUserSchema } from './ticket-system-user';

const TicketPriorityEnum = ['low', 'medium', 'high', 'critical'];
const TicketStatusEnum = ['open', 'closed'];
const SubmissionUploadJobStatusEnum = ['uploaded', 'ingesting', 'ingested', 'indexing', 'indexed', 'invalid', 'failed'];
const SubmissionUploadReviewStatusEnum = ['submitted', 'approved', 'denied', 'deleted'];
const SubmissionValidationStatusEnum = ['pending', 'started', 'completed', 'invalid', 'failed'];
const SubmissionUploadReviewScopeEnum = ['validation', 'security'];
const SubmissionUploadReviewTaskStatusEnum = [
  'pending',
  'requested',
  'in_progress',
  'completed',
  'blocked',
  'skipped',
  'cancelled'
];

export const TicketCommentSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['ticket_comment_id', 'ticket_id', 'user_identifier', 'create_date', 'comment'],
  properties: {
    ticket_comment_id: { type: 'string', format: 'uuid' },
    ticket_id: { type: 'string', format: 'uuid' },
    user_identifier: { type: 'string' },
    create_date: { type: 'string', format: 'date-time' },
    comment: {
      type: 'string',
      description: 'Markdown-formatted comment text'
    }
  }
};

export const TicketArtifactSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['ticket_artifact_id', 'ticket_id', 'artifact_id', 'record_end_date', 'create_date', 'object_key'],
  properties: {
    ticket_artifact_id: { type: 'string', format: 'uuid' },
    ticket_id: { type: 'string', format: 'uuid' },
    artifact_id: { type: 'string', format: 'uuid' },
    record_end_date: { type: 'string', format: 'date-time', nullable: true },
    create_date: { type: 'string', format: 'date-time' },
    object_key: { type: 'string', description: 'Artifact object storage key.' }
  }
};

const TicketSubmissionValidationSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['submission_validation_id', 'job_id', 'status', 'metadata', 'started_at', 'ended_at', 'create_date'],
  properties: {
    submission_validation_id: { type: 'integer' },
    job_id: { type: 'string' },
    status: { type: 'string', enum: SubmissionValidationStatusEnum },
    metadata: {
      type: 'object',
      nullable: true,
      additionalProperties: true
    },
    started_at: { type: 'string', format: 'date-time', nullable: true },
    ended_at: { type: 'string', format: 'date-time', nullable: true },
    create_date: { type: 'string', format: 'date-time' }
  }
};

const TicketSubmissionUploadReviewSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['submission_upload_review_id', 'submission_upload_id', 'scope', 'status', 'requested_by'],
  properties: {
    submission_upload_review_id: { type: 'string', format: 'uuid' },
    submission_upload_id: { type: 'string', format: 'uuid' },
    scope: { type: 'string', enum: SubmissionUploadReviewScopeEnum },
    status: { type: 'string', enum: SubmissionUploadReviewTaskStatusEnum },
    requested_by: { type: 'integer', minimum: 1, nullable: true }
  }
};

const TicketSubmissionUploadSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: [
    'submission_upload_id',
    'submission_uuid',
    'upload_id',
    'create_date',
    'submission_name',
    'submission_description',
    'submission_comment',
    'submitted_by_identifier',
    'upload_status',
    'review_status',
    'validation',
    'reviews'
  ],
  properties: {
    submission_upload_id: { type: 'string', format: 'uuid' },
    submission_uuid: { type: 'string', format: 'uuid' },
    upload_id: { type: 'string', format: 'uuid' },
    create_date: { type: 'string', format: 'date-time' },
    submission_name: { type: 'string', nullable: true },
    submission_description: { type: 'string', nullable: true },
    submission_comment: { type: 'string', nullable: true },
    submitted_by_identifier: { type: 'string', nullable: true },
    upload_status: { type: 'string', enum: SubmissionUploadJobStatusEnum },
    review_status: { type: 'string', enum: SubmissionUploadReviewStatusEnum },
    validation: { ...TicketSubmissionValidationSchema, nullable: true },
    reviews: {
      type: 'object',
      additionalProperties: false,
      required: ['validation', 'security'],
      properties: {
        validation: { ...TicketSubmissionUploadReviewSchema, nullable: true },
        security: { ...TicketSubmissionUploadReviewSchema, nullable: true }
      }
    }
  }
};

export const TicketReferenceSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'ticket_reference_id',
    'source_ticket_id',
    'source_ticket_slug',
    'source_ticket_subject',
    'target_ticket_id',
    'target_ticket_slug',
    'target_ticket_subject',
    'relationship',
    'user_identifier',
    'create_date'
  ],
  properties: {
    ticket_reference_id: { type: 'string', format: 'uuid' },
    source_ticket_id: { type: 'string', format: 'uuid' },
    source_ticket_slug: { type: 'string', minLength: 8, maxLength: 8, pattern: String.raw`^\d{8}$` },
    source_ticket_subject: { type: 'string', maxLength: 100 },
    target_ticket_id: { type: 'string', format: 'uuid' },
    target_ticket_slug: { type: 'string', minLength: 8, maxLength: 8, pattern: String.raw`^\d{8}$` },
    target_ticket_subject: { type: 'string', maxLength: 100 },
    relationship: {
      type: 'string',
      enum: ['blocks', 'blocked_by', 'duplicates', 'duplicate_of', 'relates_to', 'resolves', 'resolved_by']
    },
    user_identifier: { type: 'string' },
    create_date: { type: 'string', format: 'date-time' }
  }
};

export const TicketSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['ticket_id', 'ticket_slug', 'subject', 'team_id', 'create_date', 'priority', 'status'],
  properties: {
    ticket_id: { type: 'string', format: 'uuid' },
    ticket_slug: { type: 'string', minLength: 8, maxLength: 8, pattern: String.raw`^\d{8}$` },
    subject: { type: 'string', maxLength: 100 },
    description: { type: 'string', maxLength: 2000, nullable: true },
    team_id: { type: 'string', format: 'uuid' },
    create_date: { type: 'string', format: 'date-time' },
    priority: { type: 'string', enum: TicketPriorityEnum },
    status: { type: 'string', enum: TicketStatusEnum }
  }
};

export const TicketWithHistorySchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'ticket_id',
    'ticket_slug',
    'subject',
    'team_id',
    'create_date',
    'priority',
    'status',
    'statuses',
    'comments',
    'artifacts',
    'references',
    'data_requests',
    'submission_uploads',
    'ticket_system_users'
  ],
  properties: {
    ticket_id: { type: 'string', format: 'uuid' },
    ticket_slug: { type: 'string', minLength: 8, maxLength: 8, pattern: String.raw`^\d{8}$` },
    subject: { type: 'string', maxLength: 100 },
    description: { type: 'string', maxLength: 2000, nullable: true },
    team_id: { type: 'string', format: 'uuid' },
    create_date: { type: 'string', format: 'date-time' },
    priority: { type: 'string', enum: TicketPriorityEnum },
    status: { type: 'string', enum: TicketStatusEnum },
    statuses: {
      description: 'Status change history for the ticket.',
      type: 'array',
      items: {
        type: 'object',
        required: ['ticket_status_id', 'ticket_id', 'user_identifier', 'create_date', 'status'],
        properties: {
          ticket_status_id: { type: 'string', format: 'uuid' },
          ticket_id: { type: 'string', format: 'uuid' },
          user_identifier: { type: 'string' },
          create_date: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: TicketStatusEnum }
        }
      }
    },
    comments: {
      type: 'array',
      items: TicketCommentSchema
    },
    artifacts: {
      type: 'array',
      description: 'Active artifacts attached to the ticket.',
      items: TicketArtifactSchema
    },
    references: {
      type: 'array',
      items: TicketReferenceSchema
    },
    data_requests: {
      type: 'array',
      items: DataRequestResponseSchema
    },
    submission_uploads: {
      type: 'array',
      items: TicketSubmissionUploadSchema
    },
    ticket_system_users: {
      type: 'array',
      items: TicketSystemUserWithUserSchema
    }
  }
};

export const CreateTicketRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['subject', 'description', 'priority'],
  properties: {
    subject: { type: 'string', maxLength: 100 },
    description: { type: 'string', maxLength: 2000, nullable: true },
    priority: { type: 'string', enum: TicketPriorityEnum }
  }
};

export const UpdateTicketRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    subject: { type: 'string', maxLength: 100 },
    description: { type: 'string', maxLength: 2000, nullable: true },
    priority: { type: 'string', enum: TicketPriorityEnum },
    status: { type: 'string', enum: TicketStatusEnum }
  }
};

export const UpdateTicketStatusRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'string', enum: TicketStatusEnum }
  }
};

export const CreateTicketCommentRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['comment'],
  properties: {
    comment: {
      type: 'string',
      minLength: 1,
      maxLength: 3000,
      description: 'Markdown-formatted comment text'
    }
  }
};

export const UpdateTicketCommentRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['comment'],
  properties: {
    comment: {
      type: 'string',
      minLength: 1,
      maxLength: 3000,
      description: 'Markdown-formatted comment text'
    }
  }
};

export const CreateTicketReferenceRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['references'],
  properties: {
    references: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['target_ticket_id', 'relationship'],
        properties: {
          target_ticket_id: { type: 'string', format: 'uuid' },
          relationship: {
            type: 'string',
            enum: ['blocks', 'blocked_by', 'duplicates', 'duplicate_of', 'relates_to', 'resolves', 'resolved_by']
          }
        }
      }
    }
  }
};

export const TicketStatusSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['ticket_status_id', 'ticket_id', 'user_identifier', 'create_date', 'status'],
  properties: {
    ticket_status_id: { type: 'string', format: 'uuid' },
    ticket_id: { type: 'string', format: 'uuid' },
    user_identifier: { type: 'string' },
    create_date: { type: 'string', format: 'date-time' },
    status: { type: 'string', enum: TicketStatusEnum }
  }
};

export const TicketListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['tickets', 'pagination'],
  properties: {
    tickets: {
      type: 'array',
      items: TicketSchema
    },
    pagination: paginationResponseSchema
  }
};

export const TicketArtifactListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['artifacts', 'pagination'],
  properties: {
    artifacts: {
      type: 'array',
      items: TicketArtifactSchema
    },
    pagination: paginationResponseSchema
  }
};
