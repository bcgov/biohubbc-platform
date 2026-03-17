import { z } from 'zod';

export const CountResult = z.object({
  count: z.number()
});

export type CountResult = z.infer<typeof CountResult>;
