import { ITicketWithTags } from './useTicketsApi.interface';

export interface IBoard {
  board_id: string;
  name: string;
  description: string | null;
  /** Hex color, `#RRGGBB`. */
  color: string;
  create_date: string;
}

/** A tag on a board: the board's link to the tag, with enough of the tag to render its chip. */
export interface IBoardTag {
  board_tag_id: string;
  tag_id: string;
  name: string;
  /** Hex color, `#RRGGBB`. */
  color: string;
}

export interface IBoardSummary extends IBoard {
  tags: IBoardTag[];
  swimlane_count: number;
}

export interface IBoardSwimlane {
  board_swimlane_id: string;
  board_id: string;
  name: string;
  description: string | null;
  /** Hex color, `#RRGGBB`, or null for the board's default lane color. */
  color: string | null;
  sort_order: number;
  is_visible: boolean;
  /** Tags of the lane's board that the lane holds tickets for. */
  tags: IBoardTag[];
}

export interface IBoardDetail extends IBoard {
  tags: IBoardTag[];
  /** Swimlanes in display order, including hidden ones. */
  swimlanes: IBoardSwimlane[];
}

export interface IGetBoardsResponse {
  boards: IBoardSummary[];
}

export interface IBoardRequest {
  name: string;
  description: string | null;
  color: string;
  /** The complete board tag set; tags not listed are removed from the board. */
  tagIds: string[];
}

export interface IBoardSwimlaneRequest {
  name: string;
  description: string | null;
  color: string | null;
  isVisible: boolean;
  /** The complete lane tag set, as ids of the board's tags; board tags not listed are removed from the lane. */
  boardTagIds: string[];
}

export interface IUpdateBoardSwimlaneOrderRequest {
  /** Every swimlane of the board, exactly once, in the desired left-to-right order. */
  swimlaneIds: string[];
}

export interface IBoardSwimlanesResponse {
  swimlanes: IBoardSwimlane[];
}

export interface IBoardTicketsQueryParams {
  include_closed: boolean;
}

export interface IBoardTicketsSwimlane {
  board_swimlane_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  tickets: ITicketWithTags[];
}

export interface IBoardTicketsResponse {
  board: IBoard;
  /** Board tickets that match no visible lane. */
  unsorted: ITicketWithTags[];
  /** Visible lanes in display order. */
  swimlanes: IBoardTicketsSwimlane[];
  /** Tickets that match only hidden lanes. */
  hidden_ticket_count: number;
}
