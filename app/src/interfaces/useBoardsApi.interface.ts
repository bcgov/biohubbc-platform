import { ITicketWithTags, TicketPriority } from 'interfaces/useTicketsApi.interface';
import { ApiPaginationRequestOptions, ApiPaginationResponseParams } from 'types/pagination';

export interface IBoard {
  board_id: string;
  name: string;
  description: string | null;
  /** The lane tickets created on or added to the board go in, To Do unless it was changed. */
  default_swimlane_id: string | null;
  create_date: string;
}

/** A lane of a board. Every ticket on the board is in exactly one of its lanes. */
export interface IBoardSwimlane {
  board_swimlane_id: string;
  board_id: string;
  name: string;
  description: string | null;
  /** Hex color, `#RRGGBB`. */
  color: string | null;
  sort_order: number;
}

/** A board read or saved on its own, with its swimlanes in display order. */
export interface IBoardDetail extends IBoard {
  swimlanes: IBoardSwimlane[];
}

export interface IBoardsQueryParams extends Partial<ApiPaginationRequestOptions> {
  search?: string;
}

export interface IGetBoardsResponse {
  boards: IBoard[];
  pagination: ApiPaginationResponseParams;
}

export interface IBoardRequest {
  name: string;
  description: string | null;
}

export type IBoardSwimlanesQueryParams = Partial<ApiPaginationRequestOptions>;

export interface IGetBoardSwimlanesResponse {
  swimlanes: IBoardSwimlane[];
  pagination: ApiPaginationResponseParams;
}

export interface IBoardSwimlaneRequest {
  name: string;
  description: string | null;
  /** Hex color, `#RRGGBB`. */
  color: string | null;
  /** Left-to-right position: higher is further right. Omitted to create the lane last, or to keep its position. */
  sortOrder?: number;
}

/** A board lane with the board's open tickets in it. */
export interface IBoardTicketSwimlane {
  board_swimlane_id: string;
  name: string;
  /** Hex color, `#RRGGBB`. */
  color: string | null;
  sort_order: number;
  tickets: ITicketWithTags[];
}

/** A board's open tickets, every one of them and grouped by lane. Each ticket is in exactly one lane. */
export interface IBoardTickets {
  board: IBoard;
  /** Every ticket on the board. */
  tickets: ITicketWithTags[];
  /** Every lane in display order, hidden ones included. */
  swimlanes: IBoardTicketSwimlane[];
}

/** Puts a ticket on a board, or moves it to another of the board's lanes. */
export interface IBoardTicketRequest {
  /** The lane the ticket is put or moved in; omitted, a ticket not on the board goes in its default lane, To Do. */
  boardSwimlaneId?: string;
  /** Zero-based position within the lane; omitted, a ticket that changes lane goes last. Requires a lane. */
  position?: number;
}

/** Creates a ticket on a board, in its default lane, To Do. */
export interface IBoardTicketCreateRequest {
  subject: string;
  description: string | null;
  priority: TicketPriority;
}
