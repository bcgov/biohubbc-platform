import { z } from 'zod';
import type { SECURITY_APPLIED_STATUS } from '../repositories/security-repository';
import { ApiPaginationResults } from '../zod-schema/pagination';

export interface SubmissionFilters {
  search?: string;
}

/** Filters of the administrative list of every submission. */
export interface AdminSubmissionListFilters {
  keyword?: string;
}

/** One active submission as the administrative submissions list shows it. */
export const AdminSubmissionListItem = z.object({
  submission_id: z.number(),
  uuid: z.string(),
  name: z.string(),
  contributor_name: z.string(),
  submitted_timestamp: z.string(),
  publish_timestamp: z.string().nullable()
});
export type AdminSubmissionListItem = z.infer<typeof AdminSubmissionListItem>;

export interface AdminSubmissionListResponse {
  submissions: AdminSubmissionListItem[];
  pagination: ApiPaginationResults;
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

/** Submission owner and the requesting user's active contributor membership. */
export const SubmissionContributorMembership = z.object({
  is_member: z.boolean()
});
export type SubmissionContributorMembership = z.infer<typeof SubmissionContributorMembership>;
