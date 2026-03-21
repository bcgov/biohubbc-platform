import { z } from 'zod';

export const TarCodesetCode = z.object({
  key: z.string(),
  label: z.string().trim().min(1).nullable(),
  external_id: z.string().nullable(),
  description: z.string().nullable()
});
export type TarCodesetCode = z.infer<typeof TarCodesetCode>;

export const TarCodeset = z.object({
  key: z.string(),
  label: z.string().trim().min(1).nullable(),
  external_id: z.string().nullable(),
  description: z.string().nullable(),
  codes: z.record(z.string(), TarCodesetCode)
});
export type TarCodeset = z.infer<typeof TarCodeset>;

export const TarCodesets = z.record(z.string(), TarCodeset);
export type TarCodesets = z.infer<typeof TarCodesets>;
