import { z } from 'zod';
import { TicketPriority, TicketWithTags } from './ticket';

export const Board = z.object({
  board_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  /** The lane tickets created on or added to the board go in. */
  default_swimlane_id: z.string().uuid().nullable(),
  create_date: z.string()
});
export type Board = z.infer<typeof Board>;

export const BoardSwimlane = z.object({
  board_swimlane_id: z.string().uuid(),
  board_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  sort_order: z.number(),
  is_visible: z.boolean()
});
export type BoardSwimlane = z.infer<typeof BoardSwimlane>;

export const BoardSwimlaneId = z.object({
  board_swimlane_id: z.string().uuid()
});
export type BoardSwimlaneId = z.infer<typeof BoardSwimlaneId>;

export interface BoardDetail extends Board {
  swimlanes: BoardSwimlane[];
}

/**
 * A ticket on a board with the lane it is in.
 */
export const BoardTicket = TicketWithTags.extend({
  board_swimlane_id: z.string().uuid()
});
export type BoardTicket = z.infer<typeof BoardTicket>;

export interface BoardTicketSwimlane {
  board_swimlane_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  is_visible: boolean;
  tickets: TicketWithTags[];
}

export interface BoardTickets {
  board: Board;
  /** Every ticket on the board. */
  tickets: TicketWithTags[];
  swimlanes: BoardTicketSwimlane[];
}

export interface BoardFilters {
  search?: string;
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
}

/**
 * Board swimlane columns written on insert and update. Lanes are inserted visible, and updates keep their visibility.
 */
export interface BoardSwimlanePayload {
  name: string;
  description: string | null;
  color: string | null;
  /** Left-to-right position; omitted to insert the lane last, or to keep its position on update. */
  sort_order?: number;
}

/**
 * Create or update board request.
 */
export interface BoardRequest {
  name: string;
  description: string | null;
}

/**
 * Create or update board swimlane request.
 */
export interface BoardSwimlaneRequest {
  name: string;
  description: string | null;
  color: string | null;
  /** Left-to-right position: higher is further right. Omitted to create the lane last, or to keep its position. */
  sortOrder?: number;
}

/**
 * Put a ticket on a board, or move it to another of the board's lanes.
 */
export interface BoardTicketRequest {
  /** The board's lane the ticket is in; omitted to put a ticket not on the board in its default lane. */
  boardSwimlaneId?: string;
  /** Zero-based position within the lane; omitted to put the ticket last when it changes lane. Requires a lane. */
  position?: number;
}

/**
 * Create a ticket on a board, in the board's default lane.
 */
export interface BoardTicketCreateRequest {
  subject: string;
  description: string | null;
  priority: TicketPriority;
}
