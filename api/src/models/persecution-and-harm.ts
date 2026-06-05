import { z } from 'zod';

export const PersecutionAndHarmSecurity = z.object({
  persecution_or_harm_id: z.number(),
  persecution_or_harm_type_id: z.number(),
  wldtaxonomic_units_id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional()
});

export type PersecutionAndHarmSecurity = z.infer<typeof PersecutionAndHarmSecurity>;

export const SecurityReason = z.object({
  id: z.number(),
  type_id: z.number()
});

export type SecurityReason = z.infer<typeof SecurityReason>;

export const ArtifactPersecution = z.object({
  artifact_persecution_id: z.number(),
  persecution_or_harm_id: z.number(),
  artifact_id: z.number()
});

export type ArtifactPersecution = z.infer<typeof ArtifactPersecution>;
