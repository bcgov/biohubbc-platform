import { z } from 'zod';

/**
 * Submission record schema for a single feature
 */
export const PostSubmissionFeatureSchema: z.ZodType<any> = z.object({
  id: z.string().min(1, 'Feature id is required'),
  type: z.string().min(1, 'Feature type is required'),
  properties: z.record(z.any()),
  child_features: z.array(z.lazy(() => PostSubmissionFeatureSchema)).optional()
});

/**
 * Schema for an array of submission features
 */
export const PostSubmissionFeatureArraySchema = z.array(PostSubmissionFeatureSchema);

// Infer the types
export type PostSubmissionFeature = z.infer<typeof PostSubmissionFeatureSchema>;
export type PostSubmissionFeatureArray = z.infer<typeof PostSubmissionFeatureArraySchema>;

/**
 * Submission record schema
 */
export const SubmissionFeature = z.object({
  submission_id: z.number(),
  uuid: z.string(),
  uri: z.string().nullable(),
  quarantine_id: z.string().nullable(),
  security_review_timestamp: z.string().nullable(),
  submitted_timestamp: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  comment: z.string().nullable(),
  publish_timestamp: z.string().nullable()
});

export type SubmissionFeature = z.infer<typeof SubmissionFeature>;
