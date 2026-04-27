import { z } from 'zod';

export enum FEATURE_PROPERTY_TYPE {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  SPATIAL = 'spatial',
  DATETIME = 'datetime',
  CODE = 'code',
  TAXON = 'taxon',
  ARTIFACT_KEY = 'artifact_key'
}

export const FeaturePropertyTypeName = z.enum([
  'string',
  'number',
  'boolean',
  'spatial',
  'datetime',
  'code',
  'taxon',
  'artifact_key'
]);

export const SubmissionFeatureProperty = z.object({
  id: z.string(),
  property: z.string(),
  value: z.string()
});

export type SubmissionFeatureProperty = z.infer<typeof SubmissionFeatureProperty>;
