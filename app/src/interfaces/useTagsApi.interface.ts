import { ApiPaginationRequestOptions, ApiPaginationResponseParams } from 'types/pagination';

/** A tag as shown on tickets, boards and swimlanes: enough to render its chip. */
export interface ITagSummary {
  tag_id: string;
  name: string;
  /** Hex color, `#RRGGBB`. */
  color: string;
}

export interface ITag {
  tag_id: string;
  name: string;
  description: string | null;
  /** Hex color, `#RRGGBB`. */
  color: string;
  create_date: string;
}

export type TicketTagEventAction = 'added' | 'removed';

/** One tag being added to or removed from a ticket, shown on the administrative ticket timeline. */
export interface ITicketTagEvent {
  ticket_tag_id: string;
  tag_id: string;
  tag_name: string;
  tag_color: string;
  action: TicketTagEventAction;
  user_identifier: string | null;
  event_date: string;
}

export interface ITagsQueryParams extends Partial<ApiPaginationRequestOptions> {
  search?: string;
  /** Only the tags on this board. */
  board_id?: string;
}

export interface IGetTagsResponse {
  tags: ITag[];
  pagination: ApiPaginationResponseParams;
}

/** A tag's complete editable fields, sent when creating a tag or replacing an existing one. */
export interface ITagRequest {
  name: string;
  description: string | null;
  /** Hex color, `#RRGGBB`. */
  color: string;
}

/** A ticket's current tags and its tag history, oldest first. */
export interface ITicketTagsResponse {
  tags: ITagSummary[];
  events: ITicketTagEvent[];
}

export interface IUpdateTicketTagsRequest {
  /** The complete tag set; tags not listed are removed from the ticket. */
  tagIds: string[];
}
