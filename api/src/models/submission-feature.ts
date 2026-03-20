import { z } from 'zod';
import { ArtifactSecurity } from './artifact-security';

/**
 * Model for a single submission feature
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

export const CreateSubmissionFeatureSchema = z.object({
  id: z.string().min(1, 'Feature id is required'),
  type: z.string().min(1, 'Feature type is required'),
  properties: z.record(z.unknown()),
  references: z.array(z.string()),
  parent: z.string().nullable()
});

export type CreateSubmissionFeature = z.infer<typeof CreateSubmissionFeatureSchema>;

export interface CreateSubmissionFeatureIngestionRecord {
  submissionId: number;
  submissionUploadId: string;
  sourceId: string;
  featureTypeName: string;
  data: CreateSubmissionFeature;
  dataByteSize: number;
}

/**
 * Flat submission feature structure matching SIMS IFlattenedBlock.
 * Parent-child relationships are expressed via UUID references.
 */
export interface IFlattenedBlock {
  id: string;
  type: string;
  properties: Record<string, unknown>;
  content: string[];
  parent: string | null;
}

/**
 * Submission record schema
 * Now includes a reference to the artifact security record
 */
export const SubmissionRecordSchema = z.object({
  submission_id: z.string().uuid(),
  uuid: z.string().uuid(),
  uri: z.string().nullable(),
  artifact_security: ArtifactSecurity.nullable(),
  security_review_timestamp: z.string().nullable(),
  submitted_timestamp: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  comment: z.string().nullable(),
  publish_timestamp: z.string().nullable()
});

export type SubmissionRecord = z.infer<typeof SubmissionRecordSchema>;
