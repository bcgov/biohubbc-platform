import { z } from 'zod';
import { ReconciliationType } from './reconciliation';

/**
 * Submission upload feature table record.
 */
export const SubmissionUploadFeature = z.object({
  submission_upload_feature_id: z.string().uuid(),
  submission_upload_id: z.string().uuid(),
  source_id: z.string().nullable(),
  feature_type_id: z.number(),
  data: z.record(z.unknown()),
  data_byte_size: z.coerce.number(),
  content_hash: z.string(),
  universal_id: z.string().nullable(),
  reconciliation: ReconciliationType.nullable(),
  metadata: z.record(z.unknown()).nullable()
});

export type SubmissionUploadFeature = z.infer<typeof SubmissionUploadFeature>;

/**
 * Immutable submitted fields required to create a submission upload feature.
 */
export const CreateSubmissionUploadFeature = SubmissionUploadFeature.pick({
  submission_upload_id: true,
  source_id: true,
  feature_type_id: true,
  data: true,
  data_byte_size: true,
  content_hash: true,
  universal_id: true
});

export type CreateSubmissionUploadFeature = z.infer<typeof CreateSubmissionUploadFeature>;

/**
 * Derived reconciliation fields that may be recalculated for an upload feature.
 */
export const UpdateSubmissionUploadFeature = SubmissionUploadFeature.pick({
  reconciliation: true,
  metadata: true
}).partial();

export type UpdateSubmissionUploadFeature = z.infer<typeof UpdateSubmissionUploadFeature>;
