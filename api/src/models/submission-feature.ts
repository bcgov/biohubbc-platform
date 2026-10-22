import { z } from 'zod';
import { ArtifactSecurity } from './artifact-security';

export interface SubmissionFeatureFilters {
  search?: string;
}

export interface SubmissionFeaturePropertyFilters {
  search?: string;
}

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
  universal_id?: string;
}

/**
 * Shallow-validated submission feature prepared for a bulk ingestion insert.
 *
 * The payload is serialized once by the caller: `dataJson` is stored as `data`, and `dataByteSize`
 * is its UTF-8 byte length.
 */
export interface SubmissionFeatureIngestionRecord {
  submissionId: number;
  submissionUploadId: string;
  sourceId: string;
  featureTypeId: number;
  featureTypeName: string;
  dataJson: string;
  dataByteSize: number;
  contentHash: string;
  universalId: string | null;
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
