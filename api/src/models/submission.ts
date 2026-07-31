import { z } from 'zod';
import type { SECURITY_APPLIED_STATUS } from '../repositories/security-repository';

export interface SubmissionFilters {
  search?: string;
}

export interface SubmissionSummary {
  submission_id: number;
  uuid: string;
  system_user_id: number;
  contributor_id: number;
  publish_timestamp: string | null;
  submitted_timestamp: string;
  name: string;
  description: string | null;
  comment: string | null;
  create_user: number;
  update_user: number | null;
  security: SECURITY_APPLIED_STATUS;
  regions: string[];
}

export const SubmissionFeatureForReview = z.object({
  submission_id: z.number().int(),
  submission_feature_id: z.number().int(),
  feature_type_name: z.string(),
  feature_type_id: z.number().int(),
  secured: z.boolean()
});

export type SubmissionFeatureForReview = z.infer<typeof SubmissionFeatureForReview>;
