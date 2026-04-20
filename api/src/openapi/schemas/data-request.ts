import { OpenAPIV3 } from 'openapi-types';

export const DataRequestResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['requested_by', 'team_id', 'data_request_id', 'reason', 'ticket_id', 'policy_id', 'status', 'create_date'],
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
    ticket_id: {
      type: 'string',
      format: 'uuid',
      description: 'ID of the ticket associated with this data request'
    },
    policy_id: {
      type: 'string',
      format: 'uuid',
      description: 'ID of the policy associated with this data request'
    },
    status: {
      type: 'string',
      enum: ['requested', 'reviewed', 'approved', 'denied'],
      description: 'Derived workflow status from associated policy.status'
    },
    create_date: {
      type: 'string',
      format: 'date-time',
      description: 'Timestamp when the data request was created'
    }
  }
};

export const DataRequestListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'array',
  items: DataRequestResponseSchema
};

export const CreateDataRequestRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['reason', 'system_user_ids'],
  additionalProperties: false,
  properties: {
    reason: { type: 'string', description: 'Reason for the data request' },
    system_user_ids: {
      type: 'array',
      description: 'System user ids to add to created data-request and policy-linked teams',
      items: { type: 'integer' }
    }
  }
};

export const UpdateDataRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reason: { type: 'string' }
  }
};
