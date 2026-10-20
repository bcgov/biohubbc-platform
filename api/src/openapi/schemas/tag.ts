import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';

export const TagColorSchema: OpenAPIV3.SchemaObject = {
  type: 'string',
  pattern: '^#[0-9A-Fa-f]{6}$',
  description: 'Hex color (#RRGGBB).'
};

export const TagSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['tag_id', 'name', 'description', 'color', 'create_date'],
  properties: {
    tag_id: { type: 'string', format: 'uuid' },
    name: { type: 'string', maxLength: 50 },
    description: { type: 'string', maxLength: 250, nullable: true },
    color: TagColorSchema,
    create_date: { type: 'string', format: 'date-time' }
  }
};

export const TagSummarySchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['tag_id', 'name', 'color'],
  properties: {
    tag_id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    color: TagColorSchema
  }
};

export const TagListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['tags', 'pagination'],
  properties: {
    tags: { type: 'array', items: TagSchema },
    pagination: paginationResponseSchema
  }
};

export const TagRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'description', 'color'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 50 },
    description: { type: 'string', maxLength: 250, nullable: true },
    color: TagColorSchema
  }
};

export const TagIdsRequestPropertySchema: OpenAPIV3.SchemaObject = {
  type: 'array',
  items: { type: 'string', format: 'uuid' },
  description: 'Complete desired tag set. Tags not listed are removed.'
};

export const ReplaceTicketTagsRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['tagIds'],
  properties: {
    tagIds: TagIdsRequestPropertySchema
  }
};

export const TicketTagsResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['tags', 'events'],
  properties: {
    tags: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tag_id', 'name', 'color', 'tag_rule_id', 'tag_rule_name'],
        properties: {
          tag_id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          color: TagColorSchema,
          tag_rule_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'The tag rule that applied the tag; null when applied manually.'
          },
          tag_rule_name: { type: 'string', nullable: true }
        }
      }
    },
    events: {
      description: 'Tag added/removed history, oldest first. Admin timeline only.',
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'ticket_tag_id',
          'tag_id',
          'tag_name',
          'tag_color',
          'action',
          'user_identifier',
          'tag_rule_name',
          'event_date'
        ],
        properties: {
          ticket_tag_id: { type: 'string', format: 'uuid' },
          tag_id: { type: 'string', format: 'uuid' },
          tag_name: { type: 'string' },
          tag_color: TagColorSchema,
          action: { type: 'string', enum: ['added', 'removed'] },
          user_identifier: { type: 'string', nullable: true },
          tag_rule_name: {
            type: 'string',
            nullable: true,
            description: 'The tag rule that applied the tag; null when applied manually.'
          },
          event_date: { type: 'string', format: 'date-time' }
        }
      }
    }
  }
};
