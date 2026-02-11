import { OpenAPIV3 } from 'openapi-types';

// ──────────────────────────────────────────────────────────────────────────────
// data_request
// ──────────────────────────────────────────────────────────────────────────────

export const DataRequestResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['data_request_id', 'reason', 'team_id', 'requested_by', 'create_date', 'create_user', 'revision_count'],
  additionalProperties: false,
  properties: {
    data_request_id: { type: 'string', format: 'uuid' },
    reason: { type: 'string' },
    team_id: { type: 'string', format: 'uuid' },
    requested_by: { type: 'integer' },
    record_end_date: { type: 'string', nullable: true },
    create_date: { type: 'string' },
    create_user: { type: 'integer' },
    update_date: { type: 'string', nullable: true },
    update_user: { type: 'integer', nullable: true },
    revision_count: { type: 'integer' }
  }
};

export const DataRequestListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'array',
  items: DataRequestResponseSchema
};

export const CreateDataRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['reason'],
  additionalProperties: false,
  properties: {
    reason: { type: 'string' }
  }
};

export const UpdateDataRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reason: { type: 'string' }
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// comment
// ──────────────────────────────────────────────────────────────────────────────

export const CommentResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['comment_id', 'comment', 'create_date', 'create_user', 'revision_count'],
  additionalProperties: false,
  properties: {
    comment_id: { type: 'string', format: 'uuid' },
    comment: { type: 'string' },
    create_date: { type: 'string' },
    create_user: { type: 'integer' },
    update_date: { type: 'string', nullable: true },
    update_user: { type: 'integer', nullable: true },
    revision_count: { type: 'integer' }
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// data_request_status
// ──────────────────────────────────────────────────────────────────────────────

export const DataRequestStatusResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'data_request_status_id',
    'data_request_id',
    'request_status',
    'create_date',
    'create_user',
    'revision_count'
  ],
  additionalProperties: false,
  properties: {
    data_request_status_id: { type: 'string', format: 'uuid' },
    data_request_id: { type: 'string', format: 'uuid' },
    comment_id: { type: 'string', format: 'uuid', nullable: true },
    request_status: { type: 'string', enum: ['REQUESTED', 'APPROVED', 'DENIED'] },
    record_end_date: { type: 'string', nullable: true },
    create_date: { type: 'string' },
    create_user: { type: 'integer' },
    update_date: { type: 'string', nullable: true },
    update_user: { type: 'integer', nullable: true },
    revision_count: { type: 'integer' }
  }
};

export const DataRequestStatusListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'array',
  items: DataRequestStatusResponseSchema
};
