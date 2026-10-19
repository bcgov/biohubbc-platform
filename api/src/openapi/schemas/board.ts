import { OpenAPIV3 } from 'openapi-types';
import { TagColorSchema, TagIdsRequestPropertySchema } from './tag';
import { TicketWithTagsSchema } from './ticket';

export const BoardSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['board_id', 'name', 'description', 'color', 'create_date'],
  properties: {
    board_id: { type: 'string', format: 'uuid' },
    name: { type: 'string', maxLength: 100 },
    description: { type: 'string', maxLength: 500, nullable: true },
    color: TagColorSchema,
    create_date: { type: 'string', format: 'date-time' }
  }
};

export const BoardTagSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['board_tag_id', 'tag_id', 'name', 'color'],
  properties: {
    board_tag_id: { type: 'string', format: 'uuid' },
    tag_id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    color: TagColorSchema
  }
};

export const BoardSwimlaneSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['board_swimlane_id', 'board_id', 'name', 'description', 'color', 'sort_order', 'is_visible', 'tags'],
  properties: {
    board_swimlane_id: { type: 'string', format: 'uuid' },
    board_id: { type: 'string', format: 'uuid' },
    name: { type: 'string', maxLength: 100 },
    description: { type: 'string', maxLength: 250, nullable: true },
    color: { ...TagColorSchema, nullable: true },
    sort_order: { type: 'integer' },
    is_visible: { type: 'boolean' },
    tags: { type: 'array', items: BoardTagSchema }
  }
};

export const BoardListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['boards'],
  properties: {
    boards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [...(BoardSchema.required ?? []), 'tags', 'swimlane_count'],
        properties: {
          ...BoardSchema.properties,
          tags: { type: 'array', items: BoardTagSchema },
          swimlane_count: { type: 'integer', minimum: 0 }
        }
      }
    }
  }
};

export const BoardDetailSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: [...(BoardSchema.required ?? []), 'tags', 'swimlanes'],
  properties: {
    ...BoardSchema.properties,
    tags: { type: 'array', items: BoardTagSchema },
    swimlanes: {
      description: 'Swimlanes in display order (sort_order, then id), including hidden ones.',
      type: 'array',
      items: BoardSwimlaneSchema
    }
  }
};

export const BoardRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'description', 'color', 'tagIds'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string', maxLength: 500, nullable: true },
    color: TagColorSchema,
    tagIds: TagIdsRequestPropertySchema
  }
};

export const BoardSwimlaneRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'description', 'color', 'isVisible', 'boardTagIds'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string', maxLength: 250, nullable: true },
    color: { ...TagColorSchema, nullable: true },
    isVisible: { type: 'boolean' },
    boardTagIds: {
      type: 'array',
      items: { type: 'string', format: 'uuid' },
      description: 'Complete desired set of board tags (board_tag_id) for the swimlane. Must be tags of the board.'
    }
  }
};

export const ReorderBoardSwimlanesRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['swimlaneIds'],
  properties: {
    swimlaneIds: {
      type: 'array',
      items: { type: 'string', format: 'uuid' },
      description: 'Every active swimlane of the board, exactly once, in the desired left-to-right order.'
    }
  }
};

export const BoardSwimlaneListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['swimlanes'],
  properties: {
    swimlanes: { type: 'array', items: BoardSwimlaneSchema }
  }
};

export const BoardTicketsResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['board', 'unsorted', 'swimlanes', 'hidden_ticket_count'],
  properties: {
    board: BoardSchema,
    unsorted: {
      description: 'Board tickets matching no swimlane. Always visible and displayed first.',
      type: 'array',
      items: TicketWithTagsSchema
    },
    swimlanes: {
      description: 'Visible swimlanes in display order, each with its placed tickets.',
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['board_swimlane_id', 'name', 'color', 'sort_order', 'tickets'],
        properties: {
          board_swimlane_id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          color: { ...TagColorSchema, nullable: true },
          sort_order: { type: 'integer' },
          tickets: { type: 'array', items: TicketWithTagsSchema }
        }
      }
    },
    hidden_ticket_count: {
      description: 'Number of board tickets placed in hidden swimlanes and omitted from the response.',
      type: 'integer',
      minimum: 0
    }
  }
};
