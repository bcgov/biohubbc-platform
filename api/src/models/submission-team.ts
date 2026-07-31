import { z } from 'zod';

export const SubmissionTeam = z.object({
  submission_team_id: z.number().int(),
  submission_id: z.number().int(),
  team_id: z.string().uuid()
});

export type SubmissionTeam = z.infer<typeof SubmissionTeam>;

export interface CreateSubmissionTeam {
  submission_id: number;
  team_id: string;
}
