import { z } from 'zod';

export const TicketArtifact = z.object({
  ticket_artifact_id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  artifact_id: z.string().uuid(),
  record_end_date: z.string().nullable(),
  create_date: z.string(),
  key: z.string()
});

export type TicketArtifact = z.infer<typeof TicketArtifact>;
