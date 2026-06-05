import { OpenAPIV3 } from 'openapi-types';
import { featureSearchExpressionTreeSchema } from './search/search-feature';

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
  required: ['reason', 'system_user_ids', 'featureTypes', 'expression'],
  additionalProperties: false,
  properties: {
    reason: { type: 'string', description: 'Reason for the data request' },
    system_user_ids: {
      type: 'array',
      description: 'System user ids to add to created data-request and policy-linked teams',
      items: { type: 'integer' }
    },
    featureTypes: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      description:
        'Feature-type names to scope the requested policy. One ALLOW policy statement is created per feature type with URN urn:*:<featureType>:*.'
    },
    expression: {
      ...featureSearchExpressionTreeSchema,
      nullable: true,
      description:
        'Applied expression tree, or null when the user requests every feature of the selected type. When non-null, persisted once and linked as a fine-grained condition to every per-feature-type statement.'
    }
  }
};

export const CreateTicketDataRequestRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['requested_by', 'reason', 'system_user_ids'],
  additionalProperties: false,
  properties: {
    requested_by: {
      type: 'integer',
      description: 'System user id of the principal subject of the request.'
    },
    reason: { type: 'string', description: 'Reason for the data request' },
    system_user_ids: {
      type: 'array',
      description: 'Additional collaborators to add to the created data-request and policy-linked teams',
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
