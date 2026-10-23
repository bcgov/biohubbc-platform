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
 * Minimal tag shape embedded in ticket responses.
 */
export const TagSummary = z.object({
  tag_id: z.string().uuid(),
  name: z.string(),
  color: z.string()
});
export type TagSummary = z.infer<typeof TagSummary>;

export const TagId = z.object({
  tag_id: z.string().uuid()
});
export type TagId = z.infer<typeof TagId>;

export interface TagFilters {
  search?: string;
  /**
   * Only tags linked to this board.
   */
  board_id?: string;
}

/**
 * Create or update tag request.
 */
export interface TagRequest {
  name: string;
  description: string | null;
  color: string;
}
