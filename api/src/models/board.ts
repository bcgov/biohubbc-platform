import { z } from 'zod';
import { BoardTag } from './tag';
import { TicketWithTags } from './ticket';

export const Board = z.object({
  board_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  create_date: z.string()
});
export type Board = z.infer<typeof Board>;

export const BoardSummary = Board.extend({
  tags: z.array(BoardTag),
  swimlane_count: z.number()
});
export type BoardSummary = z.infer<typeof BoardSummary>;

export const BoardSwimlane = z.object({
  board_swimlane_id: z.string().uuid(),
  board_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  sort_order: z.number(),
  is_visible: z.boolean(),
  tags: z.array(BoardTag)
});
export type BoardSwimlane = z.infer<typeof BoardSwimlane>;

export const BoardTagId = z.object({
  board_tag_id: z.string().uuid()
});
export type BoardTagId = z.infer<typeof BoardTagId>;

export const BoardSwimlaneId = z.object({
  board_swimlane_id: z.string().uuid()
});
export type BoardSwimlaneId = z.infer<typeof BoardSwimlaneId>;

export interface BoardDetail extends Board {
  tags: BoardTag[];
  swimlanes: BoardSwimlane[];
}

/**
 * A ticket on a board with its placed lane. A null lane means the implicit "Unsorted" bucket.
 */
export const BoardTicket = TicketWithTags.extend({
  board_swimlane_id: z.string().uuid().nullable()
});
export type BoardTicket = z.infer<typeof BoardTicket>;

export interface BoardTicketSwimlane {
  board_swimlane_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  tickets: TicketWithTags[];
}

export interface BoardTickets {
  board: Board;
  unsorted: TicketWithTags[];
  swimlanes: BoardTicketSwimlane[];
  hidden_ticket_count: number;
}

export interface BoardTicketFilters {
  include_closed: boolean;
}

/**
 * Board columns written on insert and update.
 */
export interface BoardPayload {
  name: string;
  description: string | null;
  color: string;
}

/**
 * Board swimlane columns written on insert and update.
 */
export interface BoardSwimlanePayload {
  name: string;
  description: string | null;
  color: string | null;
  is_visible: boolean;
}

/**
 * Create or update board request. Tags are replaced as a set.
 */
export interface BoardRequest {
  name: string;
  description: string | null;
  color: string;
  tagIds: string[];
}

/**
 * Create or update board swimlane request. Board tags are replaced as a set and must belong to the board.
 */
export interface BoardSwimlaneRequest {
  name: string;
  description: string | null;
  color: string | null;
  isVisible: boolean;
  boardTagIds: string[];
}
