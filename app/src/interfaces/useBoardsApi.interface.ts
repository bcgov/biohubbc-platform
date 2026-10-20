import { ApiPaginationRequestOptions, ApiPaginationResponseParams } from 'types/pagination';

export interface IBoard {
  board_id: string;
  name: string;
  description: string | null;
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

/** A board in the board list, with its tags. */
export interface IBoardSummary extends IBoard {
  tags: IBoardTag[];
}

/** A board read or saved on its own, with its tags. */
export interface IBoardDetail extends IBoard {
  tags: IBoardTag[];
}

export interface IBoardsQueryParams extends Partial<ApiPaginationRequestOptions> {
  search?: string;
}

export interface IGetBoardsResponse {
  boards: IBoardSummary[];
  pagination: ApiPaginationResponseParams;
}

export interface IBoardRequest {
  name: string;
  description: string | null;
  /** The complete board tag set; tags not listed are removed from the board. */
  tagIds: string[];
}
