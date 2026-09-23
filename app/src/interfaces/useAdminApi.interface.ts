import { ExpressionTreeExpression } from './expression.interface';
import { ApiCursorResponseParams, ApiPaginationResponseParams } from 'types/pagination';

export interface IgcNotifyGenericMessage {
  subject: string;
  header: string;
  body1: string;
  body2: string;
  footer: string;
}

export interface IgcNotifyRecipient {
  emailAddress: string;
  phoneNumber: string;
  userId: number;
}

export interface IGetRoles {
  system_role_id: number;
  name: string;
}

export interface ISubmissionUploadReviewDetail {
  submission_upload_review_id: string;
  submission_upload_id: string;
  name: string;
  description: string | null;
  scope: 'validation' | 'security';
  status: 'pending' | 'requested' | 'in_progress' | 'completed' | 'blocked' | 'skipped' | 'cancelled';
  requested_by: number | null;
}

export interface ISubmissionUploadReconciliationCounts {
  new: number;
  modified: number;
  unmodified: number;
}

export type SubmissionUploadReviewSecurityProvenance = 'direct' | 'inherited';

export interface ISubmissionUploadReviewSecurityFeature {
  submission_feature_id: number;
  feature_type_id: number;
  feature_type_name: string;
  provenance: SubmissionUploadReviewSecurityProvenance | null;
}

export interface ISubmissionUploadSecuritySearchFeature extends ISubmissionUploadReviewSecurityFeature {
  parent_submission_feature_id: number | null;
  create_date: string;
}

export interface ISubmissionUploadReviewSecurityFeatureResponse {
  features: ISubmissionUploadSecuritySearchFeature[];
  pagination: ApiCursorResponseParams;
}

export interface ISubmissionUploadReviewSecurityFeatureCountResponse {
  total: number;
}

export interface ISubmissionUploadReviewSecurityRule {
  security_rule_id: number;
  security_category_id: number;
  name: string;
  category_name: string;
}

export interface ISubmissionUploadReviewSelectedFeatureRule extends ISubmissionUploadReviewSecurityRule {
  applied: boolean;
}

export interface ISubmissionUploadReviewSelectedFeatureRuleResponse {
  rules: ISubmissionUploadReviewSelectedFeatureRule[];
  pagination: ApiPaginationResponseParams;
}

export interface ISubmissionUploadReviewFeatureRule extends ISubmissionUploadReviewSecurityRule {
  description: string | null;
  provenance: SubmissionUploadReviewSecurityProvenance;
}

export interface ISubmissionUploadReviewFeatureRuleResponse {
  rules: ISubmissionUploadReviewFeatureRule[];
  pagination: ApiPaginationResponseParams;
}

export interface SubmissionFeatureSecurityRulesFilters {
  keyword?: string;
  expression?: ExpressionTreeExpression;
}

/** Spatial extent of one current feature within an upload. */
export interface ISubmissionUploadFeatureGeometryExtent {
  bbox: [number, number, number, number] | null;
  geometry_count: number;
}
