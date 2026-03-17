import { z } from 'zod';

export const Comment = z.object({
  comment_id: z.string().uuid(),
  comment: z.string()
});
export type Comment = z.infer<typeof Comment>;

export interface UpdateComment {
  comment: string;
}
