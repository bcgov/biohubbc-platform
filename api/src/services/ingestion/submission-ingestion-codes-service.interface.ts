import { z } from 'zod';

export const TarCodesetCode = z.object({
  label: z.string().trim().min(1).optional(),
  external_id: z.string().optional(),
  description: z.string().optional()
});
export type TarCodesetCode = z.infer<typeof TarCodesetCode>;

export const TarCodeset = z.object({
  label: z.string().trim().min(1).optional(),
  external_id: z.string().optional(),
  description: z.string().optional(),
  codes: z.record(z.string(), TarCodesetCode).optional()
});
export type TarCodeset = z.infer<typeof TarCodeset>;

export const TarCodesets = z.record(z.string(), TarCodeset);
export type TarCodesets = z.infer<typeof TarCodesets>;
