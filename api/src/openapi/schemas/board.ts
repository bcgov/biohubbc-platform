import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';
import { TagColorSchema } from './tag';
import { TicketWithTagsSchema } from './ticket';

export const BoardSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['board_id', 'name', 'description', 'default_swimlane_id', 'create_date'],
  properties: {
    board_id: { type: 'string', format: 'uuid' },
    name: { type: 'string', maxLength: 100 },
    description: { type: 'string', maxLength: 500, nullable: true },
    default_swimlane_id: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'The swimlane tickets created on or added to the board go in.'
    },
    create_date: { type: 'string', format: 'date-time' }
  }
};

export const BoardSwimlaneSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['board_swimlane_id', 'board_id', 'name', 'description', 'color', 'sort_order', 'is_visible'],
  properties: {
    board_swimlane_id: { type: 'string', format: 'uuid' },
    board_id: { type: 'string', format: 'uuid' },
    name: { type: 'string', maxLength: 100 },
    description: { type: 'string', maxLength: 250, nullable: true },
    color: { ...TagColorSchema, nullable: true },
    sort_order: { type: 'integer' },
    is_visible: { type: 'boolean' }
  }
};

export const BoardListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['boards', 'pagination'],
  properties: {
    boards: { type: 'array', items: BoardSchema },
    pagination: paginationResponseSchema
  }
};

export const BoardDetailSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: [...(BoardSchema.required ?? []), 'swimlanes'],
  properties: {
    ...BoardSchema.properties,
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
  required: ['name', 'description'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string', maxLength: 500, nullable: true }
  }
};

export const BoardSwimlaneRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'description', 'color'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string', maxLength: 250, nullable: true },
    color: { ...TagColorSchema, nullable: true },
    sortOrder: {
      type: 'integer',
      minimum: 0,
      description:
        'Left-to-right position: higher is further right; ties keep their order. Omitted, a new swimlane goes last and an edited one keeps its position.'
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

export const BoardTicketRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    boardSwimlaneId: {
      type: 'string',
      format: 'uuid',
      description:
        "The board's swimlane the ticket is put or moved in. Omitted, a ticket not on the board is put in the board's default swimlane, and a ticket on it stays in its swimlane."
    },
    position: {
      type: 'integer',
      minimum: 0,
      description:
        'Zero-based position of the ticket within the swimlane; past the end puts it last. Omitted, a ticket that changes swimlane goes last. Requires boardSwimlaneId.'
    }
  }
};

export const BoardSwimlanePageResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['swimlanes', 'pagination'],
  properties: {
    swimlanes: { type: 'array', items: BoardSwimlaneSchema },
    pagination: paginationResponseSchema
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
  required: ['board', 'tickets', 'swimlanes'],
  properties: {
    board: BoardSchema,
    tickets: {
      description: 'Every ticket on the board.',
      type: 'array',
      items: TicketWithTagsSchema
    },
    swimlanes: {
      description:
        'Swimlanes in display order, including hidden ones, each with the tickets in it. Each ticket is in exactly one swimlane.',
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['board_swimlane_id', 'name', 'color', 'sort_order', 'is_visible', 'tickets'],
        properties: {
          board_swimlane_id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          color: { ...TagColorSchema, nullable: true },
          sort_order: { type: 'integer' },
          is_visible: { type: 'boolean' },
          tickets: { type: 'array', items: TicketWithTagsSchema }
        }
      }
    }
  }
};
