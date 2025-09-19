import { z } from 'zod';

export interface CreateContributor {
  clientId: string;
  members: {
    system_user_id: number;
  }[];
}

export const GetContributor = z.object({
  contributor_id: z.number(),
  client_id: z.string()
});

export type GetContributor = z.infer<typeof GetContributor>;
