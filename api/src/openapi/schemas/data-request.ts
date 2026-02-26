import { OpenAPIV3 } from 'openapi-types';
import { DataRequestStatusResponseSchema } from './data-request-status';

export const DataRequestResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['requested_by', 'team_id', 'data_request_id', 'reason', 'data_request_status'],
  additionalProperties: false,
  properties: {
    data_request_id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the data request'
    },
    reason: {
      type: 'string',
      description: 'Reason for the data request'
    },
    team_id: {
      type: 'string',
      format: 'uuid',
      description: 'ID of the team associated with this request'
    },
    requested_by: {
      type: 'integer',
      description: 'System user ID of the requester'
    },
    data_request_status: {
      ...DataRequestStatusResponseSchema,
      description: 'Current status details of the data request'
    }
  }
};

export const DataRequestListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'array',
  items: DataRequestResponseSchema
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

// Alias for DataRequestResponseSchema for backward compatibility
export const DataRequestWithStatusResponseSchema: OpenAPIV3.SchemaObject = DataRequestResponseSchema;
