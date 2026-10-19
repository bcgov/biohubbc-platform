import { z } from 'zod';

export const Tag = z.object({
  tag_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  create_date: z.string()
});
export type Tag = z.infer<typeof Tag>;

/**
 * Minimal tag shape embedded in ticket, board, and swimlane responses.
 */
export const TagSummary = z.object({
  tag_id: z.string().uuid(),
  name: z.string(),
  color: z.string()
});
export type TagSummary = z.infer<typeof TagSummary>;

/**
 * A tag linked to a board. Board swimlanes select tags by board_tag_id, so they can only use the board's tags.
 */
export const BoardTag = TagSummary.extend({
  board_tag_id: z.string().uuid()
});
export type BoardTag = z.infer<typeof BoardTag>;

export const TagId = z.object({
  tag_id: z.string().uuid()
});
export type TagId = z.infer<typeof TagId>;

export interface TagFilters {
  search?: string;
}

/**
 * Create or update tag request.
 */
export interface TagRequest {
  name: string;
  description: string | null;
  color: string;
}
