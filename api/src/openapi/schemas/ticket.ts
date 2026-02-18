import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';

const TicketPriorityEnum = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const TicketStatusEnum = ['OPEN', 'CLOSED'];

export const TicketSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'ticket_id',
    'ticket_number',
    'title',
    'team_id',
    'priority',
    'status'
  ],
  properties: {
    ticket_id: { type: 'string', format: 'uuid' },
    ticket_number: { type: 'integer' },
    title: { type: 'string', maxLength: 100 },
    description: { type: 'string', maxLength: 2000, nullable: true },
    team_id: { type: 'string', format: 'uuid' },
    priority: { type: 'string', enum: TicketPriorityEnum },
    status: { type: 'string', enum: TicketStatusEnum }
  }
};

export const CreateTicketRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'team_id'],
  properties: {
    title: { type: 'string', maxLength: 100 },
    description: { type: 'string', maxLength: 2000 },
    team_id: { type: 'string', format: 'uuid' },
    priority: { type: 'string', enum: TicketPriorityEnum }
  }
};

export const UpdateTicketRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', maxLength: 100 },
    description: { type: 'string', maxLength: 2000 },
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

export const TicketStatusHistorySchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['ticket_status_history_id', 'ticket_id', 'status'],
  properties: {
    ticket_status_history_id: { type: 'string', format: 'uuid' },
    ticket_id: { type: 'string', format: 'uuid' },
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

export const TicketStatusHistoryListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'array',
  items: TicketStatusHistorySchema
};
