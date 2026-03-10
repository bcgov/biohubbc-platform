import { z } from 'zod';

export const CodeCategorySchema = z.object({
  code_category_id: z.number().int(),
  contributor_id: z.number().int(),
  value: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  version: z.string().nullable()
});

export type CodeCategory = z.infer<typeof CodeCategorySchema>;

export interface CreateCodeCategory {
  contributor_id: number;
  value: string;
  label: string;
  description?: string | null;
  version?: string | null;
}
