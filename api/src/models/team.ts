import { z } from 'zod';

// Zod schema for full DB Team record
export const Team = z.object({
  team_id: z.string().uuid(),
  name: z.string().max(250),
  description: z.string().max(1000).nullable()
});

// TypeScript type inferred from Zod schema
export type Team = z.infer<typeof Team>;

// Plain TypeScript interface for creating a team
export interface CreateTeam {
  name: string;
  description?: string;
}

// Plain TypeScript interface for updating a team
export interface UpdateTeam {
  name?: string;
  description?: string;
  record_end_date?: string;
}
