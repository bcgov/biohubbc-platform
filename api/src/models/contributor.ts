import { z } from 'zod';

export const Contributor = z.object({
  contributor_id: z.number(),
  client_id: z.string()
});

export type Contributor = z.infer<typeof Contributor>;
