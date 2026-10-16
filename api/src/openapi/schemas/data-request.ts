import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';
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

export const DataRequestListItemSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'data_request_id',
    'reason',
    'status',
    'create_date',
    'requested_by',
    'requested_by_name',
    'ticket_id',
    'policy_id'
  ],
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
    status: {
      type: 'string',
      description: 'Decision on the data request: the status of its policy'
    },
    create_date: {
      type: 'string',
      description: 'When the data request was submitted'
    },
    requested_by: {
      type: 'integer',
      description: 'System user ID of the requester'
    },
    requested_by_name: {
      type: 'string',
      nullable: true,
      description: 'Name of the requester'
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
    }
  }
};

export const DataRequestRecipientsResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['recipients'],
  additionalProperties: false,
  properties: {
    recipients: {
      type: 'array',
      description: 'The users who receive access when the data request is approved',
      items: {
        type: 'object',
        required: ['system_user_id', 'user_identifier', 'display_name', 'email'],
        additionalProperties: false,
        properties: {
          system_user_id: {
            type: 'integer',
            description: 'System user ID of the recipient'
          },
          user_identifier: {
            type: 'string',
            description: 'Identifier of the recipient'
          },
          display_name: {
            type: 'string',
            nullable: true,
            description: 'Display name of the recipient'
          },
          email: {
            type: 'string',
            nullable: true,
            description: 'Email of the recipient'
          }
        }
      }
    }
  }
};

export const DataRequestFeatureTypesResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['feature_types'],
  additionalProperties: false,
  properties: {
    feature_types: {
      type: 'array',
      description: 'The unique feature types the data request asks for',
      items: {
        type: 'object',
        required: ['feature_type_name', 'expression'],
        additionalProperties: false,
        properties: {
          feature_type_name: {
            type: 'string',
            description: 'Name of the requested feature type'
          },
          expression: {
            type: 'object',
            nullable: true,
            description:
              'Expression tree that limits the requested features of this type, or null when every feature is requested'
          }
        }
      }
    }
  }
};

export const DataRequestPaginatedListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['data_requests', 'pagination'],
  additionalProperties: false,
  properties: {
    data_requests: {
      type: 'array',
      items: DataRequestListItemSchema
    },
    pagination: paginationResponseSchema
  }
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
