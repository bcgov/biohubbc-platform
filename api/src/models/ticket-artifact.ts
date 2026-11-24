import { z } from 'zod';

export const TicketArtifact = z.object({
  ticket_artifact_id: z.guid(),
  ticket_id: z.guid(),
  artifact_id: z.guid(),
  record_end_date: z.string().nullable(),
  create_date: z.string(),
  object_key: z.string()
});

export type TicketArtifact = z.infer<typeof TicketArtifact>;
