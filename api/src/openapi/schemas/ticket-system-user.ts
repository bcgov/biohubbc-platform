import { OpenAPIV3 } from 'openapi-types';

export const TicketSystemUserStatusEnum = ['requested', 'started', 'blocked', 'resolved'];

export const TicketSystemUserStatusSchema: OpenAPIV3.SchemaObject = {
  type: 'string',
  enum: TicketSystemUserStatusEnum
};

export const CreateTicketSystemUserSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['system_user_id', 'status'],
  properties: {
    system_user_id: { type: 'integer' },
    status: TicketSystemUserStatusSchema
  }
};

export const CreateTicketSystemUsersRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'array',
  items: CreateTicketSystemUserSchema
};

export const UpdateTicketSystemUserStatusRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: TicketSystemUserStatusSchema
  }
};

export const TicketSystemUserSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['ticket_system_user_id', 'ticket_id', 'system_user_id', 'status'],
  properties: {
    ticket_system_user_id: { type: 'string', format: 'uuid' },
    ticket_id: { type: 'string', format: 'uuid' },
    system_user_id: { type: 'integer' },
    status: TicketSystemUserStatusSchema
  }
};

export const TicketSystemUserWithUserSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['ticket_system_user_id', 'ticket_id', 'system_user_id', 'status', 'system_user'],
  properties: {
    ticket_system_user_id: { type: 'string', format: 'uuid' },
    ticket_id: { type: 'string', format: 'uuid' },
    system_user_id: { type: 'integer' },
    status: TicketSystemUserStatusSchema,
    system_user: {
      type: 'object',
      required: ['system_user_id', 'display_name', 'user_identifier', 'email'],
      properties: {
        system_user_id: { type: 'integer' },
        display_name: { type: 'string', nullable: true },
        user_identifier: { type: 'string' },
        email: { type: 'string', nullable: true }
      }
    }
  }
};
