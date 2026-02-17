import { OpenAPIV3 } from 'openapi-types';

// ──────────────────────────────────────────────────────────────────────────────
// data_request
// ──────────────────────────────────────────────────────────────────────────────

export const DataRequestResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['requested_by', 'team_id', 'data_request_id', 'reason'],
  additionalProperties: false,
  properties: {
    data_request_id: { type: 'string', format: 'uuid' },
    reason: { type: 'string' },
    team_id: { type: 'string', format: 'uuid' },
    requested_by: { type: 'integer' }
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

export const CreateDataRequestRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['reason'],
  additionalProperties: false,
  properties: {
    team_id: { type: 'string', format: 'uuid', description: 'Team ID for the data request' },
    reason: { type: 'string', description: 'Reason for the data request' }
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
  required: ['comment', 'comment_id'],
  additionalProperties: false,
  properties: {
    comment_id: { type: 'string', format: 'uuid' },
    comment: { type: 'string' }
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// data_request_status
// ──────────────────────────────────────────────────────────────────────────────

export const DataRequestStatusResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['data_request_id', 'data_request_status_id', 'comment_id', 'request_status'],
  additionalProperties: false,
  properties: {
    data_request_status_id: { type: 'string', format: 'uuid' },
    data_request_id: { type: 'string', format: 'uuid' },
    comment_id: { type: 'string', format: 'uuid', nullable: true },
    request_status: { type: 'string', enum: ['REQUESTED', 'APPROVED', 'DENIED'] }
  }
};

export const DataRequestStatusListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'array',
  items: DataRequestStatusResponseSchema
};

export const DataRequestWithStatusResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['data_request_id', 'reason', 'team_id', 'requested_by', 'data_request_status'],
  additionalProperties: false,
  properties: {
    data_request_id: { type: 'string', format: 'uuid' },
    reason: { type: 'string' },
    team_id: { type: 'string', format: 'uuid' },
    requested_by: { type: 'integer' },
    data_request_status: DataRequestStatusResponseSchema
  }
};
