import { OpenAPIV3 } from 'openapi-types';

export const DataRequestStatusResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['data_request_id', 'data_request_status_id', 'request_status'],
  additionalProperties: false,
  properties: {
    data_request_status_id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the data request status'
    },
    data_request_id: {
      type: 'string',
      format: 'uuid',
      description: 'ID of the associated data request'
    },
    comment_id: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'ID of the associated comment (if any)'
    },
    request_status: {
      type: 'string',
      enum: ['REQUESTED', 'APPROVED', 'DENIED'],
      description: 'Current status of the data request'
    }
  }
};

export const DataRequestStatusListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'array',
  items: DataRequestStatusResponseSchema
};
