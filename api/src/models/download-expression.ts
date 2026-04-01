import { z } from 'zod';

/**
 * Join model attaching an expression to a download filter.
 *
 * Enables reusable expression trees to scope download results.
 */
export const DownloadExpression = z.object({
  download_expression_id: z.string().uuid(),
  download_id: z.string().uuid(),
  expression_id: z.string().uuid()
});

export type DownloadExpression = z.infer<typeof DownloadExpression>;

export interface CreateDownloadExpression {
  download_id: string;
  expression_id: string;
}
