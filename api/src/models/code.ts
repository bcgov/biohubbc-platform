import { z } from 'zod';

export const CodeSchema = z.object({
  code_id: z.number().int(),
  code_category_id: z.number().int(),
  value: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  version: z.string().nullable()
});

export type Code = z.infer<typeof CodeSchema>;

export interface CreateCode {
  code_category_id: number;
  value: string;
  label: string;
  description?: string | null;
  version?: string | null;
}
