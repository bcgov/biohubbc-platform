import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';

const TicketPriorityEnum = ['low', 'medium', 'high', 'critical'];
const TicketStatusEnum = ['open', 'closed'];

export const TicketSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['ticket_id', 'ticket_slug', 'title', 'team_id', 'create_date', 'priority', 'status'],
  properties: {
    ticket_id: { type: 'string', format: 'uuid' },
    ticket_slug: { type: 'string', minLength: 8, maxLength: 8, pattern: '^\\d{8}$' },
    title: { type: 'string', maxLength: 100 },
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
    'title',
    'team_id',
    'create_date',
    'priority',
    'status',
    'status_log',
    'comment_log'
  ],
  properties: {
    ticket_id: { type: 'string', format: 'uuid' },
    ticket_slug: { type: 'string', minLength: 8, maxLength: 8, pattern: '^\\d{8}$' },
    title: { type: 'string', maxLength: 100 },
    description: { type: 'string', maxLength: 2000, nullable: true },
    team_id: { type: 'string', format: 'uuid' },
    create_date: { type: 'string', format: 'date-time' },
    priority: { type: 'string', enum: TicketPriorityEnum },
    status: { type: 'string', enum: TicketStatusEnum },
    status_log: {
      type: 'array',
      items: {
        type: 'object',
        required: ['ticket_status_history_id', 'ticket_id', 'user_identifier', 'create_date', 'status'],
        properties: {
          ticket_status_history_id: { type: 'string', format: 'uuid' },
          ticket_id: { type: 'string', format: 'uuid' },
          user_identifier: { type: 'string' },
          create_date: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: TicketStatusEnum }
        }
      }
    },
    comment_log: {
      type: 'array',
      items: {
        type: 'object',
        required: ['ticket_comment_id', 'ticket_id', 'user_identifier', 'create_date', 'comment'],
        properties: {
          ticket_comment_id: { type: 'string', format: 'uuid' },
          ticket_id: { type: 'string', format: 'uuid' },
          user_identifier: { type: 'string' },
          create_date: { type: 'string', format: 'date-time' },
          comment: { type: 'string' }
        }
      }
    }
  }
};

export const CreateTicketRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'priority'],
  properties: {
    title: { type: 'string', maxLength: 100 },
    description: { type: 'string', maxLength: 2000, nullable: true },
    priority: { type: 'string', enum: TicketPriorityEnum }
  }
};

export const UpdateTicketRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', maxLength: 100 },
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
    comment: { type: 'string', minLength: 1, maxLength: 3000 }
  }
};

export const TicketStatusHistorySchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['ticket_id', 'user_identifier', 'create_date'],
  properties: {
    ticket_status_history_id: { type: 'string', format: 'uuid', nullable: true },
    ticket_comment_id: { type: 'string', format: 'uuid', nullable: true },
    ticket_id: { type: 'string', format: 'uuid' },
    user_identifier: { type: 'string' },
    create_date: { type: 'string', format: 'date-time' },
    status: { type: 'string', enum: TicketStatusEnum, nullable: true },
    comment: { type: 'string', nullable: true }
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
